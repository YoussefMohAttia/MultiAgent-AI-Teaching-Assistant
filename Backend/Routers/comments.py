from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from DB.session import get_db
from DB.schemas import Comment
from DB.crud import get_comments_by_post_id,add_comment_to_post,edit_comment,delete_comment
router = APIRouter()
# GET /comments/post/{post_id} — List all comments for a post
@router.get("/post/{post_id}")
async def list_comments_for_post(post_id: int, db: AsyncSession = Depends(get_db)):
    comments = await get_comments_by_post_id(db, post_id)
    
    return {
        "count": len(comments),
        "comments": [{"id": c.id, "content": c.content, "user_id": c.user_id, "created_at": c.created_at} for c in comments]
    }
# POST /comments/post/{post_id} — Add a comment to a post
@router.post("/post/{post_id}")
async def add_comment(
    post_id: int,
    content: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # Optional: protect with login later
    # user = request.state.user
    # if not user: raise HTTPException(401)
    # Hardcode user_id = 1 for now (your account)
    user_id = 1  # ← change later when auth is connected
    new_comment = await add_comment_to_post(db, post_id, user_id, content)
    return {
        "message": "Comment added!",
        "comment_id": new_comment.id,
        "post_id": post_id,
        "created_at": new_comment.created_at
    }
# PUT /comments/{comment_id} — Edit a comment
@router.put("/{comment_id}")
async def edit_comment_endpoint(
    comment_id: int,
    content: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # Optional: protect with login later
    # user = request.state.user
    # if not user: raise HTTPException(401)
    # Hardcode user_id = 1 for now (your account)
    user_id = 1  # ← change later when auth is connected
    updated_comment = await edit_comment(db, comment_id, user_id, content)
    if updated_comment is None:
        raise HTTPException(404, "Comment not found or unauthorized")
    return {
        "message": "Comment edited!",
        "comment_id": updated_comment.id,
        "updated_at": updated_comment.created_at
    }
# DELETE /comments/{comment_id} — Delete a comment
@router.delete("/{comment_id}")
async def delete_comment_endpoint(
    comment_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # Optional: protect with login later
    # user = request.state.user
    # if not user: raise HTTPException(401)
    # Hardcode user_id = 1 for now (your account)
    user_id = 1  # ← change later when auth is connected
    deleted_comment = await delete_comment(db, comment_id, user_id)
    if deleted_comment is None:
        raise HTTPException(404, "Comment not found or unauthorized")
    return {
        "message": "Comment deleted!",
        "comment_id": deleted_comment.id
    }