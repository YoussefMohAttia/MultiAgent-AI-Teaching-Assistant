#courses
from fastapi import APIRouter, Depends, HTTPException
from regex import P
from sqlalchemy.orm import Session
from sqlalchemy import insert, select
from typing import List


from DB.session import get_db
from DB.models import  UserCourse, Course
router = APIRouter()

# to get student's courses based on student_id
@router.get("/{{student_id}}",response_model=dict)
def get_subjects(student_id: int, db: Session = Depends(get_db)):
    user_courses = db.query(UserCourse).filter(UserCourse.user_id == student_id).all()


    query  = select( Course.title).select_from(UserCourse).join(Course, user_courses.course_id == Course.id)
    result = db.execute(query)
    courses = [row[0] for row in result.fetchall()]
    return {"courses": courses}


