from fastapi import FastAPI, Depends
from starlette.requests import Request

from Routers import login, courses, posts, quizzes
from Routers.login import msal_auth

app = FastAPI()

app.include_router(login.router, prefix="/login", tags=["Authentication"])
app.include_router(courses.router, prefix="/courses", tags=["Courses"])
app.include_router(posts.router, prefix="/posts", tags=["Posts"])
app.include_router(quizzes.router, tags=["Quizzes"])


@app.get("/")
async def root():
    return {"name": "Yousef"}


@app.get("/test-auth")
async def test_auth(request: Request):
    """Test endpoint to check if user is authenticated via MSAL"""
    is_authenticated = await msal_auth.check_authenticated_session(request)
    if is_authenticated:
        token = await msal_auth.get_session_token(request)
        return {
            "authenticated": True,
            "message": "User is authenticated",
            "token_present": token is not None,
            "user_email": token.id_token_claims.email if token and token.id_token_claims else None,
            "user_name": token.id_token_claims.name if token and token.id_token_claims else None
        }
    return {
        "authenticated": False,
        "message": "User is not authenticated. Please visit /login/_login_route to login."
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
    
