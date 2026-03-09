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
    EvaluateRequest, EvaluateResponse, MetricScore,
    IndexDocumentRequest, IndexDocumentResponse,
)

# Switch get_optional_user → get_current_user to enforce auth in production
_auth = Depends(get_optional_user)

router = APIRouter()


# ── Helper: resolve document text from DB ─────────────────────────────────────

async def _get_document_text(document_id: int, db: AsyncSession) -> str:
    """Return extractable text for a document.

    Resolution order:
      1. Local PDF already on disk (s3_path exists)       → extract via PyPDF
      2. Google Drive URL present                          → auto-download, then extract
      3. raw_text stored in DB (announcements/assignments) → return directly
    """
    result = await db.execute(
        select(DocumentORM).where(DocumentORM.id == document_id)
    )
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    import os
    from services.pdf_processor import extract_text_from_pdf

    # 1 & 2 — local file or auto-downloadable Drive file
    if doc.s3_path or doc.google_drive_url:
        try:
            from services.drive_download_service import ensure_local_file
            local_path = await ensure_local_file(doc, db)
            return extract_text_from_pdf(local_path)
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))
        except Exception as e:
            # Fall through to raw_text if download fails for any reason
            print(f"⚠️  Drive download failed for doc {document_id}: {e}")

    # 3 — raw text stored directly in DB
    if doc.raw_text and doc.raw_text.strip():
        return doc.raw_text

    raise HTTPException(
        status_code=422,
        detail=(
            "This document has no extractable text. "
            "It may be a non-PDF Drive file (image, video, etc.) "
            "or a Drive link that is not accessible."
        ),
    )


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
    """Generate quiz questions from provided text or an uploaded document and persist to the database."""
    from sqlalchemy.future import select as sa_select
    from DB.schemas import Course as CourseORM, User as UserORM

    # Validate course exists
    course_result = await db.execute(sa_select(CourseORM).where(CourseORM.id == req.course_id))
    if not course_result.scalars().first():
        raise HTTPException(status_code=404, detail="Course not found")

    # Validate creator user exists
    user_result = await db.execute(sa_select(UserORM).where(UserORM.id == req.created_by))
    if not user_result.scalars().first():
        raise HTTPException(status_code=404, detail="User not found")

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Persist quiz + questions to database
    from DB.schemas import Quiz as QuizORM, QuizQuestion as QuizQuestionORM
    db_quiz = QuizORM(course_id=req.course_id, created_by=req.created_by)
    db.add(db_quiz)
    await db.flush()  # get db_quiz.id before inserting questions

    for item in raw_items:
        db_question = QuizQuestionORM(
            quiz_id=db_quiz.id,
            question=item["stem"],
            type="multiple_choice",
            options=item["options"],
            correct_answer=item["options"][item["answer_index"]],
        )
        db.add(db_question)

    await db.commit()
    await db.refresh(db_quiz)

    items = [QuizItem(**item) for item in raw_items]
    return QuizGenerateResponse(quiz_id=db_quiz.id, course_id=req.course_id, items=items)


# ══════════════════════════════════════════════════════════════════════════════
#  3.  SUMMARIZATION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(req: SummarizeRequest, db: AsyncSession = Depends(get_db), user: CurrentUser | None = _auth):
    """Summarise text or an uploaded document and persist results to DB."""
    from sqlalchemy.future import select as sa_select
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
        summary_text = summarize_text(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # ── Persist to DB ─────────────────────────────────────────────────────
    from DB.schemas import (
        Chunk as ChunkORM,
        Summary as SummaryORM,
        SummaryChunk as SummaryChunkORM,
    )
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    db_summary = SummaryORM(text=summary_text, method="llm")
    db.add(db_summary)
    await db.flush()  # get db_summary.id

    if req.document_id:
        # Reuse existing chunks for this document if they were created before
        existing_chunks = (
            await db.execute(
                sa_select(ChunkORM)
                .where(ChunkORM.doc_id == req.document_id)
                .order_by(ChunkORM.sequence_number)
            )
        ).scalars().all()

        if not existing_chunks:
            # First time — split and persist chunks
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000, chunk_overlap=200
            )
            raw_chunks = splitter.split_text(text)
            existing_chunks = []
            for i, chunk_text in enumerate(raw_chunks):
                c = ChunkORM(
                    doc_id=req.document_id,
                    sequence_number=i,
                    text=chunk_text,
                )
                db.add(c)
                existing_chunks.append(c)
            await db.flush()  # get chunk ids

        # Link every chunk to this summary
        for chunk in existing_chunks:
            db.add(SummaryChunkORM(summary_id=db_summary.id, chunk_id=chunk.id))

    await db.commit()
    await db.refresh(db_summary)

    return SummarizeResponse(summary_id=db_summary.id, summary=summary_text)


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # ── Transform service output to response model ──────────────────────────
    # Service returns: {scores: {name: {score, detail}}, overall, reference_summary, key_points}
    raw_scores = result["scores"]        # {metric: {score, detail}}
    overall_score = result["overall"]

    metrics = {
        name: MetricScore(score=v["score"], feedback=v["detail"])
        for name, v in raw_scores.items()
    }

    # ── Persist to DB ─────────────────────────────────────────────────────
    from DB.schemas import Evaluation as EvaluationORM, EvaluationMetric as EvaluationMetricORM

    db_eval = EvaluationORM(
        document_id=req.document_id,
        student_summary=req.student_summary,
        lecture_text=lecture,
        overall_score=overall_score,
        method="hybrid",
    )
    db.add(db_eval)
    await db.flush()

    for name, m in metrics.items():
        db.add(EvaluationMetricORM(
            evaluation_id=db_eval.id,
            metric_name=name,
            score=m.score,
            feedback=m.feedback,
        ))

    await db.commit()
    await db.refresh(db_eval)

    return EvaluateResponse(
        evaluation_id=db_eval.id,
        overall_score=overall_score,
        metrics=metrics,
    )


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
