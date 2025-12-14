# DB/crud.py
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from .schemas import Post, Quiz, QuizQuestion, Course, UserCourse,User,Comment
from .models import QuizCreate
from datetime import datetime


# ---------------------------
# USER OPERATIONS (Add this section)
# ---------------------------
async def get_user_by_azure_id(db: AsyncSession, azure_id: str) -> User | None:
    """
    Check if a user exists based on their Microsoft ID.
    """
    result = await db.execute(select(User).filter(User.azure_id == azure_id))
    return result.scalars().first()

async def create_new_user(db: AsyncSession, azure_id: str, email: str, name: str) -> User:
    """
    Register a new user from Microsoft login data.
    """
    new_user = User(
        azure_id=azure_id, 
        email=email, 
        name=name, 
        created_at=datetime.utcnow()
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

# ---------------------------
# POSTS OPERATIONS
# ---------------------------
async def create_new_post(db: AsyncSession, subject: str, content: str, user_id: int) -> Post:
    new_post = Post(subject=subject, content=content, user_id=user_id)
    db.add(new_post)
    await db.commit()
    await db.refresh(new_post)
    return new_post

async def get_posts_by_subject(db: AsyncSession, subject: str):
    # We filter by the subject column
    result = await db.execute(select(Post).filter(Post.subject == subject))
    return result.scalars().all()

# ---------------------------
# COURSES OPERATIONS
# ---------------------------
async def get_course_by_title(db: AsyncSession, title: str) -> Course:
    result = await db.execute(select(Course).filter(Course.title == title))
    return result.scalars().first()

async def get_student_courses(db: AsyncSession, student_id: int):
    # Joins Course and UserCourse to find what the student is enrolled in
    stmt = (
        select(Course)
        .join(UserCourse, Course.id == UserCourse.course_id)
        .filter(UserCourse.user_id == student_id)
    )
    result = await db.execute(stmt)
    return result.scalars().all()

# ---------------------------
# QUIZZES OPERATIONS
# ---------------------------
async def get_quizzes_by_course_id(db: AsyncSession, course_id: int):
    # We use selectinload to fetch the questions along with the quiz if needed
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .filter(Quiz.course_id == course_id)
    )
    return result.scalars().all()

async def create_new_quiz(db: AsyncSession, course_id: int, quiz_data: QuizCreate) -> Quiz:
    # 1. Create the Quiz Parent
    db_quiz = Quiz(course_id=course_id, created_by=quiz_data.created_by)
    db.add(db_quiz)
    await db.commit()
    await db.refresh(db_quiz)

    # 2. Create the Questions
    for q in quiz_data.questions:
        db_question = QuizQuestion(
            quiz_id=db_quiz.id,
            question=q.question,
            type=q.type,
            options=q.options,
            correct_answer=q.correct_answer
        )
        db.add(db_question)
    
    await db.commit()
    # Refresh to load the questions back into the object for the response
    await db.refresh(db_quiz, attribute_names=["questions"])
    return db_quiz

# ---------------------------
# COMMENTS OPERATIONS
# ---------------------------

async def add_comment_to_post(db: AsyncSession, post_id: int, user_id: int, content: str):
    new_comment = Comment(post_id=post_id, user_id=user_id, content=content)
    db.add(new_comment)
    await db.commit()
    await db.refresh(new_comment)
    return new_comment
async def get_comments_by_post_id(db: AsyncSession, post_id: int):
    result = await db.execute(
        select(Comment).filter(Comment.post_id == post_id)
    )
    return result.scalars().all()
async def edit_comment(db: AsyncSession, comment_id: int, user_id: int,new_content: str):
    result = await db.execute(select(Comment).filter(Comment.id == comment_id))
    comment = result.scalars().first()
    if not comment:
        return None
    if comment.user_id != user_id:
        return None
    
    if comment:
        comment.content = new_content
        await db.commit()
        await db.refresh(comment)
    return comment
async def delete_comment(db: AsyncSession, comment_id: int,user_id: int):
    result = await db.execute(select(Comment).filter(Comment.id == comment_id))
    comment = result.scalars().first()
    if not comment:
        return None
    if comment.user_id != user_id:
        return None
    
    if comment:
        await db.delete(comment)
        await db.commit()
    return comment