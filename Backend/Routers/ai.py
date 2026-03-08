"""
AI Router — exposes the four AI capabilities as REST endpoints.

Endpoints:
    POST /api/ai/chat            — RAG chatbot tutor
    POST /api/ai/generate-quiz   — AI quiz generation
    POST /api/ai/summarize       — Document / text summarization
    POST /api/ai/evaluate        — Student summary evaluation (10 metrics)
    POST /api/ai/index-document  — Index an uploaded PDF into the course vector store
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from DB.session import get_db
from DB.schemas import Document as DocumentORM
from security.auth_dependency import get_optional_user, CurrentUser

from models.ai_models import (
    ChatRequest, ChatResponse,
    QuizGenerateRequest, QuizGenerateResponse, QuizItem,
    SummarizeRequest, SummarizeResponse,
    EvaluateRequest, EvaluateResponse,
    IndexDocumentRequest, IndexDocumentResponse,
)

# Switch get_optional_user → get_current_user to enforce auth in production
_auth = Depends(get_optional_user)

router = APIRouter()


# ── Helper: resolve document text from DB ─────────────────────────────────────

async def _get_document_text(document_id: int, db: AsyncSession) -> str:
    """Look up a document's file path in the DB and extract its text."""
    result = await db.execute(
        select(DocumentORM).where(DocumentORM.id == document_id)
    )
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    import os
    if not doc.s3_path or not os.path.exists(doc.s3_path):
        raise HTTPException(status_code=404, detail="Document file not found on server")

    from services.pdf_processor import extract_text_from_pdf
    return extract_text_from_pdf(doc.s3_path)


# ══════════════════════════════════════════════════════════════════════════════
#  1.  CHATBOT  —  RAG tutor scoped to a course's indexed documents
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/chat", response_model=ChatResponse)
async def chat_with_tutor(req: ChatRequest, user: CurrentUser | None = _auth):
    """Ask the AI tutor a question. Answers are grounded in the course's documents."""
    try:
        from services.chatbot_service import ask_tutor
        answer, sources = ask_tutor(
            course_id=req.course_id,
            question=req.question,
            conversation_id=req.conversation_id,
        )
        return ChatResponse(answer=answer, sources=sources)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
#  2.  QUIZ GENERATION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/generate-quiz", response_model=QuizGenerateResponse)
async def generate_quiz(req: QuizGenerateRequest, db: AsyncSession = Depends(get_db), user: CurrentUser | None = _auth):
    """Generate quiz questions from provided text or an uploaded document."""
    # Resolve the source text
    text = req.text
    if not text and req.document_id:
        text = await _get_document_text(req.document_id, db)
    if not text:
        raise HTTPException(
            status_code=400,
            detail="Provide either 'text' or 'document_id'.",
        )

    try:
        from services.quiz_generator_service import generate_quiz as gen
        raw_items = gen(
            passage=text,
            objectives=req.objectives,
            n_items=req.n_items,
            n_options=req.n_options,
        )
        items = [QuizItem(**item) for item in raw_items]
        return QuizGenerateResponse(items=items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
#  3.  SUMMARIZATION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(req: SummarizeRequest, db: AsyncSession = Depends(get_db), user: CurrentUser | None = _auth):
    """Summarise text or an uploaded document."""
    text = req.text
    if not text and req.document_id:
        text = await _get_document_text(req.document_id, db)
    if not text:
        raise HTTPException(
            status_code=400,
            detail="Provide either 'text' or 'document_id'.",
        )

    try:
        from services.summarizer_service import summarize_text
        summary = summarize_text(text)
        return SummarizeResponse(summary=summary)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
#  4.  EVALUATION  —  10-dimension hybrid student summary evaluator
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate(req: EvaluateRequest, db: AsyncSession = Depends(get_db), user: CurrentUser | None = _auth):
    """Evaluate a student summary against a lecture / document across 10 metrics.
    
    The evaluator uses Gemma 3 12B for scoring. If no reference_summary is
    provided, the Summarizer (Gemma 3 27B) auto-generates one as ground truth."""
    lecture = req.lecture_text
    if not lecture and req.document_id:
        lecture = await _get_document_text(req.document_id, db)
    if not lecture:
        raise HTTPException(
            status_code=400,
            detail="Provide either 'lecture_text' or 'document_id'.",
        )

    try:
        import asyncio
        from services.evaluator_service import evaluate_summary
        # evaluate_summary is sync (blocking HTTP + time.sleep retries);
        # offload to a thread so we don't block the async event loop.
        result = await asyncio.to_thread(
            evaluate_summary,
            student_summary=req.student_summary,
            lecture_text=lecture,
            reference_summary=req.reference_summary,
            key_points=req.key_points,
        )
        return EvaluateResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
#  5.  INDEX DOCUMENT  —  Process & index a PDF into the course vector store
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/index-document", response_model=IndexDocumentResponse)
async def index_document(req: IndexDocumentRequest, db: AsyncSession = Depends(get_db), user: CurrentUser | None = _auth):
    """Index an already-uploaded document into the course's vector store for RAG."""
    result = await db.execute(
        select(DocumentORM).where(DocumentORM.id == req.document_id)
    )
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    import os
    if not doc.s3_path or not os.path.exists(doc.s3_path):
        raise HTTPException(status_code=404, detail="Document file not found on server")

    try:
        from services.pdf_processor import index_pdf_for_course
        chunks = index_pdf_for_course(doc.s3_path, req.course_id)
        return IndexDocumentResponse(
            message="Document indexed successfully",
            chunks_indexed=chunks,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
