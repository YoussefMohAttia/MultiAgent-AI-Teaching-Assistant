# User (id, email, name, role, created_at)
# LMSAccount (id, user_id, platform, encrypted_refresh_token, access_token_expiry, status)
# Course (id, lms_id, title, platform)
# Document (id, course_id, type, title, s3_path, uploaded_at, lms_source_id)
# Chunk (id, doc_id, sequence_number, text)

# Summary (id, text, method, created_at)
# SummaryChunk (summary_id, chunk_id)

# Quiz (id, course_id, created_at, created_by)
# QuizQuestion (id, quiz_id, question, type, options, correct_answer)

# Post (id, subject, content, user_id, created_at)
# Comment (id, post_id, user_id, content, created_at)





from email.mime import base
from re import sub
from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.templating import Jinja2Templates

from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from jose import JWTError, jwt
from datetime import datetime, timedelta




#use conn to create cursors, commit transactions, or roll back changes.

#A cur is used to execute SQL queries and fetch results from the database.
import psycopg2


conn = psycopg2.connect(
    dbname="Ai_Teaching_Assistant",
    user="postgres",
    password="your_password",
    host="localhost"
)

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



app = FastAPI()

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


templates = Jinja2Templates(directory="templates")


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"username": username}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/")
def login_page(request: Request):
    #change this flask to fastapi
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/signup")
def signup_page(request: Request):
    return templates.TemplateResponse("signup.html", {"request": request})

@app.get("/login")
def login_page_get(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


#The body of the HTTP request (JSON) will be automatically parsed into an user object.
@app.post("/login")
def login(user: User):
    # Validating credentials
    cur = conn.cursor()
    cur.execute("SELECT email, password FROM Users WHERE email = %s AND password = %s", (user.email, user.password))
    
    rows = cur.fetchall()
    if len(rows) == 0:
        return {"error": "Invalid credentials"}
    else:

        db_email, db_password = rows[0]
        if db_email == user.email and db_password == user.password:


            access_token = create_access_token(data={"sub": user.email})
            return {"access_token": access_token, "token_type": "bearer","message": "Login successful"}
            
        else:
            return {"error": "Invalid credentials"}
        
@app.post("/signup")
def signup(user: User):
    # Check if user already exists
    cur = conn.cursor()
    cur.execute("SELECT email FROM Users WHERE email = %s", (user.email,))
    if cur.fetchone():
        return {"error": "User already exists click on login"}
    
    # Inserting a  new user
    cur.execute("INSERT INTO Users (name, email, password, role, created_at) VALUES (%s, %s, %s, %s, %s)", 
                (user.name, user.email, user.password, user.role, user.created_at))
    conn.commit()
    return {"message": "User is created ssuccessfully"}

@app.post(f"/subjects/posts")
def create_post(post: Post, current_user: dict = Depends(get_current_user)):

    # Post (id, subject, title, content, user_id, created_at)
    #json =>{}
    cur = conn.cursor()
    cur.execute("INSERT INTO Posts (subject,title, content, user_id, created_at) VALUES (%s, %s, %s, %s)", 
                (post.subjectName, post.title, post.content, current_user['user_id'], datetime.utcnow()))
    conn.commit()
    return {"message": "Post created successfully"}

#get posts under a subject 
@app.get(f"/subjects/{subjectId}/posts")
def get_posts(subjectId: str):
    cur = conn.cursor()
    cur.execute("SELECT * FROM Posts WHERE subject = %s", (subjectId,))
    posts = cur.fetchall()
    return {"posts": posts}



