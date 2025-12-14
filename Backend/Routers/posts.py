# backend/Routers/posts.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from DB.session import get_db
from DB.schemas import Post, User, Course
from datetime import datetime

router = APIRouter()

# POST /posts — Create a post (in a course)
@router.post("/")
async def create_post(
    request: Request,
    course_id: int,
    subject: str,
    content: str,
    db: AsyncSession = Depends(get_db)
):
    # Optional: protect with login later
    # user = request.state.user
    # if not user: raise HTTPException(401)

    # Hardcode user_id = 1 for now (your account)
    user_id = 1  # ← change later when auth is connected

    # Check if course exists
    course_check = await db.execute(select(Course).where(Course.id == course_id))
    if not course_check.scalars().first():
        raise HTTPException(404, "Course not found")

    new_post = Post(
        subject=subject,
        content=content,
        user_id=user_id,
        course_id=course_id,
        created_at=datetime.utcnow()
    )
    db.add(new_post)
    await db.commit()
    await db.refresh(new_post)

    return {
        "message": "Post created!",
        "post_id": new_post.id,
        "subject": new_post.subject,
        "course_id": course_id
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