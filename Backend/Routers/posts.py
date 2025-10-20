#posts
from fastapi import APIRouter, Depends, HTTPException
from regex import P
from sqlalchemy.orm import Session
from sqlalchemy import insert
from typing import List

from DB.models import PostOut
from DB.session import get_db
from DB.schemas import  Post
router = APIRouter()




#url is /courses/{student_id}/posts/{subject_name}
@router.post("/{subject_name}",response_model=dict)
def create_post(student_id: int, subject_name: str, content: str, db: Session = Depends(get_db)):
    #get the subject_name and student_id from the path parameter
    db.add(Post(subject=subject_name, content=content, user_id=student_id))
    db.commit()
    return {"message": "Post created successfully"}


@router.get("/{subject_name}",response_model=List[PostOut])
def get_posts(subject_name: str, db: Session = Depends(get_db)):
    posts = db.query(Post).filter(Post.subject == subject_name).all()
    return posts
