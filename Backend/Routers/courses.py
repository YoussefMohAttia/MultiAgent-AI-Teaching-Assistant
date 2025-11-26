#courses
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from DB.session import get_db
from DB.schemas import UserCourse, Course
from DB.models import Course as CourseModel

router = APIRouter()

# to get student's courses based on student_id  56
@router.get("/{student_id}", response_model=List[CourseModel])
def get_subjects(student_id: int, db: Session = Depends(get_db)):
    courses = db.query(Course).join(UserCourse, Course.id == UserCourse.course_id).filter(UserCourse.user_id == student_id).all()
    return courses


