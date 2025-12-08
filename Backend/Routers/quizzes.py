# Routers/quizzes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from DB.session import get_db
from DB.models import QuizOut, QuizCreate
from DB import crud

router = APIRouter()

@router.get("/{subject_name}/quizzes", response_model=List[QuizOut])
async def get_quizzes_by_subject(
    subject_name: str, 
    db: AsyncSession = Depends(get_db)
):
    # 1. Logic: Get Course ID first
    course = await crud.get_course_by_title(db=db, title=subject_name)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # 2. Logic: Get Quizzes
    quizzes = await crud.get_quizzes_by_course_id(db=db, course_id=course.id)
    return quizzes

@router.post("/{subject_name}/quizzes", response_model=QuizOut)
async def create_quiz_for_subject(
    subject_name: str, 
    quiz: QuizCreate, 
    db: AsyncSession = Depends(get_db)
):
    # 1. Logic: Get Course ID
    course = await crud.get_course_by_title(db=db, title=subject_name)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # 2. Logic: Create Quiz
    db_quiz = await crud.create_new_quiz(
        db=db, 
        course_id=course.id, 
        quiz_data=quiz
    )
    return db_quiz