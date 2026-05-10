# Backend/DB/crud.py
from passlib.context import CryptContext
from uuid import uuid4
from sqlalchemy import func
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from .schemas import Quiz, QuizQuestion, Course, UserCourse, User, Comment, Document, OTPVerification
from .models import QuizCreate
from datetime import datetime, timedelta, timezone
from services.google_token_services import refresh_google_token
from typing import Optional

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# ---------------------------
# USER OPERATIONS
# ---------------------------
async def get_user_by_google_id(db: AsyncSession, google_id: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.google_id == google_id))
    return result.scalars().first()


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    normalized_email = email.lower()
    result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
    return result.scalars().first()

async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalars().first()

async def create_new_user(
    db: AsyncSession,
    google_id: str,
    email: str,
    name: str,
    auth_provider: str = "google",
    password_hash: Optional[str] = None,
) -> User:
    new_user = User(
        google_id=google_id,
        email=email.lower(),
        name=name,
        auth_provider=auth_provider,
        password_hash=password_hash,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


async def create_local_user(db: AsyncSession, email: str, password: str, name: Optional[str] = None) -> User:
    existing_user = await get_user_by_email(db, email)
    if existing_user:
        raise ValueError("Email already registered")

    safe_name = name.strip() if name and name.strip() else email.split("@")[0].replace(".", " ").replace("_", " ").title()
    local_id = f"local_{uuid4().hex}"
    return await create_new_user(
        db=db,
        google_id=local_id,
        email=email.lower(),
        name=safe_name,
        auth_provider="local",
        password_hash=get_password_hash(password),
    )


async def authenticate_local_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    user = await get_user_by_email(db, email.lower())
    if not user or not user.password_hash:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


# ---------------------------
# OTP OPERATIONS
# ---------------------------

async def create_otp(db: AsyncSession, email: str, otp_code: str, expiration_minutes: int = 10) -> OTPVerification:
    """Create or update OTP for email verification."""
    normalized_email = email.lower()
    existing = await db.execute(
        select(OTPVerification).where(OTPVerification.email == normalized_email)
    )
    otp_record = existing.scalars().first()
    
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expiration_minutes)
    
    if otp_record:
        otp_record.otp_code = otp_code
        otp_record.created_at = datetime.now(timezone.utc)
        otp_record.expires_at = expires_at
        otp_record.is_verified = 0
        otp_record.attempts = 0
    else:
        otp_record = OTPVerification(
            email=normalized_email,
            otp_code=otp_code,
            expires_at=expires_at,
            is_verified=0,
            attempts=0
        )
        db.add(otp_record)
    
    await db.commit()
    await db.refresh(otp_record)
    return otp_record


async def verify_otp(db: AsyncSession, email: str, otp_code: str) -> bool:
    """Verify OTP code. Returns True if valid, False otherwise."""
    normalized_email = email.lower()
    result = await db.execute(
        select(OTPVerification).where(OTPVerification.email == normalized_email)
    )
    otp_record = result.scalars().first()
    
    if not otp_record:
        return False
    
    # Check expiration
    if datetime.now(timezone.utc) > otp_record.expires_at:
        return False
    
    # Check attempts (max 5)
    if otp_record.attempts >= 5:
        return False
    
    # Increment attempts
    otp_record.attempts += 1
    await db.commit()
    
    # Check code
    if otp_record.otp_code != otp_code.strip():
        return False
    
    # Mark as verified
    otp_record.is_verified = 1
    await db.commit()
    return True


async def get_verified_otp(db: AsyncSession, email: str) -> Optional[OTPVerification]:
    """Get verified OTP record for email."""
    normalized_email = email.lower()
    result = await db.execute(
        select(OTPVerification).where(
            (OTPVerification.email == normalized_email) &
            (OTPVerification.is_verified == 1) &
            (OTPVerification.expires_at > datetime.now(timezone.utc))
        )
    )
    return result.scalars().first()


async def delete_otp(db: AsyncSession, email: str) -> None:
    """Delete OTP record after account creation."""
    normalized_email = email.lower()
    result = await db.execute(
        select(OTPVerification).where(OTPVerification.email == normalized_email)
    )
    otp_record = result.scalars().first()
    if otp_record:
        await db.delete(otp_record)
        await db.commit()


