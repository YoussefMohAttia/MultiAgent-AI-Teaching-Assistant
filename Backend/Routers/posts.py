# Routers/posts.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from DB.models import PostOut
from DB.session import get_db
from DB import crud  

router = APIRouter()

@router.post("/{subject_name}", response_model=dict)
async def create_post(student_id: int, subject_name: str, content: str, db: AsyncSession = Depends(get_db)):
    new_post = await crud.create_new_post(
        db=db, 
        subject=subject_name, 
        content=content, 
        user_id=student_id
    )
    return {"message": "Post created successfully", "id": new_post.id}


@router.get("/{subject_name}", response_model=List[PostOut])
async def get_posts(subject_name: str, db: AsyncSession = Depends(get_db)):
    posts = await crud.get_posts_by_subject(db=db, subject=subject_name)
    return posts