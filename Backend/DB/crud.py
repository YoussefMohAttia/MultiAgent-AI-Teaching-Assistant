from fastapi import HTTPException, status
from sqlalchemy.orm import Session
import typing as t

from . import models, schemas

from .session import get_db
from DB.schemas import User
from DB.models import UserCreate


from datetime import datetime, timedelta

from fastapi import Depends


def get_user_by_email(email: str, db: Session):
    user = db.query(User).filter(User.email == email).first()
    return user


#                 Pydantic model
def create_user(user: UserCreate, db: Session):
    from Core.security import hash_password, create_access_token
    hashed_password = hash_password(user.password)
    new_user = User(
        name=user.name,
        email=user.email,
        password=hashed_password,
        role=user.role,
        created_at=datetime.utcnow()
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    access_token = create_access_token(data={"sub": new_user.email})
    return {"message": "User created successfully", "access_token": access_token}