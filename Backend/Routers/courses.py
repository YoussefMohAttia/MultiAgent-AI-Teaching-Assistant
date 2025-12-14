# backend/Routers/courses.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from DB.session import get_db
from DB.schemas import Course

router = APIRouter()

# GET /courses — List all courses
@router.get("/")
async def list_courses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Course))
    courses = result.scalars().all()
    return {
        "count": len(courses),
        "courses": [{"id": c.id, "title": c.title} for c in courses]
    }

# POST /courses — Create a new course
@router.post("/")
async def create_course(title: str, db: AsyncSession = Depends(get_db)):
    new_course = Course(title=title)
    db.add(new_course)
    await db.commit()
    await db.refresh(new_course)
    return {"message": "Course created!", "course": {"id": new_course.id, "title": new_course.title}}

# DELETE /courses/{course_id} — Delete a course
@router.delete("/{course_id}")
async def delete_course(course_id: int, db: AsyncSession = Depends(get_db)):
    # Find the course
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalars().first()
    
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    await db.delete(course)
    await db.commit()
    
    return {"message": "Course deleted successfully", "deleted_course_id": course_id}