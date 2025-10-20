
from fastapi import APIRouter, Depends, HTTPException, status
from ..Core.security import authenticate_user, create_access_token, pwd_context
from sqlalchemy.orm import Session
from ..DB.models import UserCreate
from ..DB.schemas import User
from ..DB.session import get_db
from datetime import datetime

router = APIRouter()
@router.post("/")
def login(email: str, password: str):

    user = authenticate_user(email, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    access_token = create_access_token(data={"sub": user["email"]})
    return {"access_token": access_token, "token_type": "bearer"}