from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from DB.session import get_db
from DB.schemas import Comment, User
from DB.request_models import CommentCreate, CommentUpdate
from DB.crud import get_comments_by_post_id, add_comment_to_post, edit_comment, delete_comment
from Core.dependencies import get_current_user

router = APIRouter()


# GET /comments/post/{post_id} — List all comments for a post
@router.get("/post/{post_id}")
async def list_comments_for_post(post_id: int, db: AsyncSession = Depends(get_db)):
    comments = await get_comments_by_post_id(db, post_id)
    
    return {
        "count": len(comments),
        "comments": [
            {
                "id": c.id,
                "content": c.content,
                "user_id": c.user_id,
                "created_at": c.created_at.isoformat() if c.created_at else None
            } for c in comments
        ]
    }


# POST /comments/post/{post_id} — Add a comment to a post (protected)
@router.post("/post/{post_id}")
async def add_comment(
    post_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_comment = await add_comment_to_post(db, post_id, current_user.id, comment_data.content)
    return {
        "message": "Comment added!",
        "comment_id": new_comment.id,
        "post_id": post_id,
        "author": current_user.name,
        "created_at": new_comment.created_at.isoformat() if new_comment.created_at else None
    }


# PUT /comments/{comment_id} — Edit a comment (protected, owner only)
@router.put("/{comment_id}")
async def edit_comment_endpoint(
    comment_id: int,
    comment_data: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    updated_comment = await edit_comment(db, comment_id, current_user.id, comment_data.content)
    if updated_comment is None:
        raise HTTPException(status_code=404, detail="Comment not found or you don't have permission to edit it")
    return {
        "message": "Comment edited!",
        "comment_id": updated_comment.id,
        "content": updated_comment.content
    }


# DELETE /comments/{comment_id} — Delete a comment (protected, owner only)
@router.delete("/{comment_id}")
async def delete_comment_endpoint(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    deleted_comment = await delete_comment(db, comment_id, current_user.id)
    if deleted_comment is None:
        raise HTTPException(status_code=404, detail="Comment not found or you don't have permission to delete it")
    return {
        "message": "Comment deleted!",
        "comment_id": deleted_comment.id
    }