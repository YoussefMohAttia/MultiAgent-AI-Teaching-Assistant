from sqlalchemy. ext.declarative import declarative_base
from datetime import datetime
from sqlalchemy. sql import func
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Boolean,
    Enum,
    JSON
)
from sqlalchemy.orm import relationship

Base = declarative_base()

# ---------------------------
# User and User Courses
# ---------------------------
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    google_id = Column(String(255), unique=True, index=True)
    email = Column(String(255), unique=True, index=True)
    name = Column(String(255))
    
    # Google OAuth Tokens
    google_access_token = Column(Text, nullable=True)
    google_refresh_token = Column(Text, nullable=True)
    google_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    courses = relationship("Course", back_populates="user", cascade="all, delete-orphan")
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="user", cascade="all, delete-orphan")  # ← ADD
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")
    quizzes_created = relationship("Quiz", back_populates="creator")  # ← ADD


class UserCourse(Base):
    __tablename__ = "user_courses"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), primary_key=True)


# ---------------------------
# Courses and Documents
# ---------------------------
class Course(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    classroom_id = Column(String(255), unique=True, index=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="courses")
    documents = relationship("Document", back_populates="course", cascade="all, delete-orphan")
    posts = relationship("Post", back_populates="course", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="course", cascade="all, delete-orphan")

    class Config:
        from_attributes = True


class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    classroom_material_id = Column(String(255), index=True)
    title = Column(String(255), nullable=False)
    google_drive_url = Column(String(500), nullable=True)
    s3_path = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    course = relationship("Course", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")  # ← ADD

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
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")  # ← ADD if QuizAttempt exists


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
# Posts & Comments
# ---------------------------
class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True)
    subject = Column(String(255))
    content = Column(Text)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    author = relationship("User", back_populates="posts")  # ← CHANGED from 'user' to 'author'
    course = relationship("Course", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")

    class Config:
        from_attributes = True


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    post = relationship("Post", back_populates="comments")
    user = relationship("User", back_populates="comments")

    class Config:
        from_attributes = True