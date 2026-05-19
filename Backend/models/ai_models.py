"""
Pydantic models (request / response bodies) for the AI endpoints.
"""

from datetime import datetime
from pydantic import BaseModel, Field
from typing import Dict, List, Optional


# ── Chatbot ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    course_id: int
    question: str
    conversation_id: str = "default"
    document_id: Optional[int] = None


class SourceSnippet(BaseModel):
    page: Optional[int] = None
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceSnippet] = []
    conversation_id: Optional[str] = None


class ChatConversationSummary(BaseModel):
    conversation_id: str
    course_id: Optional[int] = None
    title: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_message_preview: Optional[str] = None
    last_role: Optional[str] = None


class ChatConversationListResponse(BaseModel):
    conversations: List[ChatConversationSummary]


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: Optional[datetime] = None


class ChatConversationMessagesResponse(BaseModel):
    conversation_id: str
    course_id: Optional[int] = None
    messages: List[ChatMessageOut]


class TTSRequest(BaseModel):
    text: str = Field(min_length=1)
    voice: Optional[str] = None
    model: Optional[str] = None
    response_format: Optional[str] = None


class STTResponse(BaseModel):
    text: str


# ── Quiz Generation ──────────────────────────────────────────────────────────

class QuizGenerateRequest(BaseModel):
    """Generate quiz questions from raw text or a document in a course."""
    text: Optional[str] = None
    document_id: Optional[int] = None
    course_id: Optional[int] = None
    created_by: Optional[int] = None
    objectives: Optional[List[str]] = None
    n_items: int = Field(default=5, ge=1, le=20)
    n_options: int = Field(default=4, ge=2, le=6)


class QuizItem(BaseModel):
    stem: str
    options: List[str]
    answer_index: int


class QuizGenerateResponse(BaseModel):
    quiz_id: Optional[int] = None
    course_id: Optional[int] = None
    items: List[QuizItem]


# ── Summarization ────────────────────────────────────────────────────────────

class SummarizeRequest(BaseModel):
    """Summarise raw text or a document already uploaded to a course."""
    text: Optional[str] = None
    document_id: Optional[int] = None


class SummarizeResponse(BaseModel):
    summary_id: Optional[int] = None
    summary: str


# ── Evaluation ───────────────────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    """Evaluate a student's summary against a lecture / document."""
    student_summary: str
    lecture_text: Optional[str] = None
    document_id: Optional[int] = None
    reference_summary: Optional[str] = None
    key_points: Optional[List[str]] = None


class MetricScore(BaseModel):
    score: float
    feedback: str


class EvaluateResponse(BaseModel):
    evaluation_id: Optional[int] = None
    overall_score: float
    overall_feedback: Optional[str] = None
    metrics: Dict[str, MetricScore]
    reference_summary: Optional[str] = None
    key_points: Optional[List[str]] = None


# ── Essay Grading ───────────────────────────────────────────────────────────

class EssayGradeRequest(BaseModel):
    """Grade a single essay using the fine-tuned essay grader model."""
    essay_text: str = Field(min_length=1)
    question: Optional[str] = None


class EssayGradeResponse(BaseModel):
    predicted_band: float
    raw_band: float
    calibrated_band: float
    objective: str
    ordinal_threshold: float
    word_count: int
    model_path: str


# ── Document Indexing ────────────────────────────────────────────────────────

class IndexDocumentRequest(BaseModel):
    document_id: int
    course_id: int


class IndexDocumentResponse(BaseModel):
    message: str
    chunks_indexed: int
