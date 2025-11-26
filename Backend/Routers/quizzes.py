#quizzes
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from DB.session import get_db
from DB.schemas import Quiz, QuizQuestion, Course
from DB.models import QuizOut, QuizCreate

router = APIRouter()

@router.get("/{subject_name}/quizzes", response_model=List[QuizOut])
def get_quizzes_by_subject(subject_name: str, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.title == subject_name).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    quizzes = db.query(Quiz).filter(Quiz.course_id == course.id).all()
    return quizzes

@router.post("/{subject_name}/quizzes", response_model=QuizOut)
def create_quiz_for_subject(subject_name: str, quiz: QuizCreate, db: Session = Depends(get_db)):
    course = db.query(Course).filter(Course.title == subject_name).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    
    db_quiz = Quiz(course_id=course.id, created_by=quiz.created_by)
    db.add(db_quiz)
    db.commit()
    db.refresh(db_quiz)

    
    for q in quiz.questions:
        db_question = QuizQuestion(
            quiz_id=db_quiz.id,
            question=q.question,
            type=q.type,
            options=q.options,
            correct_answer=q.correct_answer
        )
        db.add(db_question)
    
    db.commit()
    db.refresh(db_quiz)
    return db_quiz
