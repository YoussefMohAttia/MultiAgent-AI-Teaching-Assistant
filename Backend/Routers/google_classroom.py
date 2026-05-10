"""
Google Classroom sync router.
Mounted at: /api/sync

Endpoints:
  POST /api/sync/sync-courses          → sync courses only (existing)
  POST /api/sync/full-sync             → sync courses + materials + announcements + coursework
  GET  /api/sync/courses/{user_id}     → list synced courses for a user
  GET  /api/sync/documents/{course_id} → list synced documents for a course
"""
import asyncio
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from DB.session import get_db, AsyncSessionLocal
from DB import crud
from DB.schemas import (
    Document as DocumentORM,
    Chunk as ChunkORM,
    Summary as SummaryORM,
    SummaryChunk as SummaryChunkORM,
)
from services.google_classroom_service import GoogleClassroomService
from services.drive_download_service import ensure_local_file
from services.pdf_processor import extract_text_from_pdf, index_pdf_for_course
from services.summarizer_service import summarize_text
from Core.config import settings
from langchain_text_splitters import RecursiveCharacterTextSplitter

router = APIRouter()
google_service = GoogleClassroomService()


async def _background_index_documents(new_doc_ids: list):
    """Background task: download Drive files and index them into ChromaDB."""
    if not new_doc_ids:
        return
    async with AsyncSessionLocal() as db:
        for doc_id in new_doc_ids:
            try:
                result = await db.execute(select(DocumentORM).where(DocumentORM.id == doc_id))
                doc = result.scalars().first()
                if not doc or not doc.google_drive_url:
                    continue
                local_path = await ensure_local_file(doc, db)
                index_pdf_for_course(local_path, doc.course_id)
                print(f"✅ Auto-indexed doc {doc_id} for course {doc.course_id}")
            except Exception as e:
                print(f"⚠️  Auto-index skipped doc {doc_id}: {e}")


async def _background_auto_summarize_materials(new_doc_ids: list):
    """Background task: auto-summarize new material documents once."""
    if not new_doc_ids or not settings.AUTO_SUMMARIZE_MATERIALS:
        return
    print(f"📋 Auto-summary task started for {len(new_doc_ids)} document(s)")

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

    async with AsyncSessionLocal() as db:
        for doc_id in new_doc_ids:
            try:
                result = await db.execute(select(DocumentORM).where(DocumentORM.id == doc_id))
                doc = result.scalars().first()
                if not doc or doc.doc_type != "material":
                    continue

                existing_summary = (
                    await db.execute(
                        select(SummaryORM)
                        .join(SummaryChunkORM, SummaryORM.id == SummaryChunkORM.summary_id)
                        .join(ChunkORM, SummaryChunkORM.chunk_id == ChunkORM.id)
                        .where(ChunkORM.doc_id == doc_id)
                        .limit(1)
                    )
                ).scalars().first()
                if existing_summary:
                    print(f"ℹ️  Auto-summary skipped doc {doc_id}: summary already exists")
                    continue

                text = ""
                if doc.google_drive_url:
                    try:
                        local_path = await ensure_local_file(doc, db)
                        text = extract_text_from_pdf(local_path)
                    except Exception as e:
                        print(f"⚠️  Auto-summary file read failed for doc {doc_id}: {e}")

                if not text and doc.raw_text:
                    text = doc.raw_text

                if not text or not text.strip():
                    print(f"⚠️  Auto-summary skipped doc {doc_id}: no extractable text")
                    continue
                print(f"🧠 Auto-summary started doc {doc_id}: {doc.title}")
                summary_text = summarize_text(text[:15000])
                db_summary = SummaryORM(text=summary_text, method="llm")
                db.add(db_summary)
                await db.flush()

                existing_chunks = (
                    await db.execute(
                        select(ChunkORM)
                        .where(ChunkORM.doc_id == doc_id)
                        .order_by(ChunkORM.sequence_number)
                    )
                ).scalars().all()

                if not existing_chunks:
                    raw_chunks = splitter.split_text(text)
                    existing_chunks = []
                    for i, chunk_text in enumerate(raw_chunks):
                        chunk = ChunkORM(
                            doc_id=doc_id,
                            sequence_number=i,
                            text=chunk_text,
                        )
                        db.add(chunk)
                        existing_chunks.append(chunk)
                    await db.flush()

                for chunk in existing_chunks:
                    db.add(SummaryChunkORM(summary_id=db_summary.id, chunk_id=chunk.id))

                await db.commit()
                print(f"✅ Auto-summarized doc {doc_id}")
            except Exception as e:
                await db.rollback()
                print(f"⚠️  Auto-summary skipped doc {doc_id}: {e}")


