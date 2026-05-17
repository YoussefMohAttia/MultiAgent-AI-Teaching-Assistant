import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from DB.session import get_db
from DB.schemas import Document

router = APIRouter()

@router.get("/download/{doc_id}")
async def download_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalars().first()

    if not doc: raise HTTPException(status_code=404, detail="Document not found")
    if not doc.s3_path or not os.path.exists(doc.s3_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(path=doc.s3_path, filename=doc.title, media_type="application/pdf")

@router.get("/{course_id}")
async def list_documents(course_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.course_id == course_id))
    docs = result.scalars().all()

    return {
        "count": len(docs),
        "documents": [
            {
                "id": d.id,
                "title": d.title,
                "doc_type": d.doc_type,
                "google_drive_url": d.google_drive_url,
                "raw_text": d.raw_text,
                "classroom_material_id": d.classroom_material_id,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                # 🔥 THE FIX: Fallback to Drive URL so users can preview/download Classroom files
                "download_url": d.google_drive_url if d.google_drive_url else (f"/api/documents/download/{d.id}" if d.s3_path else None)
            }
            for d in docs
        ]
    }