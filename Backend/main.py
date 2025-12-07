from fastapi import FastAPI, Depends
from starlette.requests import Request
from starlette.middleware.sessions import SessionMiddleware

from Routers import login, courses, posts, quizzes
from Routers.login import msal_auth
from DB.session import create_all_tables


app = FastAPI(title="MultiAgent AI Teaching Assistant")
app.add_middleware(SessionMiddleware, secret_key="super-secret-change-in-production-123456")
@app.on_event("startup")
async def startup_event():
    print("Creating database tables from schemas.py ...")
    await create_all_tables()
    print("All tables created successfully!")

app.include_router(login.router, prefix="/login", tags=["Authentication"])
app.include_router(courses.router, prefix="/courses", tags=["Courses"])
app.include_router(posts.router, prefix="/posts", tags=["Posts"])
app.include_router(quizzes.router, tags=["Quizzes"])


@app.get("/")
async def root():
    return {"name": "Yousef"}


@app.get("/test-auth")
async def test_auth(request: Request):
    is_authenticated = await msal_auth.check_authenticated_session(request)
    if not is_authenticated:
        return {"authenticated": False, "message": "Not logged in"}

    token = await msal_auth.get_session_token(request)
    if not token or not token.id_token_claims:
        return {"authenticated": True, "message": "Logged in but no claims"}

    claims = token.id_token_claims.__dict__  # this is how your wrapper stores it

    return {
        "authenticated": True,
        "message": "You are fully logged in!",
        "user_email": claims.get("preferred_username") or claims.get("email"),
        "user_name": claims.get("display_name"), 
        "azure_id": claims.get("sub"),
        "raw_claims": claims,
        "token": token
    }


# @app.get("/protected-example")
# async def protected_example(request: Request, token: str = Depends(msal_auth.scheme)):
#     """Example of a protected route that requires authentication"""
#     auth_token = await msal_auth.get_session_token(request)
#     return {
#         "message": "You have access to this protected route!",
#         "user_email": auth_token.id_token_claims.email if auth_token and auth_token.id_token_claims else None,
#         "user_name": auth_token.id_token_claims.name if auth_token and auth_token.id_token_claims else None
#     }