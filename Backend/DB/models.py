#pydantic models for request and response bodies
from pydantic import BaseModel

from .session import Base

from typing import List, Optional
from datetime import datetime, timedelta

class UserCreate(BaseModel):
    name: str
    email: str
    azure_id: str


class UserCourse(BaseModel):
    user_id: int
    course_id: int
class Course(BaseModel):
    id: int
    title: str

    class Config:
        orm_mode = True



class PostOut(BaseModel):
    id: int
    subject: str
    content: str
    user_id: int
    created_at: datetime

    class Config:
        orm_mode = True

class QuizQuestionBase(BaseModel):
    question: str
    type: str
    options: Optional[dict] = None
    correct_answer: Optional[str] = None

class QuizQuestionCreate(QuizQuestionBase):
    pass

class QuizQuestionOut(QuizQuestionBase):
    id: int
    quiz_id: int

    class Config:
        orm_mode = True

class QuizBase(BaseModel):
    created_by: int

class QuizCreate(QuizBase):
    questions: List[QuizQuestionCreate]

class QuizOut(QuizBase):
    id: int
    course_id: int
    created_at: datetime
    questions: List[QuizQuestionOut]

    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str
    message: Optional[str] = None

class ErrorResponse(BaseModel):
    error: str