#pydantic models for request and response bodies
from pydantic import BaseModel, ConfigDict

from .session import Base

from typing import Any, List, Optional
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
    model_config = ConfigDict(from_attributes=True)



class PostOut(BaseModel):
    id: int
    subject: str
    content: str
    user_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class QuizQuestionBase(BaseModel):
    question: str
    type: str
    options: Optional[Any] = None  # stored as list[str] for AI-generated quizzes
    correct_answer: Optional[str] = None

class QuizQuestionCreate(QuizQuestionBase):
    pass

class QuizQuestionOut(QuizQuestionBase):
    id: int
    quiz_id: int
    model_config = ConfigDict(from_attributes=True)

class QuizBase(BaseModel):
    created_by: int

class QuizCreate(QuizBase):
    questions: List[QuizQuestionCreate]

class QuizOut(QuizBase):
    id: int
    course_id: int
    created_at: datetime
    questions: List[QuizQuestionOut]
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str
    message: Optional[str] = None

class ErrorResponse(BaseModel):
    error: str