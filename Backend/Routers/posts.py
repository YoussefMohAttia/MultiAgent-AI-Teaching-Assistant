#posts
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from DB.models import PostOut
from DB.session import get_db
from DB.schemas import Post

router = APIRouter()

# url is /courses/{student_id}/posts/{subject_name}
@router.post("/{subject_name}", response_model=dict)
def create_post(student_id: int, subject_name: str, content: str, db: Session = Depends(get_db)):
    new_post = Post(subject=subject_name, content=content, user_id=student_id)
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    return {"message": "Post created successfully", "id": new_post.id}


@router.get("/{subject_name}", response_model=List[PostOut])
def get_posts(student_id: int, subject_name: str, db: Session = Depends(get_db)):
    posts = db.query(Post).filter(Post.subject == subject_name).all()
    return posts
