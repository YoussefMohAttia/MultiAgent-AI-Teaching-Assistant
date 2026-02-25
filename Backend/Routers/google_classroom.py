"""
Google Classroom sync router.
Mounted at: /api/sync

Endpoints:
  POST /api/sync/sync-courses          → sync courses only (existing)
  POST /api/sync/full-sync             → sync courses + materials + announcements + coursework
  GET  /api/sync/courses/{user_id}     → list synced courses for a user
  GET  /api/sync/documents/{course_id} → list synced documents for a course
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from DB.session import get_db
from DB import crud
from services.google_classroom_service import GoogleClassroomService
from Core.config import settings

router = APIRouter()
google_service = GoogleClassroomService()


# ─────────────────────────────────────────────
#Sync courses only
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
#Full sync — courses + all content
# ─────────────────────────────────────────────
@router.post("/full-sync")
async def full_sync(
    user_id: int,   # TODO: extract from JWT cookie in a later sprint
    db: AsyncSession = Depends(get_db)
):
    """
    Full sync of Google Classroom data for a user.

    Steps:
      1. Get valid access token (auto-refresh if expired)
      2. Sync all courses (upsert)
      3. For each course, sync in parallel:
           a. courseWorkMaterials  → doc_type = "material"
           b. announcements        → doc_type = "announcement"  (text stored in raw_text)
           c. courseWork           → doc_type = "coursework"    (Drive-attached only)
      4. Return full summary report

    All document syncs are SKIP-IF-EXISTS (idempotent).
    Re-running this endpoint will not duplicate data.
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
            courses_updated += 1
            synced_courses.append((existing.id, classroom_id))
        else:
            new_course = await crud.create_course(
                db=db, user_id=user_id, classroom_id=classroom_id, title=title
            )
            courses_new += 1
            synced_courses.append((new_course.id, classroom_id))

    # ── Step 3: Sync documents for each course ─────
    docs_materials = 0
    docs_announcements = 0
    docs_coursework = 0
    docs_skipped = 0

    for db_course_id, classroom_id in synced_courses:

        # ── 3a: Materials ──────────────────────────
        materials = await google_service.fetch_course_materials(classroom_id, access_token)
        for item in materials:
            material_id = item.get("id")
            if not material_id:
                continue

            # Skip if already in DB (idempotent)
            existing_doc = await crud.get_document_by_material_id(db, material_id)
            if existing_doc:
                docs_skipped += 1
                continue

            title = item.get("title", "Untitled Material")
            drive_url = google_service.extract_drive_url(item.get("materials", []))

            await crud.create_document(
                db=db,
                course_id=db_course_id,
                classroom_material_id=material_id,
                title=title,
                doc_type="material",
                google_drive_url=drive_url,
                raw_text=item.get("description")  # optional description text
            )
            docs_materials += 1

        # ── 3b: Announcements ──────────────────────
        announcements = await google_service.fetch_announcements(classroom_id, access_token)
        for item in announcements:
            material_id = item.get("id")
            if not material_id:
                continue

            existing_doc = await crud.get_document_by_material_id(db, material_id)
            if existing_doc:
                docs_skipped += 1
                continue

            # For announcements the text IS the content — use first 200 chars as title
            raw_text = item.get("text", "")
            title = raw_text[:200] if raw_text else "Untitled Announcement"
            drive_url = google_service.extract_drive_url(item.get("materials", []))

            await crud.create_document(
                db=db,
                course_id=db_course_id,
                classroom_material_id=material_id,
                title=title,
                doc_type="announcement",
                google_drive_url=drive_url,
                raw_text=raw_text   # full announcement text for AI RAG pipeline
            )
            docs_announcements += 1

        # ── 3c: Coursework (Drive-attached only) ───
        coursework = await google_service.fetch_coursework(classroom_id, access_token)
        for item in coursework:
            material_id = item.get("id")
            if not material_id:
                continue

            existing_doc = await crud.get_document_by_material_id(db, material_id)
            if existing_doc:
                docs_skipped += 1
                continue

            title = item.get("title", "Untitled Assignment")
            drive_url = google_service.extract_drive_url(item.get("materials", []))
            description = item.get("description", None)  # assignment instructions → raw_text

            await crud.create_document(
                db=db,
                course_id=db_course_id,
                classroom_material_id=material_id,
                title=title,
                doc_type="coursework",
                google_drive_url=drive_url,
                raw_text=description
            )
            docs_coursework += 1

    # ── Step 4: Return summary ─────────────────────
    total_docs_new = docs_materials + docs_announcements + docs_coursework

    return {
        "success": True,
        "message": "Full sync completed successfully",
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
        }
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