# ---------------------------
# COURSES & ENROLLMENT OPERATIONS
# ---------------------------
async def get_course_by_title(db: AsyncSession, title: str) -> Optional[Course]:
    result = await db.execute(select(Course).where(Course.title == title))
    return result.scalars().first()

async def get_course_by_classroom_id(db: AsyncSession, classroom_id: str) -> Optional[Course]:
    result = await db.execute(select(Course).where(Course.classroom_id == classroom_id))
    return result.scalars().first()

async def get_course_by_id(db: AsyncSession, course_id: int) -> Optional[Course]:
    result = await db.execute(select(Course).where(Course.id == course_id))
    return result.scalars().first()

async def create_course(db: AsyncSession, classroom_id: str, title: str) -> Course:
    new_course = Course(classroom_id=classroom_id, title=title)
    db.add(new_course)
    await db.commit()
    await db.refresh(new_course)
    return new_course

async def update_course(db: AsyncSession, course: Course, title: str) -> Course:
    course.title = title
    await db.commit()
    await db.refresh(course)
    return course

async def link_user_to_course(db: AsyncSession, user_id: int, course_id: int):
    result = await db.execute(
        select(UserCourse).where(UserCourse.user_id == user_id).where(UserCourse.course_id == course_id)
    )
    if not result.scalars().first():
        db.add(UserCourse(user_id=user_id, course_id=course_id))
        await db.commit()

async def get_user_courses(db: AsyncSession, user_id: int):
    stmt = (
        select(Course)
        .join(UserCourse, Course.id == UserCourse.course_id)
        .where(UserCourse.user_id == user_id)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


# ---------------------------
# DOCUMENT PIPELINE OPERATIONS
# ---------------------------
async def get_document_by_material_id(db: AsyncSession, classroom_material_id: str) -> Optional[Document]:
    """Look up a document by its Google Classroom material ID for idempotent syncing."""
    result = await db.execute(
        select(Document).where(Document.classroom_material_id == classroom_material_id)
    )
    return result.scalars().first()

async def create_document(
    db: AsyncSession,
    course_id: int,
    classroom_material_id: Optional[str] = None,
    title: str = "Untitled",
    doc_type: Optional[str] = None,       # "material" | "announcement" | "coursework" | "manual_upload"
    google_drive_url: Optional[str] = None,
    s3_path: Optional[str] = None,
    raw_text: Optional[str] = None,
    due_date: Optional[datetime] = None
) -> Document:
    """Create a new document row from either a sync or a manual upload."""
    new_doc = Document(
        course_id=course_id,
        classroom_material_id=classroom_material_id,
        title=title,
        doc_type=doc_type,
        google_drive_url=google_drive_url,
        s3_path=s3_path,
        raw_text=raw_text,
        due_date=due_date
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)
    return new_doc

async def get_documents_by_course_id(db: AsyncSession, course_id: int):
    """Get all documents for a course."""
    result = await db.execute(
        select(Document).where(Document.course_id == course_id)
    )
    return result.scalars().all()


# ---------------------------
# COMMENT OPERATIONS
# ---------------------------

async def get_document_comments(db: AsyncSession, doc_id: int):
    result = await db.execute(
        select(Comment).where(Comment.doc_id == doc_id).order_by(Comment.created_at)
    )
    return result.scalars().all()




# ---------------------------
# QUIZZES OPERATIONS
# ---------------------------
async def get_quizzes_by_course_id(db: AsyncSession, course_id: int):
    result = await db.execute(
        select(Quiz)
        .options(selectinload(Quiz.questions))
        .where(Quiz.course_id == course_id)
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
        print(f"  User {user_id} not found or has no refresh token")
        return None
    if is_token_valid(user):
        print(f"  Token for user {user_id} is still valid")
        return user.google_access_token
        
    token_data = await refresh_google_token(
        refresh_token=user.google_refresh_token,
        client_id=client_id,
        client_secret=client_secret
    )
    if not token_data:
        print(f"  Token refresh failed for user {user_id}")
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
    user.google_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
    await db.commit()
    await db.refresh(user)
    return user

def is_token_valid(user: User) -> bool:
    if not user.google_access_token:
        return False
    if not user.google_token_expires_at:
        return False
    # Compare as naive UTC datetimes (SQLite stores naive)
    expires = user.google_token_expires_at.replace(tzinfo=None) if user.google_token_expires_at.tzinfo else user.google_token_expires_at
    return expires > datetime.utcnow()