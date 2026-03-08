# backend/Routers/documents.py
import os
import shutil
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from DB.session import get_db
from DB.schemas import Document, Course
from datetime import datetime

# Folder to store uploaded files (create it if not exists)
UPLOAD_DIR = "uploaded_files"
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter()


# ─────────────────────────────────────────────
# POST /documents/upload — Manually upload a PDF
# ─────────────────────────────────────────────
@router.post("/upload")
async def upload_document(
    course_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    # 1. Check if course exists
    course_result = await db.execute(select(Course).where(Course.id == course_id))
    course = course_result.scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # 2. Validate file type — allow only PDF
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # 3. Save file to disk
    safe_filename = f"doc_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 4. Save metadata to DB — using the current Document schema columns
    new_doc = Document(
        course_id=course_id,
        title=file.filename,
        s3_path=file_path,
        doc_type="manual_upload",       # mark it as manually uploaded
        classroom_material_id=None,     # not from Google Classroom
        google_drive_url=None,
        raw_text=None
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)

    return {
        "message": "PDF uploaded successfully!",
        "document_id": new_doc.id,
        "filename": new_doc.title,
        "course_id": new_doc.course_id,
        "download_url": f"/api/documents/download/{new_doc.id}"
    }


# ─────────────────────────────────────────────
# GET /documents/download/{doc_id} — Download a manually uploaded PDF
# ─────────────────────────────────────────────
@router.get("/download/{doc_id}")
async def download_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalars().first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.s3_path or not os.path.exists(doc.s3_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(
        path=doc.s3_path,
        filename=doc.title,
        media_type="application/pdf"
    )


# ─────────────────────────────────────────────
# GET /documents/{course_id} — List all documents in a course
# ─────────────────────────────────────────────
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
                "doc_type": d.doc_type,                             # "material" / "announcement" / "coursework" / "manual_upload"
                "google_drive_url": d.google_drive_url,             # Drive link (if from Google Classroom)
                "raw_text": d.raw_text,                             # text content (announcements/assignments)
                "classroom_material_id": d.classroom_material_id,  # Google's ID (None if manual upload)
                "created_at": d.created_at.isoformat() if d.created_at else None,  # safe: handles None
                "download_url": f"/api/documents/download/{d.id}" if d.s3_path else None  # only for manual uploads
            }
            for d in docs
        ]
    }