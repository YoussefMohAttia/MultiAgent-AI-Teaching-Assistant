"""
AI Router — exposes the AI capabilities as REST endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import os
import tempfile
import io
from typing import Optional
import json
from DB.session import get_db
from DB.schemas import Document as DocumentORM
from security.auth_dependency import get_optional_user, CurrentUser
from services.pdf_processor import extract_text_from_pdf, load_pdf, split_documents
from services.summarizer_service import summarize_text
from services.quiz_generator_service import generate_quiz as gen
from models.ai_models import (
    ChatRequest, ChatResponse,
    QuizGenerateRequest, QuizGenerateResponse, QuizItem,
    SummarizeRequest, SummarizeResponse,
    EvaluateRequest, EvaluateResponse, MetricScore,
    EssayGradeRequest, EssayGradeResponse,
    IndexDocumentRequest, IndexDocumentResponse,
    TTSRequest, STTResponse,
)
from sqlalchemy.future import select as sa_select
from DB.schemas import (
        Chunk as ChunkORM,
        Summary as SummaryORM,
        SummaryChunk as SummaryChunkORM,
    )

_auth = Depends(get_optional_user)
router = APIRouter()

# ── Helper: resolve document text from DB ─────────────────────────────────────
async def _get_document_text(document_id: int, db: AsyncSession) -> str:
    result = await db.execute(select(DocumentORM).where(DocumentORM.id == document_id))
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.s3_path or doc.google_drive_url:
        try:
            from services.drive_download_service import ensure_local_file
            local_path = await ensure_local_file(doc, db)
            return extract_text_from_pdf(local_path)
        except Exception as e:
            print(f"⚠️ Drive download failed: {e}")
    if doc.raw_text and doc.raw_text.strip():
        return doc.raw_text
    raise HTTPException(status_code=422, detail="No extractable text found.")

# ══════════════════════════════════════════════════════════════════════════════
#  1. CHATBOT
# ══════════════════════════════════════════════════════════════════════════════
# ══════════════════════════════════════════════════════════════════════════════
#  1.  CHATBOT  —  Hybrid RAG / General Tutor
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/chat", response_model=ChatResponse)
async def chat_with_tutor(req: ChatRequest, user: CurrentUser | None = _auth):
    """Ask the AI tutor a question. Switches between RAG and General mode."""
    try:
        from services.chatbot_service import ask_tutor
        
        # ⚡ SENIOR FIX: Handle General Chat (No course_id)
        # If course_id is 0, null, or missing, we pass None to the service.
        effective_course_id = req.course_id if (req.course_id and req.course_id > 0) else None
        
        answer, sources = ask_tutor(
            course_id=effective_course_id,
            question=req.question,
            conversation_id=req.conversation_id,
        )
        return ChatResponse(answer=answer, sources=sources)
    except Exception as e:
        print(f"❌ Chat Error: {str(e)}")
        raise HTTPException(status_code=500, detail="The chatbot encountered an error processing your request.")


@router.post("/chat/stream")
async def chat_with_tutor_stream(req: ChatRequest, user: CurrentUser | None = _auth):
    """Stream tutor response progressively using Server-Sent Events (SSE)."""
    try:
        from services.chatbot_service import ask_tutor_stream

        effective_course_id = req.course_id if (req.course_id and req.course_id > 0) else None
        token_stream, _sources = ask_tutor_stream(
            course_id=effective_course_id,
            question=req.question,
            conversation_id=req.conversation_id,
        )

        def event_generator():
            full_text_parts = []
            try:
                for token in token_stream:
                    full_text_parts.append(token)
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

                final_answer = "".join(full_text_parts)
                yield f"data: {json.dumps({'type': 'done', 'answer': final_answer})}\n\n"
            except Exception as stream_error:
                yield f"data: {json.dumps({'type': 'error', 'message': str(stream_error)})}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )
    except Exception as e:
        print(f"❌ Chat Stream Error: {str(e)}")
        raise HTTPException(status_code=500, detail="The chatbot stream failed to start.")


@router.post("/chat/tts")
async def chat_text_to_speech(req: TTSRequest, user: CurrentUser | None = _auth):
    """Convert assistant text into speech audio."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required for TTS.")

    try:
        from services.audio_service import synthesize_speech

        audio_bytes = synthesize_speech(
            req.text,
            voice=req.voice,
            model=req.model,
            response_format=req.response_format,
        )

        media_type = "audio/mpeg"
        if req.response_format:
            fmt = req.response_format.lower()
            if fmt in {"wav", "wave"}:
                media_type = "audio/wav"
            elif fmt == "ogg":
                media_type = "audio/ogg"
            elif fmt in {"mp3", "mpeg"}:
                media_type = "audio/mpeg"

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type=media_type,
            headers={"Cache-Control": "no-store"},
        )
    except Exception as e:
        print(f"❌ TTS Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Text-to-speech failed.")


