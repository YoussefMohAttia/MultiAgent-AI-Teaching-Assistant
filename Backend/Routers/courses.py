# backend/Routers/courses.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from DB.session import get_db
from DB.schemas import Course, User
from DB.request_models import CourseCreate
from Core.dependencies import get_current_user

router = APIRouter()


# GET /courses — List all courses
@router.get("/")
async def list_courses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Course))
    courses = result.scalars().all()
    return {
        "count": len(courses),
        "courses": [{"id": c.id, "title": c.title, "lms_id": c.lms_id} for c in courses]
    }


# POST /courses — Create a new course (protected)
@router.post("/")
async def create_course(
    course_data: CourseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_course = Course(title=course_data.title, lms_id=course_data.lms_id)
    db.add(new_course)
    await db.commit()
    await db.refresh(new_course)
    return {
        "message": "Course created!",
        "course": {"id": new_course.id, "title": new_course.title},
        "created_by": current_user.email
    }

# DELETE /courses/{course_id} — Delete a course (protected)
@router.delete("/{course_id}")
async def delete_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Find the course
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalars().first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    await db.delete(course)
    await db.commit()
    
    return {
        "message": "Course deleted successfully",
        "deleted_course_id": course_id,
        "deleted_by": current_user.email
    }