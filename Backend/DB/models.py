#pydantic models for request and response bodies
from pydantic import BaseModel, ConfigDict

from .session import Base

from typing import Any, List, Optional
from datetime import datetime, timedelta

class UserCreate(BaseModel):
    name: str
    email: str
    azure_id: str


class UserCourse(BaseModel):
    user_id: int
    course_id: int
class Course(BaseModel):
    id: int
    title: str
    model_config = ConfigDict(from_attributes=True)





class QuizQuestionBase(BaseModel):
    question: str
    type: str
    options: Optional[Any] = None  # stored as list[str] for AI-generated quizzes
    correct_answer: Optional[str] = None

class QuizQuestionCreate(QuizQuestionBase):
    pass

class QuizQuestionOut(QuizQuestionBase):
    id: int
    quiz_id: int
    model_config = ConfigDict(from_attributes=True)

class QuizBase(BaseModel):
    created_by: int

class QuizCreate(QuizBase):
    questions: List[QuizQuestionCreate]

class QuizOut(QuizBase):
    id: int
    course_id: int
    created_at: datetime
    questions: List[QuizQuestionOut]
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str
    message: Optional[str] = None

class ErrorResponse(BaseModel):
    error: str


# ---------------------------
# Gamification / Progress
# ---------------------------

class ProgressEvent(BaseModel):
    event_type: str
    amount: int = 1
    correct: Optional[int] = None
    total: Optional[int] = None


class AchievementProgress(BaseModel):
    key: str
    title: str
    goal: int
    progress: int
    completed: bool


class TaskProgress(BaseModel):
    key: str
    title: str
    description: Optional[str] = None
    goal: int
    progress: int
    xp_reward: int
    completed: bool


class LeaderboardEntry(BaseModel):
    user_id: int
    name: str
    xp: int
    level: int
    rank: str


class ProgressSummary(BaseModel):
    xp: int
    level: int
    rank: str
    next_level_xp: int
    level_progress: float
    day_streak: int
    totals: dict
    achievements: List[AchievementProgress]
    tasks: List[TaskProgress]
    leaderboard: List[LeaderboardEntry]