@router.post("/chat/stt", response_model=STTResponse)
async def chat_speech_to_text(
    file: UploadFile = File(...),
    user: CurrentUser | None = _auth,
):
    """Transcribe uploaded speech audio to text."""
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Audio file is empty.")

        from services.audio_service import transcribe_audio

        transcript = transcribe_audio(
            audio_bytes,
            filename=file.filename or "speech.webm",
            content_type=file.content_type,
        )

        return STTResponse(text=transcript)
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ STT Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Speech-to-text failed.")

@router.post("/chat-upload")
async def chat_upload(
    file: UploadFile = File(...),
    message: str = Form(...),
    user: CurrentUser | None = _auth
):
    """Ephemeral chat with a one-time uploaded PDF (no persistence)."""
    if not message or not message.strip():
        raise HTTPException(status_code=400, detail="Message is required.")
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    temp_path = None
    try:
        payload = await file.read()
        if not payload:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(payload)
            temp_path = tmp.name

        docs = load_pdf(temp_path)
        if not docs:
            raise HTTPException(status_code=422, detail="Could not extract text from uploaded PDF.")

        chunks = split_documents(docs)
        if not chunks:
            raise HTTPException(status_code=422, detail="No readable content found in uploaded PDF.")

        import re
        query_terms = {
            t for t in re.findall(r"[A-Za-z0-9']+", message.lower()) if len(t) > 2
        }

        def score_chunk(text: str) -> int:
            if not query_terms:
                return 0
            tokens = {
                t for t in re.findall(r"[A-Za-z0-9']+", text.lower()) if len(t) > 2
            }
            return len(tokens & query_terms)

        ranked = sorted(
            chunks,
            key=lambda c: score_chunk(c.page_content),
            reverse=True,
        )
        top_chunks = ranked[:4]
        if not any(score_chunk(c.page_content) for c in top_chunks):
            top_chunks = chunks[:4]

        context_text = "\n\n---\n\n".join(c.page_content for c in top_chunks)

        from services.chatbot_service import TUTOR_SYSTEM
        from services.openrouter_client import chat_completion

        prompt = (
            f"Context from uploaded document:\n{context_text}\n\n"
            f"Student's Question: {message}\n\n"
            "Tutor's Answer:"
        )

        answer = chat_completion(
            prompt,
            system=TUTOR_SYSTEM,
            max_tokens=1500,
            temperature=0.7,
        )

        sources = [
            {
                "page": c.metadata.get("page"),
                "snippet": c.page_content[:300],
            }
            for c in top_chunks
        ]

        return ChatResponse(answer=answer, sources=sources)
    finally:
        try:
            await file.close()
        except Exception:
            pass
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

# ══════════════════════════════════════════════════════════════════════════════
#  2. QUIZ GENERATION
# ══════════════════════════════════════════════════════════════════════════════
@router.post("/generate-quiz", response_model=QuizGenerateResponse)
async def generate_quiz(req: QuizGenerateRequest, db: AsyncSession = Depends(get_db), user: CurrentUser | None = _auth):
    text = req.text if req.text else await _get_document_text(req.document_id, db)
    raw_items = gen(passage=text[:15000], objectives=req.objectives, n_items=req.n_items, n_options=req.n_options)
    from DB.schemas import Quiz as QuizORM, QuizQuestion as QuizQuestionORM
    db_quiz = QuizORM(course_id=req.course_id, created_by=req.created_by)
    db.add(db_quiz)
    await db.flush()
    for item in raw_items:
        db.add(QuizQuestionORM(quiz_id=db_quiz.id, question=item["stem"], type="mcq", options=item["options"], correct_answer=item["options"][item["answer_index"]]))
    await db.commit()
    return QuizGenerateResponse(quiz_id=db_quiz.id, course_id=req.course_id, items=[QuizItem(**i) for i in raw_items])

