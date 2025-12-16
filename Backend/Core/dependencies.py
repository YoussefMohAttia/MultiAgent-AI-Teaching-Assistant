# Backend/Core/dependencies.py
"""
Shared dependencies for route protection and user retrieval.
"""
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from DB.session import get_db
from DB.schemas import User
from DB import crud


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    """
    Dependency to get the current authenticated user.
    Extracts user from JWT cookie set during login.
    """
    import jwt
    from Core.config import settings
    
    # Get JWT from cookie
    token = request.cookies.get("jwt_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated - please login first"
        )
    
    try:
        # Decode JWT
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        azure_id = payload.get("sub")
        if not azure_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token - missing user identifier"
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired - please login again"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    # Get user from database
    user = await crud.get_user_by_azure_id(db, azure_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in database"
        )
    
    return user


async def get_current_user_optional(request: Request, db: AsyncSession = Depends(get_db)) -> User | None:
    """
    Optional version - returns None if not authenticated instead of raising error.
    Useful for endpoints that work differently for logged-in vs anonymous users.
    """
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None
