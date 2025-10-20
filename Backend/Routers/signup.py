
from fastapi import APIRouter, Depends, HTTPException, status
from ..Core.security import authenticate_user, create_access_token, pwd_context
from sqlalchemy.orm import Session
from ..DB.models import UserCreate
from ..DB.schemas import User
from ..DB.session import get_db
from datetime import datetime
from  ..DB.crud import get_user, create_user

router = APIRouter()


@router.post("/")
def signup(user: UserCreate):
    # Check if user already exists in the db
    
    existing_user = get_user(user.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    return create_user(user) #user is created successfully
