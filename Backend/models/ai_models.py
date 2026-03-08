"""
Pydantic models (request / response bodies) for the AI endpoints.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional


# ── Chatbot ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    course_id: int
    question: str
    conversation_id: str = "default"


class SourceSnippet(BaseModel):
    page: Optional[int] = None
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceSnippet] = []


# ── Quiz Generation ──────────────────────────────────────────────────────────

class QuizGenerateRequest(BaseModel):
    """Generate quiz questions from raw text or a document in a course."""
    text: Optional[str] = None
    document_id: Optional[int] = None
    course_id: Optional[int] = None
    objectives: Optional[List[str]] = None
    n_items: int = Field(default=5, ge=1, le=20)
    n_options: int = Field(default=4, ge=2, le=6)


class QuizItem(BaseModel):
    stem: str
    options: List[str]
    answer_index: int


class QuizGenerateResponse(BaseModel):
    items: List[QuizItem]


# ── Summarization ────────────────────────────────────────────────────────────

class SummarizeRequest(BaseModel):
    """Summarise raw text or a document already uploaded to a course."""
    text: Optional[str] = None
    document_id: Optional[int] = None


class SummarizeResponse(BaseModel):
    summary: str


# ── Evaluation ───────────────────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    """Evaluate a student's summary against a lecture / document."""
    student_summary: str
    lecture_text: Optional[str] = None
    document_id: Optional[int] = None
    reference_summary: Optional[str] = None
    key_points: Optional[List[str]] = None


class MetricResult(BaseModel):
    score: float
    detail: str


class EvaluateResponse(BaseModel):
    scores: Dict[str, MetricResult]
    overall: float
    reference_summary: str
    key_points: List[str]


# ── Document Indexing ────────────────────────────────────────────────────────

class IndexDocumentRequest(BaseModel):
    document_id: int
    course_id: int


class IndexDocumentResponse(BaseModel):
    message: str
    chunks_indexed: int
