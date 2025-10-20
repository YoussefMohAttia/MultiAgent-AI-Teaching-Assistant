
from fastapi import APIRouter, Depends, HTTPException, status
from Core.security import authenticate_user, create_access_token
from sqlalchemy.orm import Session




from DB.session import get_db
from datetime import datetime

router = APIRouter()
@router.post("/")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = authenticate_user(email, password, db)
    if not user:
        raise HTTPException(status_code=401,detail="Invalid email or password")
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}