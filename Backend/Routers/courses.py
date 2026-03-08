# backend/Routers/courses.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from DB.session import get_db
from DB.schemas import Course, User, UserCourse
from Core.config import settings
import jwt as pyjwt

router = APIRouter()


async def _get_current_user(request: Request, db: AsyncSession) -> User:
    """Decode the Bearer JWT and return the matching DB user."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        google_id = payload.get("sub")
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# GET /courses — Courses owned by or enrolled in by the authenticated user
@router.get("/")
async def list_courses(request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)

    # Sub-query: course ids the user is enrolled in via UserCourse
    enrolled_ids_subq = select(UserCourse.course_id).where(UserCourse.user_id == user.id)

    stmt = select(Course).where(
        or_(
            Course.user_id == user.id,          # courses they own / created
            Course.id.in_(enrolled_ids_subq),   # courses they are enrolled in
        )
    )
    result = await db.execute(stmt)
    courses = result.scalars().all()
    return {
        "count": len(courses),
        "courses": [{"id": c.id, "title": c.title} for c in courses],
    }


# POST /courses — Create a new course owned by the authenticated user
@router.post("/")
async def create_course(request: Request, title: str, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)
    new_course = Course(title=title, user_id=user.id)
    db.add(new_course)
    await db.commit()
    await db.refresh(new_course)
    return {"message": "Course created!", "course": {"id": new_course.id, "title": new_course.title}}


# DELETE /courses/{course_id} — Delete a course (only if owned by the user)
@router.delete("/{course_id}")
async def delete_course(course_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_current_user(request, db)

    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalars().first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this course")

    await db.delete(course)
    await db.commit()
    return {"message": "Course deleted successfully", "deleted_course_id": course_id}