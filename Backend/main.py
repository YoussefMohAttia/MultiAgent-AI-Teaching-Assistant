from fastapi import FastAPI, Depends
from starlette.requests import Request
from starlette.middleware.sessions import SessionMiddleware

from Routers import login, courses, posts, quizzes , documents,comments
from Routers.login import google_auth
from DB.session import create_all_tables


app = FastAPI(title="MultiAgent AI Teaching Assistant")
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
        "azure_id": claims.get("sub"),
        "token": token
    }
