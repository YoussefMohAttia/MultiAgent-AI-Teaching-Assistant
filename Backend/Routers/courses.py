# Routers/courses.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from DB.session import get_db
from DB.models import Course as CourseModel
from DB import crud

router = APIRouter()

@router.get("/{student_id}", response_model=List[CourseModel])
async def get_subjects(
    student_id: int, 
    db: AsyncSession = Depends(get_db)
):
    courses = await crud.get_student_courses(db=db, student_id=student_id)
    return courses