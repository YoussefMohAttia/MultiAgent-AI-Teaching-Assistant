"""
Reusable FastAPI dependency for JWT-based authentication.

Reads the `jwt_token` cookie set by the Google OAuth flow and
extracts the user claims (sub, email, name).
"""

from typing import Optional

import jwt
from fastapi import Cookie, Depends, HTTPException, status

from Core.config import settings


class CurrentUser:
    """Simple container for the authenticated user's claims."""

    def __init__(self, sub: str, email: str, name: str):
        self.sub = sub          # Google ID
        self.email = email
        self.name = name

    def __repr__(self) -> str:
        return f"<CurrentUser {self.email}>"


async def get_current_user(jwt_token: Optional[str] = Cookie(None)) -> CurrentUser:
    """
    FastAPI dependency — extracts and validates the JWT from the cookie.

    Raises 401 if the token is missing, expired, or invalid.
    """
    if not jwt_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated — jwt_token cookie missing",
        )
    try:
        payload = jwt.decode(jwt_token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired — please log in again",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    return CurrentUser(
        sub=payload.get("sub", ""),
        email=payload.get("email", ""),
        name=payload.get("name", ""),
    )


async def get_optional_user(jwt_token: Optional[str] = Cookie(None)) -> Optional[CurrentUser]:
    """
    Like get_current_user but returns None instead of 401 when not authenticated.
    Useful during development / testing.
    """
    if not jwt_token:
        return None
    try:
        payload = jwt.decode(jwt_token, settings.SECRET_KEY, algorithms=["HS256"])
        return CurrentUser(
            sub=payload.get("sub", ""),
            email=payload.get("email", ""),
            name=payload.get("name", ""),
        )
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
