#pydantic models for request and response bodies


from pydantic import BaseModel

from .session import Base

from typing import List, Optional
from datetime import datetime, timedelta



class User(BaseModel):
    name: str
    email: str
    password: str
    role: str
    created_at: datetime

class Post(BaseModel):
    title: str
    subjectName: str
    content: str

class Token(BaseModel):
    access_token: str
    token_type: str
    message: Optional[str] = None

class ErrorResponse(BaseModel):
    error: str