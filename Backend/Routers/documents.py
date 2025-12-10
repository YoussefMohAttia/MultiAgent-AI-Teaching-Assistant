#documents
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

# POST /documents/upload — Upload PDF or any file
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

    # 2. Validate file type (optional — allow only PDF for now)
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # 3. Save file to disk
    file_extension = os.path.splitext(file.filename)[1] or ".pdf"
    safe_filename = f"doc_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 4. Save metadata to DB
    new_doc = Document(
        course_id=course_id,
        type=file.content_type,
        title=file.filename,
        s3_path=file_path,           # ← we store local path for now
        uploaded_at=datetime.utcnow(),
        lms_source_id=None           # ← for future Teams sync
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)

    return {
        "message": "PDF uploaded successfully!",
        "document_id": new_doc.id,
        "filename": new_doc.title,
        "course_id": new_doc.course_id,
        "download_url": f"/documents/download/{new_doc.id}"
    }

# GET /documents/download/{doc_id} — Download PDF by ID
@router.get("/download/{doc_id}")
async def download_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalars().first()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not os.path.exists(doc.s3_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(
        path=doc.s3_path,
        filename=doc.title,
        media_type="application/pdf"
    )

# GET /documents/{course_id} — List all documents in a course
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
                "uploaded_at": d.uploaded_at.isoformat(),
                "download_url": f"/documents/download/{d.id}"
            } for d in docs
        ]
    }