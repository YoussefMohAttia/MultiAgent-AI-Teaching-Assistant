"""
Google Drive auto-download service.
"""
from __future__ import annotations
import os
import re
import tempfile
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from Core.config import settings
from DB import crud
from services.pdf_processor import extract_text_from_pdf

_FILE_ID_RE = re.compile(r"/d/([a-zA-Z0-9_-]{10,})")
_ID_PARAM_RE = re.compile(r"[?&]id=([a-zA-Z0-9_-]{10,})")

def extract_drive_file_id(url: str) -> Optional[str]:
    m = _FILE_ID_RE.search(url)
    if m: return m.group(1)
    m = _ID_PARAM_RE.search(url)
    if m: return m.group(1)
    return None

def _is_google_doc(url: str) -> bool:
    return "docs.google.com/document" in url or "docs.google.com/presentation" in url

async def _download_bytes(file_id: str, is_gdoc: bool, access_token: str) -> bytes:
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        if is_gdoc:
            url = f"https://www.googleapis.com/drive/v3/files/{file_id}/export"
            resp = await client.get(url, headers=headers, params={"mimeType": "application/pdf"})
        else:
            url = f"https://www.googleapis.com/drive/v3/files/{file_id}"
            resp = await client.get(url, headers=headers, params={"alt": "media"})

        if resp.status_code == 401:
            raise PermissionError("Google token expired. Please sign out and sign in again.")
        if resp.status_code == 403:
            raise PermissionError("Access denied to this Drive file. Make sure it is shared with your account.")
        if resp.status_code != 200:
            raise RuntimeError(f"Drive download failed (HTTP {resp.status_code}): {resp.text[:200]}")

        return resp.content

def _extract_text_from_bytes(file_bytes: bytes) -> str:
    from services.pdf_processor import extract_text_from_pdf_bytes
    return extract_text_from_pdf_bytes(file_bytes)


async def ensure_document_text(doc, db: AsyncSession) -> str:
    """Ensure a Document has extracted text stored and return it."""
    if doc.raw_text and doc.raw_text.strip():
        return doc.raw_text

    if doc.s3_path and os.path.exists(doc.s3_path):
        text = extract_text_from_pdf(doc.s3_path)
        if text and text.strip():
            doc.raw_text = text
            await db.commit()
            await db.refresh(doc)
            return text

    if not doc.google_drive_url:
        raise ValueError("Document has no Drive URL or local file.")

    file_id = extract_drive_file_id(doc.google_drive_url)
    if not file_id:
        raise ValueError(f"Cannot extract Drive file ID from URL: {doc.google_drive_url}")

    from DB.schemas import UserCourse
    result = await db.execute(select(UserCourse).where(UserCourse.course_id == doc.course_id))
    user_course = result.scalars().first()
    if not user_course:
        raise ValueError("No users are enrolled in this course. Cannot authorize download.")

    linked_user_id = user_course.user_id
    is_gdoc = _is_google_doc(doc.google_drive_url)

    access_token = await crud.get_valid_access_token(
        db=db,
        user_id=linked_user_id,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
    )
    if not access_token:
        raise PermissionError("Could not obtain a valid Google access token. Please sign in again.")

    file_bytes = await _download_bytes(file_id, is_gdoc, access_token)
    text = _extract_text_from_bytes(file_bytes)
    if not text or not text.strip():
        print(f"⚠️  No extractable text found in Drive document (id={file_id}), "
              "even after OCR fallback. The document may be a non-text file.")
        raise ValueError("No extractable text found in Drive document.")

    doc.raw_text = text
    await db.commit()
    await db.refresh(doc)
    return text