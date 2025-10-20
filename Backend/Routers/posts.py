#posts
from fastapi import APIRouter, Depends, HTTPException
from regex import P
from sqlalchemy.orm import Session
from sqlalchemy import insert
from typing import List

from ..DB.models import  PostOut
from ..DB.session import get_db
from ..DB.schemas import Post
router = APIRouter()



# class PostCreate(BaseModel):
#     user_id: int
#     subjectName: str
#     content: str



# class PostOut(BaseModel):
#     id: int
#     subject: str
#     content: str
#     user_id: int
#     created_at: datetime

#     class Config:
#         orm_mode = True

# class Post(Base):
#     __tablename__ = "posts"

#     id = Column(Integer, primary_key=True)
#     subject = Column(String(255))
#     content = Column(Text)
#     user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
#     created_at = Column(DateTime, default=datetime.utcnow)

#     # Relationships
#     user = relationship("User", back_populates="posts")
#     comments = relationship("Comment", back_populates="post")




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
