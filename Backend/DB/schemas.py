
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
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
# User and Teams Account
# ---------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    azure_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    teams_accounts = relationship("TeamsAccount", back_populates="user")
    posts = relationship("Post", back_populates="user")
    comments = relationship("Comment", back_populates="user")
    quizzes_created = relationship("Quiz", back_populates="creator")


class UserCourse(Base):
    __tablename__ = "user_courses"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), primary_key=True)


class TeamsAccount(Base):
    __tablename__ = "teams_accounts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    encrypted_refresh_token = Column(Text)
    access_token_expiry = Column(DateTime)
    status = Column(String(50), default="active")

    # Relationships
    user = relationship("User", back_populates="teams_accounts")


# ---------------------------
# Courses and Documents
# ---------------------------
class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True)
    lms_id = Column(String(255))
    title = Column(String(255), nullable=False)

    # Relationships
    documents = relationship("Document", back_populates="course")
    quizzes = relationship("Quiz", back_populates="course")
    posts = relationship("Post", back_populates="course") # le nafs elsabab 


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    type = Column(String(50))
    title = Column(String(255))
    s3_path = Column(String(500))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    lms_source_id = Column(String(255))

    # Relationships
    course = relationship("Course", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True)
    doc_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    sequence_number = Column(Integer)
    text = Column(Text)

    # Relationships
    document = relationship("Document", back_populates="chunks")
    summary_links = relationship("SummaryChunk", back_populates="chunk")


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
    chunks = relationship("SummaryChunk", back_populates="summary")


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
    questions = relationship("QuizQuestion", back_populates="quiz")


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


# ---------------------------
# Posts & Comments
# ---------------------------
class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True)
    subject = Column(String(255))
    content = Column(Text)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False) # zawedto 3shan a3ml route ygeb all posts for a course
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="posts")
    course = relationship("Course", back_populates="posts") # le nafs elsabab
    comments = relationship("Comment", back_populates="post")

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

