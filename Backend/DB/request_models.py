# Backend/DB/request_models.py
"""
Pydantic models for API request bodies.
These replace query parameters for POST/PUT endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional, List


# ---------------------------
# Course Request Models
# ---------------------------
class CourseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Course title")
    lms_id: Optional[str] = Field(None, max_length=255, description="LMS external ID")


class CourseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    lms_id: Optional[str] = Field(None, max_length=255)


# ---------------------------
# Post Request Models
# ---------------------------
class PostCreate(BaseModel):
    course_id: int = Field(..., description="ID of the course this post belongs to")
    subject: str = Field(..., min_length=1, max_length=255, description="Post subject/title")
    content: str = Field(..., min_length=1, description="Post content")


class PostUpdate(BaseModel):
    subject: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)


# ---------------------------
# Comment Request Models
# ---------------------------
class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, description="Comment content")


class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, description="Updated comment content")


# ---------------------------
# Document Request Models
# ---------------------------
class DocumentUpload(BaseModel):
    course_id: int = Field(..., description="ID of the course this document belongs to")
    title: Optional[str] = Field(None, max_length=255, description="Custom document title")
