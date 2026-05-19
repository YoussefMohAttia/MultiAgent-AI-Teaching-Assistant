# Routers/quizzes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from DB.session import get_db
from DB.models import QuizOut, QuizCreate
from DB import crud

router = APIRouter()

@router.get("/course/{course_id}", response_model=List[QuizOut])
async def get_quizzes_by_course(
    course_id: int,
    db: AsyncSession = Depends(get_db)
):
    quizzes = await crud.get_quizzes_by_course_id(db=db, course_id=course_id)
    payload = []
    for quiz in quizzes:
        doc = None
        if getattr(quiz, "document_links", None):
            for link in quiz.document_links:
                if link.document:
                    doc = link.document
                    break
        base = QuizOut.model_validate(quiz).model_dump()
        base["document_id"] = doc.id if doc else None
        base["document_title"] = doc.title if doc else None
        payload.append(base)
    return payload

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
    payload = []
    for quiz in quizzes:
        doc = None
        if getattr(quiz, "document_links", None):
            for link in quiz.document_links:
                if link.document:
                    doc = link.document
                    break
        base = QuizOut.model_validate(quiz).model_dump()
        base["document_id"] = doc.id if doc else None
        base["document_title"] = doc.title if doc else None
        payload.append(base)
    return payload

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