# ─────────────────────────────────────────────
# Sync courses only
# ─────────────────────────────────────────────
@router.post("/sync-courses")
async def sync_courses(
    user_id: int,   # TODO: extract from JWT cookie in a later sprint
    db: AsyncSession = Depends(get_db)
):
    """Sync Google Classroom courses into the local database."""

    access_token = await crud.get_valid_access_token(
        db=db, user_id=user_id,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET
    )
    if not access_token:
        raise HTTPException(status_code=401, detail="Could not get valid access token. Please login again.")

    courses_data = await google_service.fetch_courses(access_token)
    if not courses_data:
        return {"success": True, "message": "No courses found", "new_courses": 0, "updated_courses": 0}

    new_count = 0
    updated_count = 0

    for course_data in courses_data:
        classroom_id = course_data.get("id")
        title = course_data.get("name", "Untitled Course")
        existing = await crud.get_course_by_classroom_id(db, classroom_id)
        if existing:
            await crud.update_course(db, existing, title)
            updated_count += 1
        else:
            await crud.create_course(db=db, user_id=user_id, classroom_id=classroom_id, title=title)
            new_count += 1

    return {
        "success": True,
        "message": "Courses synced successfully",
        "new_courses": new_count,
        "updated_courses": updated_count,
        "total_courses": len(courses_data)
    }


