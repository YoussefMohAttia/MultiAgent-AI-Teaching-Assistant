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
from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from DB.session import get_db, AsyncSessionLocal
from DB import crud
from DB.schemas import (
    Document as DocumentORM,
    Chunk as ChunkORM,
    Summary as SummaryORM,
    SummaryChunk as SummaryChunkORM,
    Quiz as QuizORM,
    QuizQuestion as QuizQuestionORM,
    QuizDocument as QuizDocumentORM,
)
from services.google_classroom_service import GoogleClassroomService
from services.drive_download_service import ensure_document_text
from services.pdf_processor import index_text_for_course
from services.summarizer_service import summarize_text
from services.quiz_generator_service import generate_quiz
from services.quiz_utils import find_quiz_by_doc_and_criteria
from Core.config import settings
from langchain_text_splitters import RecursiveCharacterTextSplitter

router = APIRouter()
google_service = GoogleClassroomService()

_auto_quiz_inflight: set[int] = set()
_auto_quiz_lock = asyncio.Lock()
_AUTO_QUIZ_N_ITEMS = 5
_AUTO_QUIZ_N_OPTIONS = 4


async def _auto_jobs_enabled(db: AsyncSession, user_id: int | None) -> bool:
    if not user_id:
        return True
    user = await crud.get_user_by_id(db, user_id)
    if not user:
        return False
    flag = getattr(user, "auto_jobs_enabled", True)
    return True if flag is None else bool(flag)


async def _background_index_documents(new_doc_ids: list, user_id: int | None):
    """Background task: download Drive files and index them into ChromaDB."""
    if not new_doc_ids:
        return
    async with AsyncSessionLocal() as db:
        if not await _auto_jobs_enabled(db, user_id):
            return
        for doc_id in new_doc_ids:
            if not await _auto_jobs_enabled(db, user_id):
                print("ℹ️  Auto-index stopped: user logged out")
                break
            try:
                result = await db.execute(select(DocumentORM).where(DocumentORM.id == doc_id))
                doc = result.scalars().first()
                if not doc or not doc.google_drive_url:
                    continue
                text = await ensure_document_text(doc, db)
                if not text or not text.strip():
                    continue
                await asyncio.to_thread(
                    index_text_for_course,
                    text,
                    doc.course_id,
                    document_id=doc.id,
                )
                print(f"✅ Auto-indexed doc {doc_id} for course {doc.course_id}")
            except Exception as e:
                print(f"⚠️  Auto-index skipped doc {doc_id}: {e}")


async def _background_auto_summarize_materials(new_doc_ids: list, user_id: int | None):
    """Background task: auto-summarize new material documents once."""
    if not new_doc_ids or not settings.AUTO_SUMMARIZE_MATERIALS:
        return
    print(f"📋 Auto-summary task started for {len(new_doc_ids)} document(s)")

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

    async with AsyncSessionLocal() as db:
        for doc_id in new_doc_ids:
            if not await _auto_jobs_enabled(db, user_id):
                print("ℹ️  Auto-summary stopped: user logged out")
                break
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
                if doc.raw_text:
                    text = doc.raw_text
                elif doc.google_drive_url or doc.s3_path:
                    try:
                        text = await ensure_document_text(doc, db)
                    except Exception as e:
                        print(f"⚠️  Auto-summary text extraction failed for doc {doc_id}: {e}")

                if not text or not text.strip():
                    print(f"⚠️  Auto-summary skipped doc {doc_id}: no extractable text")
                    continue
                print(f"🧠 Auto-summary started doc {doc_id}: {doc.title}")
                summary_text = await asyncio.to_thread(
                    summarize_text,
                    text[:15000],
                )
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


