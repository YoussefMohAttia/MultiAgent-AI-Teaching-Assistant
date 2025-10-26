from fastapi import FastAPI



from fastapi import FastAPI

from Routers import lms, courses, quizzes, posts, login, signup

app = FastAPI()

app.include_router(login.router, prefix="/login", tags=["Authentication"])


app.include_router(courses.router, prefix="/courses", tags=["Courses"])

app.include_router(posts.router, prefix="/courses/{student_id}/posts", tags=["Posts"])


@app.get("/")
async def root():
    return {"name":"Yousef"}
    

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