# ─────────────────────────────────────────────
# Full sync — courses + all content (PARALLEL & DELTA OPTIMIZED)
# ─────────────────────────────────────────────
@router.post("/full-sync")
async def full_sync(
    user_id: int,   # TODO: extract from JWT cookie in a later sprint
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Full sync of Google Classroom data for a user.

    Steps:
      1. Get valid access token (auto-refresh if expired)
      2. Sync all courses (upsert)
      3. For each course, fetch ALL material types in parallel from Google API.
      4. Idempotent Delta Sync: Only process and save items that don't exist in DB.
    """

    # ── Step 1: Token ─────────────────────────────
    access_token = await crud.get_valid_access_token(
        db=db, user_id=user_id,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET
    )
    if not access_token:
        raise HTTPException(status_code=401, detail="Could not get valid access token. Please login again.")

    # ── Step 2: Sync courses ───────────────────────
    courses_data = await google_service.fetch_courses(access_token)
    if not courses_data:
        return {"success": True, "message": "No courses found in Google Classroom", "courses": {}, "documents": {}}

    courses_new = 0
    courses_updated = 0
    synced_courses = []   # list of (db_course_id, classroom_id) for document syncing

    for course_data in courses_data:
        classroom_id = course_data.get("id")
        title = course_data.get("name", "Untitled Course")

        existing = await crud.get_course_by_classroom_id(db, classroom_id)
        if existing:
            await crud.update_course(db, existing, title)
            # 🔥 THE FIX: Always ensure the user is linked, even if course existed!
            await crud.link_user_to_course(db, user_id, existing.id) 
            courses_updated += 1
            synced_courses.append((existing.id, classroom_id))
        else:
            # 🔥 THE FIX: Remove user_id from create parameter
            new_course = await crud.create_course(
                db=db, classroom_id=classroom_id, title=title
            )
            await crud.link_user_to_course(db, user_id, new_course.id)
            courses_new += 1
            synced_courses.append((new_course.id, classroom_id))

    # ── Step 3: Parallel Fetch & Delta Sync for documents ─────
    docs_materials = 0
    docs_announcements = 0
    docs_coursework = 0
    docs_skipped = 0
    new_drive_doc_ids = []
    new_material_doc_ids = []
    new_material_docs = []
    auto_summary_doc_ids = []

    for db_course_id, classroom_id in synced_courses:
        
        
        materials_list, announcements_list, coursework_list = await asyncio.gather(
            google_service.fetch_course_materials(classroom_id, access_token),
            google_service.fetch_announcements(classroom_id, access_token),
            google_service.fetch_coursework(classroom_id, access_token)
        )

        # ── 3a: Materials ──────────────────────────
        for item in materials_list:
            material_id = item.get("id")
            if not material_id: continue

            # Delta Check (Instantly skips if exists)
            if await crud.get_document_by_material_id(db, material_id):
                docs_skipped += 1
                continue

            title = item.get("title", "Untitled Material")
            drive_url = google_service.extract_drive_url(item.get("materials", []))

            new_doc = await crud.create_document(
                db=db, course_id=db_course_id, classroom_material_id=material_id,
                title=title, doc_type="material", google_drive_url=drive_url,
                raw_text=item.get("description")
            )
            new_material_doc_ids.append(new_doc.id)
            new_material_docs.append({
                "id": new_doc.id,
                "title": new_doc.title,
                "course_id": new_doc.course_id,
                "doc_type": new_doc.doc_type,
            })
            if drive_url: new_drive_doc_ids.append(new_doc.id)
            docs_materials += 1

        # ── 3b: Announcements ──────────────────────
        for item in announcements_list:
            material_id = item.get("id")
            if not material_id: continue

            # Delta Check
            if await crud.get_document_by_material_id(db, material_id):
                docs_skipped += 1
                continue

            raw_text = item.get("text", "")
            title = raw_text[:200] if raw_text else "Untitled Announcement"
            drive_url = google_service.extract_drive_url(item.get("materials", []))

            await crud.create_document(
                db=db, course_id=db_course_id, classroom_material_id=material_id,
                title=title, doc_type="announcement", google_drive_url=drive_url,
                raw_text=raw_text   
            )
            docs_announcements += 1

        # ── 3c: Coursework (Drive-attached only) ───
        for item in coursework_list:
            material_id = item.get("id")
            if not material_id: continue

            # Delta Check
            if await crud.get_document_by_material_id(db, material_id):
                docs_skipped += 1
                continue

            title = item.get("title", "Untitled Assignment")
            drive_url = google_service.extract_drive_url(item.get("materials", []))
            due_date_obj = google_service._parse_google_due_date(
                item.get("dueDate"), 
                item.get("dueTime")
            )
            new_doc = await crud.create_document(
                db=db, 
                course_id=db_course_id, 
                classroom_material_id=material_id,
                title=title, 
                doc_type="coursework", 
                google_drive_url=drive_url,
                raw_text=item.get("description"), # raw_text is populated here!
                due_date=due_date_obj             # ⚡ FIX: Passing the parsed date!
            )
            if drive_url: new_drive_doc_ids.append(new_doc.id)
            docs_coursework += 1

    # ── Step 4: Schedule background indexing for new Drive documents ──────
    if new_drive_doc_ids:
        background_tasks.add_task(_background_index_documents, new_drive_doc_ids)
        print(f"📋 Scheduled background indexing for {len(new_drive_doc_ids)} Drive document(s)")

    if settings.AUTO_SUMMARIZE_MATERIALS:
        course_ids = [course_id for course_id, _ in synced_courses]
        if course_ids:
            summary_exists = (
                select(1)
                .select_from(ChunkORM)
                .join(SummaryChunkORM, SummaryChunkORM.chunk_id == ChunkORM.id)
                .where(ChunkORM.doc_id == DocumentORM.id)
                .exists()
            )
            missing_summary_ids = (
                await db.execute(
                    select(DocumentORM.id).where(
                        DocumentORM.course_id.in_(course_ids),
                        DocumentORM.doc_type == "material",
                        ~summary_exists,
                    )
                )
            ).scalars().all()

            candidate_ids = list({*missing_summary_ids, *new_material_doc_ids})
                            asyncio.create_task(_background_auto_summarize_materials(candidate_ids))
                            print(f"📋 Scheduled auto-summary for {len(candidate_ids)} material document(s)")
            if candidate_ids:
                auto_summary_doc_ids = candidate_ids
                background_tasks.add_task(_background_auto_summarize_materials, candidate_ids)
                print(f"📋 Scheduled auto-summary for {len(candidate_ids)} material document(s)")

    # ── Step 5: Return summary ─────────────────────────────────────────────
    total_docs_new = docs_materials + docs_announcements + docs_coursework

    return {
        "success": True,
        "message": "Full sync completed. Drive documents are being indexed in the background.",
        "courses": {
            "new": courses_new,
            "updated": courses_updated,
            "total": len(courses_data)
        },
        "documents": {
            "materials_added": docs_materials,
            "announcements_added": docs_announcements,
            "coursework_added": docs_coursework,
            "total_new": total_docs_new,
            "skipped_already_exist": docs_skipped
        },
        "new_materials": new_material_docs,
        "auto_summary": {
            "enabled": settings.AUTO_SUMMARIZE_MATERIALS,
            "scheduled_doc_ids": auto_summary_doc_ids,
            "total_scheduled": len(auto_summary_doc_ids),
        },
    }


# ─────────────────────────────────────────────
# GET: List synced courses for a user
# ─────────────────────────────────────────────
@router.get("/courses/{user_id}")
async def get_user_courses(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Return all courses synced for a given user."""
    courses = await crud.get_user_courses(db, user_id)
    if not courses:
        return {"courses": [], "total": 0}
    return {
        "courses": [
            {
                "id": c.id,
                "classroom_id": c.classroom_id,
                "title": c.title,
                "created_at": c.created_at
            }
            for c in courses
        ],
        "total": len(courses)
    }


# ─────────────────────────────────────────────
# GET: List synced documents for a course
# ─────────────────────────────────────────────
@router.get("/documents/{course_id}")
async def get_course_documents(
    course_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Return all synced documents for a course.
    Useful for frontend display and AI team ingestion.
    """
    documents = await crud.get_documents_by_course_id(db, course_id)
    if not documents:
        return {"documents": [], "total": 0}
    return {
        "documents": [
            {
                "id": d.id,
                "title": d.title,
                "doc_type": d.doc_type,
                "google_drive_url": d.google_drive_url,
                "raw_text": d.raw_text,
                "classroom_material_id": d.classroom_material_id,
                "created_at": d.created_at
            }
            for d in documents
        ],
        "total": len(documents)
    }