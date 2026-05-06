from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from DB.session import get_db
from DB.schemas import Comment
from DB.crud import get_document_comments
router = APIRouter()
# GET /comments/post/{post_id} — List all comments for a post
@router.get("/post/{doc_id}")
async def list_comments_for_post(doc_id: int, db: AsyncSession = Depends(get_db)):
    comments = await get_document_comments(db, doc_id)
    
    return {
        "count": len(comments),
        "comments": [{"id": c.id, "content": c.content, "created_at": c.created_at} for c in comments]
    }
