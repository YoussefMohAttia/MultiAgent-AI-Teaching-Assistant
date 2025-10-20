from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from datetime import datetime, timedelta

from DB.session import get_db
from sqlalchemy.orm import Session

from DB.crud import get_user_by_email



# ======================================================
# BASIC SETUP
# ======================================================

SECRET_KEY = "keep-it-secret-keep-it-safe"  
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")



# ======================================================
# HELPER FUNCTIONS
# ======================================================





def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if entered password matches the hashed one."""
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password :str):
    hashed_password =pwd_context.hash(password)
    return hashed_password



def authenticate_user(email: str, password: str, db: Session):
    """Authenticate user credentials."""
    
    user = get_user_by_email(email, db)
    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Create JWT token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Decode JWT token and return the user."""
    from ..DB.crud import get_user_by_email
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no email found"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    user = get_user_by_email(email, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user

# ======================================================
# ROUTES
# ======================================================