async def _background_auto_generate_quizzes(new_doc_ids: list, user_id: int | None):
    """Background task: auto-generate quizzes for new material documents once."""
    if not new_doc_ids or not settings.AUTO_GENERATE_QUIZZES:
        return
    print(f"🧪 Auto-quiz task started for {len(new_doc_ids)} document(s)")

    async with AsyncSessionLocal() as db:
        for doc_id in new_doc_ids:
            if not await _auto_jobs_enabled(db, user_id):
                print("ℹ️  Auto-quiz stopped: user logged out")
                break
            reserved = False
            async with _auto_quiz_lock:
                if doc_id in _auto_quiz_inflight:
                    print(f"ℹ️  Auto-quiz skipped doc {doc_id}: already in progress")
                    continue
                _auto_quiz_inflight.add(doc_id)
                reserved = True
            try:
                result = await db.execute(select(DocumentORM).where(DocumentORM.id == doc_id))
                doc = result.scalars().first()
                if not doc or doc.doc_type != "material":
                    continue

                existing_quiz = await find_quiz_by_doc_and_criteria(
                    db,
                    doc_id=doc_id,
                    n_items=_AUTO_QUIZ_N_ITEMS,
                    n_options=_AUTO_QUIZ_N_OPTIONS,
                )
                if existing_quiz:
                    print(f"ℹ️  Auto-quiz skipped doc {doc_id}: quiz already exists")
                    continue

                text = ""
                if doc.raw_text:
                    text = doc.raw_text
                elif doc.google_drive_url or doc.s3_path:
                    try:
                        text = await ensure_document_text(doc, db)
                    except Exception as e:
                        print(f"⚠️  Auto-quiz text extraction failed for doc {doc_id}: {e}")

                if not text or not text.strip():
                    print(f"⚠️  Auto-quiz skipped doc {doc_id}: no extractable text")
                    continue

                print(f"🧠 Auto-quiz started doc {doc_id}: {doc.title}")
                raw_items = await asyncio.to_thread(
                    generate_quiz,
                    passage=text[:15000],
                    n_items=_AUTO_QUIZ_N_ITEMS,
                    n_options=_AUTO_QUIZ_N_OPTIONS,
                )
                if not raw_items:
                    print(f"⚠️  Auto-quiz skipped doc {doc_id}: no valid questions")
                    continue

                db_quiz = QuizORM(course_id=doc.course_id, created_by=None)
                db.add(db_quiz)
                await db.flush()

                question_count = 0
                for item in raw_items:
                    options = item.get("options") or []
                    answer_index = item.get("answer_index")
                    if answer_index is None or answer_index < 0 or answer_index >= len(options):
                        continue
                    correct_answer = options[answer_index]
                    db.add(
                        QuizQuestionORM(
                            quiz_id=db_quiz.id,
                            question=item.get("stem", ""),
                            type="mcq",
                            options=options,
                            correct_answer=correct_answer,
                        )
                    )
                    question_count += 1

                if question_count == 0:
                    await db.rollback()
                    print(f"⚠️  Auto-quiz skipped doc {doc_id}: no valid questions")
                    continue

                db.add(QuizDocumentORM(quiz_id=db_quiz.id, doc_id=doc.id))
                await db.commit()
                print(f"✅ Auto-quiz generated doc {doc_id}")
            except Exception as e:
                await db.rollback()
                print(f"⚠️  Auto-quiz skipped doc {doc_id}: {e}")
            finally:
                if reserved:
                    async with _auto_quiz_lock:
                        _auto_quiz_inflight.discard(doc_id)


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
    db: AsyncSession = Depends(get_db),
    selected_course_ids: list[int] | None = Body(default=None, embed=True),
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
    synced_courses = []   # list of {course_id, classroom_id, course_title} for document syncing

    for course_data in courses_data:
        classroom_id = course_data.get("id")
        title = course_data.get("name", "Untitled Course")

        existing = await crud.get_course_by_classroom_id(db, classroom_id)
        if existing:
            await crud.update_course(db, existing, title)
            # 🔥 THE FIX: Always ensure the user is linked, even if course existed!
            await crud.link_user_to_course(db, user_id, existing.id) 
            courses_updated += 1
            synced_courses.append({"course_id": existing.id, "classroom_id": classroom_id, "course_title": title})
        else:
            # 🔥 THE FIX: Remove user_id from create parameter
            new_course = await crud.create_course(
                db=db, classroom_id=classroom_id, title=title
            )
            await crud.link_user_to_course(db, user_id, new_course.id)
            courses_new += 1
            synced_courses.append({"course_id": new_course.id, "classroom_id": classroom_id, "course_title": title})

    # ── Step 3: Parallel Fetch & Delta Sync for documents ─────
    docs_materials = 0
    docs_announcements = 0
    docs_coursework = 0
    docs_skipped = 0
    new_drive_doc_ids = []
    new_material_doc_ids = []
    new_material_course_map = {}
    new_material_docs = []
    auto_summary_doc_ids = []
    auto_quiz_doc_ids = []
    allowed_course_ids = None

    if selected_course_ids:
        allowed_course_ids = {int(course_id) for course_id in selected_course_ids if course_id}

    for course_sync in synced_courses:
        db_course_id = course_sync["course_id"]
        classroom_id = course_sync["classroom_id"]
        course_title = course_sync["course_title"]
        
        
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
            new_material_course_map[new_doc.id] = db_course_id
            new_material_docs.append({
                "id": new_doc.id,
                "title": new_doc.title,
                "course_id": new_doc.course_id,
                "course_title": course_title,
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
        background_tasks.add_task(_background_index_documents, new_drive_doc_ids, user_id)
        print(f"📋 Scheduled background indexing for {len(new_drive_doc_ids)} Drive document(s)")

    new_material_doc_ids_for_auto = (
        [doc_id for doc_id in new_material_doc_ids if not allowed_course_ids or new_material_course_map.get(doc_id) in allowed_course_ids]
        if new_material_doc_ids
        else []
    )

    if settings.AUTO_SUMMARIZE_MATERIALS:
        course_ids = [course_sync["course_id"] for course_sync in synced_courses]
        if allowed_course_ids:
            course_ids = [course_id for course_id in course_ids if course_id in allowed_course_ids]
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

            candidate_ids = list({*missing_summary_ids, *new_material_doc_ids_for_auto})
            if candidate_ids:
                auto_summary_doc_ids = candidate_ids
                background_tasks.add_task(_background_auto_summarize_materials, candidate_ids, user_id)
                print(f"📋 Scheduled auto-summary for {len(candidate_ids)} material document(s)")

    if settings.AUTO_GENERATE_QUIZZES:
        course_ids = [course_sync["course_id"] for course_sync in synced_courses]
        if allowed_course_ids:
            course_ids = [course_id for course_id in course_ids if course_id in allowed_course_ids]
        if course_ids:
            quiz_exists = (
                select(1)
                .select_from(QuizDocumentORM)
                .where(QuizDocumentORM.doc_id == DocumentORM.id)
                .exists()
            )
            missing_quiz_ids = (
                await db.execute(
                    select(DocumentORM.id).where(
                        DocumentORM.course_id.in_(course_ids),
                        DocumentORM.doc_type == "material",
                        ~quiz_exists,
                    )
                )
            ).scalars().all()

            candidate_ids = list({*missing_quiz_ids, *new_material_doc_ids_for_auto})
            if candidate_ids:
                auto_quiz_doc_ids = candidate_ids
                background_tasks.add_task(_background_auto_generate_quizzes, candidate_ids, user_id)
                print(f"📋 Scheduled auto-quiz for {len(candidate_ids)} material document(s)")

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
        "auto_quiz": {
            "enabled": settings.AUTO_GENERATE_QUIZZES,
            "scheduled_doc_ids": auto_quiz_doc_ids,
            "total_scheduled": len(auto_quiz_doc_ids),
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