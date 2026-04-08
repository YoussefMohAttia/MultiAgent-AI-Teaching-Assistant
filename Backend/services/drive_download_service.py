"""
Google Drive auto-download service.

Given a Document ORM record whose `s3_path` is NULL (Drive-only file),
this service:
  1. Extracts the file ID from google_drive_url
  2. Downloads the file using the course-owner's Google access token
  3. Saves it to the local upload directory
  4. Updates document.s3_path in the DB so future calls hit the cache

Supported URL formats:
  https://drive.google.com/file/d/{fileId}/view
  https://drive.google.com/open?id={fileId}
  https://docs.google.com/document/d/{fileId}/edit      (Google Doc — export as PDF)
  https://docs.google.com/presentation/d/{fileId}/edit  (Slides — export as PDF)
"""

from __future__ import annotations

import os
import re
from datetime import datetime
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from Core.config import settings
from DB import crud


# ── File ID extraction ───────────────────────────────────────────────────────

_FILE_ID_RE = re.compile(r"/d/([a-zA-Z0-9_-]{10,})")
_ID_PARAM_RE = re.compile(r"[?&]id=([a-zA-Z0-9_-]{10,})")


def extract_drive_file_id(url: str) -> Optional[str]:
    """Return the Drive file ID from any known Drive/Docs/Slides URL."""
    m = _FILE_ID_RE.search(url)
    if m:
        return m.group(1)
    m = _ID_PARAM_RE.search(url)
    if m:
        return m.group(1)
    return None


def _is_google_doc(url: str) -> bool:
    return "docs.google.com/document" in url or "docs.google.com/presentation" in url


# ── Download logic ───────────────────────────────────────────────────────────

async def _download_bytes(file_id: str, is_gdoc: bool, access_token: str) -> bytes:
    """Download file bytes from Google Drive API."""
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        if is_gdoc:
            # Export Google Doc / Slides as PDF
            url = f"https://www.googleapis.com/drive/v3/files/{file_id}/export"
            resp = await client.get(url, headers=headers, params={"mimeType": "application/pdf"})
        else:
            # Direct binary download
            url = f"https://www.googleapis.com/drive/v3/files/{file_id}"
            resp = await client.get(url, headers=headers, params={"alt": "media"})

        print(f"🔍 Drive API response for file {file_id}: HTTP {resp.status_code}")
        if resp.status_code != 200:
            print(f"🔍 Drive error body: {resp.text[:500]}")

        if resp.status_code == 401:
            raise PermissionError(
                "Google token expired or missing Drive scope. "
                "Please sign out and sign in again to grant Drive access."
            )
        if resp.status_code == 403:
            error_body = resp.text
            # Google returns several different strings for scope/auth issues
            scope_keywords = (
                "insufficientPermissions", "insufficientScopes",
                "ACCESS_TOKEN_SCOPE_INSUFFICIENT", "insufficient authentication scopes",
                "PERMISSION_DENIED", "authError", "forbidden",
            )
            if any(kw.lower() in error_body.lower() for kw in scope_keywords):
                raise PermissionError(
                    "Your account does not have the Google Drive permission scope. "
                    "Please sign out and sign in again — you will be prompted to allow Drive access."
                )
            raise PermissionError(
                f"Access denied to this Drive file (file_id={file_id}). "
                "Make sure the file is shared with your Google account "
                f"or is accessible within your Google Workspace. Google said: {error_body[:300]}"
            )
        if resp.status_code != 200:
            raise RuntimeError(f"Drive download failed (HTTP {resp.status_code}): {resp.text[:200]}")

        return resp.content


# ── Public API ───────────────────────────────────────────────────────────────

async def ensure_local_file(doc, db: AsyncSession) -> str:
    """
    Ensure a Document has a local file and return its path.

    If `doc.s3_path` already points to an existing file, return it immediately.
    Otherwise, auto-download from Google Drive using the course-owner's token,
    save to disk, persist the path in the DB, and return it.

    Raises HTTPException-style exceptions on auth / permission errors.
    """
    # Already downloaded?
    if doc.s3_path and os.path.exists(doc.s3_path):
        return doc.s3_path

    if not doc.google_drive_url:
        raise ValueError("Document has no Google Drive URL and no local file.")

    file_id = extract_drive_file_id(doc.google_drive_url)
    if not file_id:
        raise ValueError(f"Cannot extract Drive file ID from URL: {doc.google_drive_url}")

    # Get the course owner's access token
    from DB.schemas import Course as CourseORM
    result = await db.execute(select(CourseORM).where(CourseORM.id == doc.course_id))
    course = result.scalars().first()
    if not course:
        raise ValueError("Course not found for this document.")

    is_gdoc = _is_google_doc(doc.google_drive_url)
    print(f"🔍 Doc {doc.id} → course {course.id} → owner user_id={course.user_id}")
    print(f"🔍 Drive URL: {doc.google_drive_url}")
    print(f"🔍 Extracted file_id: {file_id}, is_gdoc: {is_gdoc}")

    access_token = await crud.get_valid_access_token(
        db=db,
        user_id=course.user_id,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
    )
    if not access_token:
        raise PermissionError(
            "Could not obtain a valid Google access token. Please sign in again."
        )

    # Download
    file_bytes = await _download_bytes(file_id, is_gdoc, access_token)

    # Save to disk
    upload_dir = settings.PDF_UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    safe_name = re.sub(r"[^\w\-.]", "_", doc.title or "document")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"drive_{doc.id}_{timestamp}_{safe_name}.pdf"
    local_path = os.path.join(upload_dir, filename)

    with open(local_path, "wb") as f:
        f.write(file_bytes)

    # Persist path in DB so next call skips download
    doc.s3_path = local_path
    await db.commit()
    await db.refresh(doc)

    print(f"✅ Auto-downloaded Drive file for doc {doc.id} → {local_path}")
    return local_path
