from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel



from starlette.config import Config
import psycopg2
import os

from DB.models import User, Post, Token, ErrorResponse
from datetime import datetime, timedelta
from Core.security import *



from fastapi import FastAPI

from Routers import users , lms, courses, quizzes, posts

app = FastAPI()

app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(lms.router, prefix="/lms", tags=["LMS"])
app.include_router(courses.router, prefix="/courses", tags=["Courses"])
app.include_router(quizzes.router, prefix="/quizzes", tags=["Quizzes"])
app.include_router(posts.router, prefix="/posts", tags=["Posts"])




# def get_db_connection():
#     return psycopg2.connect(
#         dbname="Ai_Teaching_Assistant",
#         user="postgres",
#         password=os.getenv("DB_PASSWORD", "your_password"),
#         host="localhost"
#     )


    
# FastAPI app setup
# app = FastAPI()
# templates = Jinja2Templates(directory="templates")



# SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
# ALGORITHM = "HS256"
# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# # JWT functions


# # Routes
# @app.get("/")
# async def login_page(request: Request):
#     return templates.TemplateResponse("login.html", {"request": request})

# @app.get("/signup")
# async def signup_page(request: Request):
#     return templates.TemplateResponse("signup.html", {"request": request})

# @app.get("/login")
# async def login_page_get(request: Request):
#     return templates.TemplateResponse("login.html", {"request": request})



# @app.post("/login", response_model=Token | ErrorResponse)
# async def login(user: User):
#     with get_db_connection() as conn:
#         with conn.cursor() as cur:
#             cur.execute("SELECT email, password FROM Users WHERE email = %s", (user.email,))
#             result = cur.fetchone()
            
#             if not result:
#                 return ErrorResponse(error="Invalid credentials")
            
#             db_email, db_password = result
#             if db_email == user.email and db_password == user.password:
#                 access_token = create_access_token({"sub": user.email})
#                 return Token(access_token=access_token, token_type="bearer", message="Login successful")
            
#             return ErrorResponse(error="Invalid credentials")

# @app.post("/signup", response_model=dict)
# async def signup(user: User):
#     with get_db_connection() as conn:
#         with conn.cursor() as cur:
#             cur.execute("SELECT email FROM Users WHERE email = %s", (user.email,))
#             if cur.fetchone():
#                 return {"error": "User already exists, please login"}
            
#             try:
#                 cur.execute(
#                     "INSERT INTO Users (name, email, password, role, created_at) VALUES (%s, %s, %s, %s, %s)",
#                     (user.name, user.email, user.password, user.role, user.created_at)
#                 )
#                 conn.commit()
#                 return {"message": "User created successfully"}
#             except Exception as e:
#                 conn.rollback()
#                 raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user")

# @app.post("/subjects/posts", response_model=dict)
# async def create_post(post: Post, current_user: dict = Depends(get_current_user)):
#     with get_db_connection() as conn:
#         with conn.cursor() as cur:
#             try:
#                 cur.execute(
#                     "SELECT id FROM Users WHERE email = %s",
#                     (current_user["email"],)
#                 )
                
#                 user_id = cur.fetchone()
#                 if not user_id:
#                     raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
                
#                 cur.execute(
#                     "INSERT INTO Posts (subject, title, content, user_id, created_at) VALUES (%s, %s, %s, %s, %s)",
#                     (post.subjectName, post.title, post.content, user_id[0], datetime.utcnow())
#                 )
#                 conn.commit()
#                 return {"message": "Post created successfully"}
#             except Exception as e:
#                 conn.rollback()
#                 raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create post")

# @app.get("/subjects/{subjectId}/posts")
# async def get_posts(subjectId: str):
#     with get_db_connection() as conn:
#         with conn.cursor() as cur:
#             cur.execute("SELECT * FROM Posts WHERE subject = %s", (subjectId,))
#             posts = cur.fetchall()
#             return {"posts": posts}
