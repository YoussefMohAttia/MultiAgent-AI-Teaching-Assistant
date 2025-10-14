from fastapi import HTTPException, status
from sqlalchemy.orm import Session
import typing as t

from . import models, schemas
from Core.security import get_password_hash, verify_password 
from .session import get_db

# class User(Base):
#     __tablename__ = "users"

#     id = Column(Integer, primary_key=True)
#     email = Column(String(255), unique=True, nullable=False)
#     name = Column(String(255))
#     role = Column(String(50))
#     created_at = Column(DateTime, default=datetime.utcnow)

#     # Relationships
#     lms_accounts = relationship("LMSAccount", back_populates="user")
#     posts = relationship("Post", back_populates="user")
#     comments = relationship("Comment", back_populates="user")
#     quizzes_created = relationship("Quiz", back_populates="creator")



def get_user(db: Session, user_id: int) -> models.User:
    user = db.query(schemas.User).filter(schemas.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user




def get_user_by_email(db: Session, email: str) -> models.User:
    return db.query(schemas.User).filter(schemas.User.email == email).first()


#                            Pydantic model
def create_user(db: Session, user: models.User):

    hashed_password = get_password_hash(user.password)
    db_user = schemas.User(
        name=user.first_name + " " + user.last_name,        
        email=user.email,
        password=hashed_password,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def delete_user(db: Session, user_id: int):
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    db.delete(user)
    db.commit()
    return user

