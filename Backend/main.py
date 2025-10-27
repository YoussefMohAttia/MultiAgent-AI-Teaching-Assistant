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
    
