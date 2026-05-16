# Backend/DB/schemas.py
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from sqlalchemy.sql import func
from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    Text,
    DateTime,
    Date,
    ForeignKey,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    google_id = Column(String(255), unique=True, index=True)
    email = Column(String(255), unique=True, index=True)
    name = Column(String(255))
    auth_provider = Column(String(50), nullable=False, default="google")
    password_hash = Column(String(255), nullable=True)
    google_access_token = Column(Text, nullable=True)
    google_refresh_token = Column(Text, nullable=True)
    google_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    courses = relationship("Course", secondary="user_courses", back_populates="users")
    
    # ⚡ Removed posts relationship
    comments = relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")
    quizzes_created = relationship("Quiz", back_populates="creator")
    progress = relationship("UserProgress", back_populates="user", uselist=False, cascade="all, delete-orphan")
    tasks = relationship("UserTask", back_populates="user", cascade="all, delete-orphan")

# ⚡ Restored exactly as you had it
class OTPVerification(Base):
    __tablename__ = "otp_verifications"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    otp_code = Column(String(6), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_verified = Column(Integer, default=0)  # 0 = not verified, 1 = verified
    attempts = Column(Integer, default=0)

class UserCourse(Base):
    __tablename__ = "user_courses"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), primary_key=True)

class Course(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(String(255), unique=True, index=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    users = relationship("User", secondary="user_courses", back_populates="courses")
    
    documents = relationship("Document", back_populates="course", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="course", cascade="all, delete-orphan")
    # ⚡ Removed posts relationship
    
    class Config:
        from_attributes = True

class Document(Base):
    __tablename__ = "documents"
    """
    The Universal Content Container.
    Handles Materials, Announcements, Assignments, and raw Posts.
    """
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    
    # Google Classroom Identifiers
    classroom_material_id = Column(String(255), index=True, nullable=True)
    
    # Content Data
    title = Column(String(255), nullable=False)
    google_drive_url = Column(String(500), nullable=True)
    s3_path = Column(String(500), nullable=True)
    
    # Classification: "material", "announcement", "coursework", "manual_upload"
    doc_type = Column(String(50), nullable=True, index=True)
    
    # Text Content (Captions, Instructions, Announcement body)
    raw_text = Column(Text, nullable=True)
    
    # ⚡ NEW: Added due_date for assignments (coursework)
    due_date = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    course = relationship("Course", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")
    
    # ⚡ NEW: Comments are now linked directly to the Document pipeline
    comments = relationship("Comment", back_populates="document", cascade="all, delete-orphan")
    quiz_links = relationship("QuizDocument", back_populates="document", cascade="all, delete-orphan")
    
    class Config:
        from_attributes = True

# ⚡ UPDATED: Comment Table Refactored
class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True)
    
    # Changed from post_id to doc_id
    doc_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    
    # Added Classroom ID to prevent syncing duplicates
    classroom_comment_id = Column(String(255), unique=True, index=True)
    
    content = Column(Text)
    
    # We remove user_id FK requirement and store raw data from Google Classroom
    # (Kept user_id optional just in case a native platform user comments later)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    author_name = Column(String(255))
    author_photo_url = Column(String(500))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    document = relationship("Document", back_populates="comments")
    user = relationship("User", back_populates="comments")
    
    class Config:
        from_attributes = True

class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(Integer, primary_key=True)
    doc_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    sequence_number = Column(Integer)
    text = Column(Text)
    
    # Relationships
    document = relationship("Document", back_populates="chunks")
    summary_links = relationship("SummaryChunk", back_populates="chunk", cascade="all, delete-orphan")

# ---------------------------
# Summaries
# ---------------------------
class Summary(Base):
    __tablename__ = "summaries"
    id = Column(Integer, primary_key=True)
    text = Column(Text)
    method = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    chunks = relationship("SummaryChunk", back_populates="summary", cascade="all, delete-orphan")

class SummaryChunk(Base):
    __tablename__ = "summary_chunks"
    summary_id = Column(Integer, ForeignKey("summaries.id"), primary_key=True)
    chunk_id = Column(Integer, ForeignKey("chunks.id"), primary_key=True)
    summary = relationship("Summary", back_populates="chunks")
    chunk = relationship("Chunk", back_populates="summary_links")

# ---------------------------
# Evaluations
# ---------------------------
class Evaluation(Base):
    __tablename__ = "evaluations"
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    student_summary = Column(Text, nullable=False)
    lecture_text = Column(Text, nullable=True)
    overall_score = Column(Float, nullable=False)
    overall_feedback = Column(Text, nullable=True)
    method = Column(String(100), default="hybrid")
    created_at = Column(DateTime, default=datetime.utcnow)
    metrics = relationship("EvaluationMetric", back_populates="evaluation", cascade="all, delete-orphan")

class EvaluationMetric(Base):
    __tablename__ = "evaluation_metrics"
    id = Column(Integer, primary_key=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), nullable=False)
    metric_name = Column(String(100), nullable=False)
    score = Column(Float, nullable=False)
    feedback = Column(Text, nullable=True)
    evaluation = relationship("Evaluation", back_populates="metrics")

# ---------------------------
# Quizzes
# ---------------------------
class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"))
    
    # Relationships
    course = relationship("Course", back_populates="quizzes")
    creator = relationship("User", back_populates="quizzes_created")
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")
    document_links = relationship("QuizDocument", back_populates="quiz", cascade="all, delete-orphan")

class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    id = Column(Integer, primary_key=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    question = Column(Text, nullable=False)
    type = Column(String(50))
    options = Column(JSON)
    correct_answer = Column(String(255))
    
    # Relationships
    quiz = relationship("Quiz", back_populates="questions")

class QuizDocument(Base):
    __tablename__ = "quiz_documents"
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), primary_key=True)
    doc_id = Column(Integer, ForeignKey("documents.id"), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    quiz = relationship("Quiz", back_populates="document_links")
    document = relationship("Document", back_populates="quiz_links")

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id = Column(Integer, primary_key=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Integer)
    completed_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    quiz = relationship("Quiz", back_populates="attempts")
    user = relationship("User", back_populates="quiz_attempts")

# ---------------------------
# Gamification / Progress
# ---------------------------
class UserProgress(Base):
    __tablename__ = "user_progress"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    xp = Column(Integer, nullable=False, default=0)
    level = Column(Integer, nullable=False, default=1)
    rank_title = Column(String(50), nullable=False, default="Rookie")
    day_streak = Column(Integer, nullable=False, default=1)
    last_active_date = Column(Date, nullable=True)

    summaries = Column(Integer, nullable=False, default=0)
    quizzes_generated = Column(Integer, nullable=False, default=0)
    quizzes_taken = Column(Integer, nullable=False, default=0)
    quiz_correct = Column(Integer, nullable=False, default=0)
    pomodoro_cycles = Column(Integer, nullable=False, default=0)
    chats = Column(Integer, nullable=False, default=0)
    essays = Column(Integer, nullable=False, default=0)
    evaluations = Column(Integer, nullable=False, default=0)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="progress")


class UserTask(Base):
    __tablename__ = "user_tasks"
    __table_args__ = (
        UniqueConstraint("user_id", "task_key", "cycle_start", name="ux_user_task_cycle"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    task_key = Column(String(100), index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    goal = Column(Integer, nullable=False, default=1)
    progress = Column(Integer, nullable=False, default=0)
    xp_reward = Column(Integer, nullable=False, default=0)
    metric_key = Column(String(50), nullable=False)
    cycle = Column(String(20), nullable=False, default="daily")
    cycle_start = Column(Date, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="tasks")