# backend/Routers/posts.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime

from DB.session import get_db
from DB.schemas import Post, User, Course
from DB.request_models import PostCreate
from Core.dependencies import get_current_user

router = APIRouter()


# POST /posts — Create a post (protected)
@router.post("/")
async def create_post(
    post_data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if course exists
    course_check = await db.execute(select(Course).where(Course.id == post_data.course_id))
    if not course_check.scalars().first():
        raise HTTPException(status_code=404, detail="Course not found")

    new_post = Post(
        subject=post_data.subject,
        content=post_data.content,
        user_id=current_user.id,
        course_id=post_data.course_id,
        created_at=datetime.utcnow()
    )
    db.add(new_post)
    await db.commit()
    await db.refresh(new_post)

    return {
        "message": "Post created!",
        "post_id": new_post.id,
        "subject": new_post.subject,
        "course_id": post_data.course_id,
        "author": current_user.name
    }

# GET /posts — All posts
@router.get("/")
async def get_all_posts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Post).order_by(Post.created_at.desc()))
    posts = result.scalars().all()
    return {
        "count": len(posts),
        "posts": [
            {
                "id": p.id,
                "subject": p.subject,
                "content": p.content[:100] + "..." if p.content else "",
                "user_id": p.user_id,
                "course_id": p.course_id,
                "created_at": p.created_at.isoformat()
            } for p in posts
        ]
    }

# GET /posts/user/{user_id} — Posts by user
@router.get("/user/{user_id}")
async def get_posts_by_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Post).where(Post.user_id == user_id).order_by(Post.created_at.desc())
    )
    posts = result.scalars().all()
    return {"count": len(posts), "posts": [p.id for p in posts]}

# GET /posts/course/{course_id} — Posts by course (NOW WORKS!)
@router.get("/course/{course_id}")
async def get_posts_by_course(course_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Post).where(Post.course_id == course_id).order_by(Post.created_at.desc())
    )
    posts = result.scalars().all()
    return {
        "course_id": course_id,
        "count": len(posts),
        "posts": [
            {
                "id": p.id,
                "subject": p.subject,
                "content": p.content,
                "user_id": p.user_id,
                "created_at": p.created_at.isoformat()
            } for p in posts
        ]
    }