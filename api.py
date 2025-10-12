from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from jose import jwt, JWTError
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
import psycopg2
import os

# Database connection
def get_db_connection():
    return psycopg2.connect(
        dbname="Ai_Teaching_Assistant",
        user="postgres",
        password=os.getenv("DB_PASSWORD", "your_password"),
        host="localhost"
    )

# Pydantic models
class User(BaseModel):
    name: str
    email: str
    password: str
    role: str
    created_at: datetime

class Post(BaseModel):
    title: str
    subjectName: str
    content: str

class Token(BaseModel):
    access_token: str
    token_type: str
    message: Optional[str] = None

class ErrorResponse(BaseModel):
    error: str
    
# FastAPI app setup
app = FastAPI()
templates = Jinja2Templates(directory="templates")

# OAuth2 and JWT setup
config = Config(".env")
oauth = OAuth(config)
oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# JWT functions
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {"email": email}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

# Routes
@app.get("/")
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/signup")
async def signup_page(request: Request):
    return templates.TemplateResponse("signup.html", {"request": request})

@app.get("/login")
async def login_page_get(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/login/google")
async def login_google(request: Request):
    redirect_uri = request.url_for("auth_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get("/auth/callback")
async def auth_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get("userinfo")
        if not user_info:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to get user info from Google")
        
        access_token = create_access_token({"sub": user_info["email"]})
        return JSONResponse({"access_token": access_token, "user": user_info})
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@app.post("/login", response_model=Token | ErrorResponse)
async def login(user: User):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT email, password FROM Users WHERE email = %s", (user.email,))
            result = cur.fetchone()
            
            if not result:
                return ErrorResponse(error="Invalid credentials")
            
            db_email, db_password = result
            if db_email == user.email and db_password == user.password:
                access_token = create_access_token({"sub": user.email})
                return Token(access_token=access_token, token_type="bearer", message="Login successful")
            
            return ErrorResponse(error="Invalid credentials")

@app.post("/signup", response_model=dict)
async def signup(user: User):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT email FROM Users WHERE email = %s", (user.email,))
            if cur.fetchone():
                return {"error": "User already exists, please login"}
            
            try:
                cur.execute(
                    "INSERT INTO Users (name, email, password, role, created_at) VALUES (%s, %s, %s, %s, %s)",
                    (user.name, user.email, user.password, user.role, user.created_at)
                )
                conn.commit()
                return {"message": "User created successfully"}
            except Exception as e:
                conn.rollback()
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user")

@app.post("/subjects/posts", response_model=dict)
async def create_post(post: Post, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    "SELECT id FROM Users WHERE email = %s",
                    (current_user["email"],)
                )
                user_id = cur.fetchone()
                if not user_id:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
                
                cur.execute(
                    "INSERT INTO Posts (subject, title, content, user_id, created_at) VALUES (%s, %s, %s, %s, %s)",
                    (post.subjectName, post.title, post.content, user_id[0], datetime.utcnow())
                )
                conn.commit()
                return {"message": "Post created successfully"}
            except Exception as e:
                conn.rollback()
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create post")

@app.get("/subjects/{subjectId}/posts")
async def get_posts(subjectId: str):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM Posts WHERE subject = %s", (subjectId,))
            posts = cur.fetchall()
            return {"posts": posts}