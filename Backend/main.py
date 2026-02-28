import traceback

import jwt as pyjwt
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from Core.config import settings

from Routers import login, courses, posts, quizzes , documents,comments,google_classroom
from Routers.login import google_auth
from DB.session import create_all_tables, get_db
from DB.schemas import User as UserModel
from DB import crud
from datetime import datetime, timedelta


app = FastAPI(title="MultiAgent AI Teaching Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SessionMiddleware, secret_key="super-secret-change-in-production-123456")
@app.on_event("startup")
async def startup_event():
    print("Creating database tables from schemas.py ...")
    await create_all_tables()
    print("All tables created successfully!")

app.include_router(login.router, prefix="/api/login", tags=["Authentication"])
app.include_router(courses.router, prefix="/api/courses", tags=["Courses"])
app.include_router(posts.router, prefix="/api/posts", tags=["Posts"])
app.include_router(quizzes.router, tags=["Quizzes"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(comments.router, prefix="/api/comments", tags=["Comments"])
app.include_router(google_classroom.router,prefix="/api/sync",tags=["Google Classroom"]) 
@app.get("/")
async def root():
    return {"name": "Yousef"}


@app.get("/test-auth")
async def test_auth(request: Request):
    is_authenticated = await google_auth.check_authenticated_session(request)
    if not is_authenticated:
        return {"authenticated": False, "message": "Not logged in"}
    token = await google_auth.get_session_token(request)
    if not token or not token.id_token_claims:
        return {"authenticated": True, "message": "Logged in but no claims"}
    claims = token.id_token_claims.__dict__  # this is how your wrapper stores it
    return {
        "authenticated": True,
        "message": "You are fully logged in 55555555!",
        "user_email":claims.get("email"),
        "user_name": claims.get("name"), 
        "google_id": claims.get("sub"),
        "token": token
    }


@app.get("/api/me")
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        google_id = payload.get("sub")
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(UserModel).where(UserModel.google_id == google_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "sub": user.google_id,
    }


@app.post("/api/login/dev-bypass")
async def dev_bypass(email: str = "demo@student.edu", db: AsyncSession = Depends(get_db)):
    """Dev-only bypass: find or create a user by email and return a JWT."""
    result = await db.execute(select(UserModel).where(UserModel.email == email))
    user = result.scalars().first()
    if not user:
        safe_id = f"dev_{email.replace('@', '_').replace('.', '_')}"
        user = await crud.create_new_user(
            db,
            google_id=safe_id,
            email=email,
            name=email.split("@")[0].replace(".", " ").title(),
        )

    jwt_token = pyjwt.encode(
        {
            "sub": user.google_id,
            "email": user.email,
            "name": user.name,
            "exp": datetime.utcnow() + timedelta(days=30),
        },
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    return {"access_token": jwt_token, "token_type": "bearer"}
