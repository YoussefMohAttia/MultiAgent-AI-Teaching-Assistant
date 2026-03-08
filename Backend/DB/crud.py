# DB/crud.py
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from .schemas import Post, Quiz, QuizQuestion, Course, UserCourse, User, Comment, Document
from .models import QuizCreate
from datetime import datetime, timedelta, timezone
from services.google_token_services import refresh_google_token
from typing import Optional

# ---------------------------
# USER OPERATIONS
# ---------------------------
async def get_user_by_google_id(db: AsyncSession, google_id: str) -> User:
    result = await db.execute(select(User).where(User.google_id == google_id))
    return result.scalars().first()


async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalars().first()


async def create_new_user(db: AsyncSession, google_id: str, email: str, name: str) -> User:
    new_user = User(google_id=google_id, email=email, name=name)
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
    result = await db.execute(select(Post).filter(Post.subject == subject))
    return result.scalars().all()

# ---------------------------
# COURSES OPERATIONS
# ---------------------------
async def get_course_by_title(db: AsyncSession, title: str) -> Course:
    result = await db.execute(select(Course).filter(Course.title == title))
    return result.scalars().first()


async def get_student_courses(db: AsyncSession, student_id: int):
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
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .filter(Quiz.course_id == course_id)
    )
    return result.scalars().all()


async def create_new_quiz(db: AsyncSession, course_id: int, quiz_data: QuizCreate) -> Quiz:
    db_quiz = Quiz(course_id=course_id, created_by=quiz_data.created_by)
    db.add(db_quiz)
    await db.commit()
    await db.refresh(db_quiz)

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
    result = await db.execute(select(Comment).filter(Comment.post_id == post_id))
    return result.scalars().all()


async def edit_comment(db: AsyncSession, comment_id: int, user_id: int, new_content: str):
    result = await db.execute(select(Comment).filter(Comment.id == comment_id))
    comment = result.scalars().first()
    if not comment or comment.user_id != user_id:
        return None
    comment.content = new_content
    await db.commit()
    await db.refresh(comment)
    return comment


async def delete_comment(db: AsyncSession, comment_id: int, user_id: int):
    result = await db.execute(select(Comment).filter(Comment.id == comment_id))
    comment = result.scalars().first()
    if not comment or comment.user_id != user_id:
        return None
    await db.delete(comment)
    await db.commit()
    return comment

# ---------------------------
# GOOGLE TOKEN OPERATIONS
# ---------------------------
async def get_valid_access_token(
    db: AsyncSession,
    user_id: int,
    client_id: str,
    client_secret: str
) -> Optional[str]:
    user = await get_user_by_id(db, user_id)
    if not user or not user.google_refresh_token:
        print(f"❌ User {user_id} not found or has no refresh token")
        return None
    if is_token_valid(user):
        print(f"✅ Token for user {user_id} is still valid")
        return user.google_access_token
    token_data = await refresh_google_token(
        refresh_token=user.google_refresh_token,
        client_id=client_id,
        client_secret=client_secret
    )
    if not token_data:
        print(f"❌ Token refresh failed for user {user_id}")
        return None
    await update_user_access_token(
        db=db,
        user=user,
        access_token=token_data["access_token"],
        expires_in=token_data["expires_in"]
    )
    return token_data["access_token"]


async def update_user_access_token(
    db: AsyncSession, user: User, access_token: str, expires_in: int
) -> User:
    user.google_access_token = access_token
    user.google_token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    await db.commit()
    await db.refresh(user)
    return user


def is_token_valid(user: User) -> bool:
    if not user.google_access_token:
        return False
    if not user.google_token_expires_at:
        return False
    return user.google_token_expires_at > datetime.now(timezone.utc)

# ---------------------------
# GOOGLE CLASSROOM SYNC — COURSES
# ---------------------------
async def get_course_by_classroom_id(db: AsyncSession, classroom_id: str) -> Optional[Course]:
    result = await db.execute(select(Course).filter(Course.classroom_id == classroom_id))
    return result.scalars().first()


async def get_course_by_id(db: AsyncSession, course_id: int) -> Optional[Course]:
    result = await db.execute(select(Course).filter(Course.id == course_id))
    return result.scalars().first()


async def create_course(db: AsyncSession, user_id: int, classroom_id: str, title: str) -> Course:
    new_course = Course(classroom_id=classroom_id, title=title, user_id=user_id)
    db.add(new_course)
    await db.commit()
    await db.refresh(new_course)
    return new_course


async def update_course(db: AsyncSession, course: Course, title: str) -> Course:
    course.title = title
    await db.commit()
    await db.refresh(course)
    return course


async def get_user_courses(db: AsyncSession, user_id: int):
    result = await db.execute(select(Course).filter(Course.user_id == user_id))
    return result.scalars().all()

# ---------------------------
# GOOGLE CLASSROOM SYNC — DOCUMENTS
# ---------------------------
async def get_document_by_material_id(
    db: AsyncSession,
    classroom_material_id: str
) -> Optional[Document]:
    """
    Look up a document by its Google Classroom material ID.
    Used for the skip-if-exists (idempotent) sync strategy.
    """
    result = await db.execute(
        select(Document).filter(Document.classroom_material_id == classroom_material_id)
    )
    return result.scalars().first()


async def create_document(
    db: AsyncSession,
    course_id: int,
    classroom_material_id: str,
    title: str,
    doc_type: str,                      # "material" | "announcement" | "coursework"
    google_drive_url: Optional[str] = None,
    raw_text: Optional[str] = None      # populated for announcements & assignment descriptions
) -> Document:
    """
    Create a new document row from a synced Google Classroom item.
    Called only when the item does NOT already exist in the DB.
    """
    new_doc = Document(
        course_id=course_id,
        classroom_material_id=classroom_material_id,
        title=title,
        doc_type=doc_type,
        google_drive_url=google_drive_url,
        raw_text=raw_text
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)
    return new_doc


async def get_documents_by_course_id(db: AsyncSession, course_id: int):
    """Get all documents for a course — used by frontend listing endpoints."""
    result = await db.execute(
        select(Document).filter(Document.course_id == course_id)
    )
    return result.scalars().all()