@router.post("/generate-quiz-upload")
async def generate_quiz_from_upload(
    file: UploadFile = File(...),
    objectives: str = Form("General knowledge"),
    n_items: int = Form(5),
    n_options: int = Form(4),
    user: CurrentUser | None = _auth
):
    temp_path = None
    try:
        payload = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(payload)
            temp_path = tmp.name
        text = extract_text_from_pdf(temp_path)
        # Use Pydantic model for validation before returning
        raw_items = gen(passage=text[:10000], objectives=objectives, n_items=n_items, n_options=n_options)
        validated = [QuizItem(**i) for i in raw_items]
        return {"items": validated}
    finally:
        if temp_path and os.path.exists(temp_path): os.remove(temp_path)


# ══════════════════════════════════════════════════════════════════════════════
#  3.  SUMMARIZATION
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(req: SummarizeRequest, db: AsyncSession = Depends(get_db), user: CurrentUser | None = _auth):
    """Summarise text or an uploaded document and persist results to DB."""
    

    # ── 1. GLOBAL CACHE CHECK (The Senior Optimization) ───────────────────
    # If a document_id is provided, check if ANY user has already summarized it.
    if req.document_id:
        existing_summary_query = (
            sa_select(SummaryORM)
            .join(SummaryChunkORM, SummaryORM.id == SummaryChunkORM.summary_id)
            .join(ChunkORM, SummaryChunkORM.chunk_id == ChunkORM.id)
            .where(ChunkORM.doc_id == req.document_id)
            .limit(1)
        )
        existing_summary = (await db.execute(existing_summary_query)).scalars().first()

        if existing_summary:
            print(f"⚡ CACHE HIT: Returning existing summary for Document {req.document_id}")
            # Return instantly. Cost: $0. Wait time: ~15ms.
            return SummarizeResponse(
                summary_id=existing_summary.id, 
                summary=existing_summary.text
            )

    # ── 2. TEXT EXTRACTION (Cache Miss) ───────────────────────────────────
    print(f"🔍 CACHE MISS: Generating new summary for Document {req.document_id}")
    text = req.text
    if not text and req.document_id:
        text = await _get_document_text(req.document_id, db)
    if not text:
        raise HTTPException(
            status_code=400,
            detail="Provide either 'text' or 'document_id'.",
        )

    # ── 3. AI GENERATION ──────────────────────────────────────────────────
    try:
        from services.summarizer_service import summarize_text
        summary_text = summarize_text(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # ── 4. PERSIST TO DB (For future cache hits) ──────────────────────────
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

        # Link every chunk to this summary so the next student gets the Cache Hit
        for chunk in existing_chunks:
            db.add(SummaryChunkORM(summary_id=db_summary.id, chunk_id=chunk.id))

    await db.commit()
    await db.refresh(db_summary)

    return SummarizeResponse(summary_id=db_summary.id, summary=summary_text)

@router.post("/summarize-upload", response_model=SummarizeResponse)
async def summarize_uploaded_file(file: UploadFile = File(...), user: CurrentUser | None = _auth):
    """Summarize a one-time uploaded PDF without saving it to DB or course documents."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    

   
    

    temp_path = None
    try:
        payload = await file.read()
        if not payload:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(payload)
            temp_path = tmp.name

        text = extract_text_from_pdf(temp_path)
        if not text or not text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from uploaded PDF.")

        summary_text = summarize_text(text)
        return SummarizeResponse(summary_id=None, summary=summary_text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            await file.close()
        except Exception:
            pass
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


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
        result = await asyncio.wait_for(
            asyncio.to_thread(
                evaluate_summary,
                student_summary=req.student_summary,
                lecture_text=lecture,
                reference_summary=req.reference_summary,
                key_points=req.key_points,
            ),
            timeout=300,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Evaluation request timed out at the API layer (300s), not token limit. Please retry or reduce lecture length.",
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
        reference_summary=result.get("reference_summary"),
        key_points=result.get("key_points"),
    )


# ══════════════════════════════════════════════════════════════════════════════
#  5.  ESSAY GRADING  —  IELTS band prediction using fine-tuned local model
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/grade-essay", response_model=EssayGradeResponse)
async def grade_essay(req: EssayGradeRequest, user: CurrentUser | None = _auth):
    """Predict IELTS overall band for a single essay."""
    try:
        import asyncio
        from services.essay_grader_service import grade_essay as grade_single

        # Model inference is sync and potentially heavy; run in worker thread.
        result = await asyncio.to_thread(
            grade_single,
            essay_text=req.essay_text,
            question=req.question,
        )
        return EssayGradeResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
#  6.  INDEX DOCUMENT  —  Process & index a PDF into the course vector store
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
