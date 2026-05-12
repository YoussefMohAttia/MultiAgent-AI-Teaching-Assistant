"""
Time-based cleanup for cached uploaded files.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta
from typing import Dict

from sqlalchemy.future import select

from Core.config import settings
from DB.schemas import Document
from DB.session import AsyncSessionLocal


def _normalize_path(path: str) -> str:
    return os.path.abspath(path)


async def cleanup_uploaded_files_once() -> Dict[str, int]:
    upload_dir = settings.PDF_UPLOAD_DIR
    if not os.path.isdir(upload_dir):
        return {"deleted": 0, "kept": 0, "skipped": 0, "cleared_refs": 0}

    cutoff = datetime.utcnow() - timedelta(hours=settings.UPLOAD_CLEANUP_RETENTION_HOURS)
    deleted = 0
    kept = 0
    skipped = 0
    cleared_refs = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Document))
        docs = result.scalars().all()
        docs_by_path = {
            _normalize_path(doc.s3_path): doc
            for doc in docs
            if doc.s3_path
        }

        for name in os.listdir(upload_dir):
            path = os.path.join(upload_dir, name)
            if not os.path.isfile(path):
                continue

            try:
                mtime = datetime.utcfromtimestamp(os.path.getmtime(path))
            except OSError:
                skipped += 1
                continue

            if mtime > cutoff:
                continue

            normalized_path = _normalize_path(path)
            doc = docs_by_path.get(normalized_path)
            if doc and not doc.google_drive_url:
                kept += 1
                continue

            try:
                os.remove(path)
                deleted += 1
            except OSError as exc:
                print(f"⚠️  Cleanup failed for {path}: {exc}")
                skipped += 1
                continue

            if doc and doc.google_drive_url:
                doc.s3_path = None
                cleared_refs += 1

        if cleared_refs:
            await db.commit()

    if deleted or cleared_refs:
        print(
            "🧹 Cleanup removed old cached files. "
            f"deleted={deleted} cleared_refs={cleared_refs} kept={kept} skipped={skipped}"
        )

    return {
        "deleted": deleted,
        "kept": kept,
        "skipped": skipped,
        "cleared_refs": cleared_refs,
    }


async def cleanup_loop() -> None:
    interval_s = max(300, settings.UPLOAD_CLEANUP_INTERVAL_MINUTES * 60)
    while True:
        try:
            await cleanup_uploaded_files_once()
        except Exception as exc:
            print(f"⚠️  Cleanup loop error: {exc}")
        await asyncio.sleep(interval_s)
