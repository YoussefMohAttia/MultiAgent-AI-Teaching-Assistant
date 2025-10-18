#pydantic models for request and response bodies


from pydantic import BaseModel
from sympy import use

from .session import Base

from typing import List, Optional
from datetime import datetime, timedelta



class User(BaseModel):
    name: str
    email: str
    password: str
    role: str
    created_at: datetime

class PostCreate(BaseModel):
    user_id: int
    subjectName: str
    content: str



class PostOut(BaseModel):
    id: int
    subject: str
    content: str
    user_id: int
    created_at: datetime

    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str
    message: Optional[str] = None

class ErrorResponse(BaseModel):
    error: str