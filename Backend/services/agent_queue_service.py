import asyncio
import traceback
from sqlalchemy.future import select

from DB.session import AsyncSessionLocal
from DB import crud
from DB.schemas import (
    Document as DocumentORM,
    Chunk as ChunkORM,
    Summary as SummaryORM,
    SummaryChunk as SummaryChunkORM,
    Quiz as QuizORM,
    QuizQuestion as QuizQuestionORM,
    QuizDocument as QuizDocumentORM,
)
from services.drive_download_service import ensure_document_text
from services.summarizer_service import summarize_text
from services.quiz_generator_service import generate_quiz
from services.quiz_utils import find_quiz_by_doc_and_criteria
from Core.config import settings
from langchain_text_splitters import RecursiveCharacterTextSplitter

# (priority, sequence, task_type, doc_id, user_id)
# task_type: "summary" or "quiz"
# priority: lower number = higher priority
# sequence: to ensure stable sorting for items with same priority
agent_queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
_sequence_counter = 0

_auto_quiz_inflight: set[int] = set()
_auto_quiz_lock = asyncio.Lock()
_auto_summary_inflight: set[int] = set()
_auto_summary_lock = asyncio.Lock()
_AUTO_QUIZ_N_ITEMS = 5
_AUTO_QUIZ_N_OPTIONS = 4

async def _auto_jobs_enabled(db, user_id: int | None) -> bool:
    if not user_id:
        return True
    user = await crud.get_user_by_id(db, user_id)
    if not user:
        return False
    flag = getattr(user, "auto_jobs_enabled", True)
    return True if flag is None else bool(flag)

async def process_summary_task(doc_id: int, user_id: int | None):
    if not settings.AUTO_SUMMARIZE_MATERIALS:
        return
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

    async with AsyncSessionLocal() as db:
        if not await _auto_jobs_enabled(db, user_id):
            print("ℹ️  Auto-summary stopped: user logged out")
            return
            
        reserved = False
        async with _auto_summary_lock:
            if doc_id in _auto_summary_inflight:
                print(f"ℹ️  Auto-summary skipped doc {doc_id}: already in progress")
                return
            _auto_summary_inflight.add(doc_id)
            reserved = True
            
        try:
            result = await db.execute(select(DocumentORM).where(DocumentORM.id == doc_id))
            doc = result.scalars().first()
            if not doc or doc.doc_type != "material":
                return

            existing_summary = (
                await db.execute(
                    select(SummaryORM)
                    .join(SummaryChunkORM, SummaryORM.id == SummaryChunkORM.summary_id)
                    .join(ChunkORM, SummaryChunkORM.chunk_id == ChunkORM.id)
                    .where(ChunkORM.doc_id == doc_id)
                    .limit(1)
                )
            ).scalars().first()
            if existing_summary:
                print(f"ℹ️  Auto-summary skipped doc {doc_id}: summary already exists")
                return

            text = ""
            if doc.raw_text:
                text = doc.raw_text
            elif doc.google_drive_url or doc.s3_path:
                try:
                    text = await ensure_document_text(doc, db)
                except Exception as e:
                    print(f"⚠️  Auto-summary text extraction failed for doc {doc_id}: {e}")

            if not text or not text.strip():
                print(f"⚠️  Auto-summary skipped doc {doc_id}: no extractable text")
                return
            print(f"🧠 Auto-summary started doc {doc_id}: {doc.title}")
            summary_text = await asyncio.to_thread(
                summarize_text,
                text[:15000],
            )
            db_summary = SummaryORM(text=summary_text, method="llm")
            db.add(db_summary)
            await db.flush()

            existing_chunks = (
                await db.execute(
                    select(ChunkORM)
                    .where(ChunkORM.doc_id == doc_id)
                    .order_by(ChunkORM.sequence_number)
                )
            ).scalars().all()

            if not existing_chunks:
                raw_chunks = splitter.split_text(text)
                existing_chunks = []
                for i, chunk_text in enumerate(raw_chunks):
                    chunk = ChunkORM(
                        doc_id=doc_id,
                        sequence_number=i,
                        text=chunk_text,
                    )
                    db.add(chunk)
                    existing_chunks.append(chunk)
                await db.flush()

            for chunk in existing_chunks:
                db.add(SummaryChunkORM(summary_id=db_summary.id, chunk_id=chunk.id))

            await db.commit()
            print(f"✅ Auto-summarized doc {doc_id}")
        except Exception as e:
            await db.rollback()
            print(f"⚠️  Auto-summary skipped doc {doc_id}: {e}")
        finally:
            if reserved:
                async with _auto_summary_lock:
                    _auto_summary_inflight.discard(doc_id)

async def process_quiz_task(doc_id: int, user_id: int | None):
    if not settings.AUTO_GENERATE_QUIZZES:
        return
    async with AsyncSessionLocal() as db:
        if not await _auto_jobs_enabled(db, user_id):
            print("ℹ️  Auto-quiz stopped: user logged out")
            return
        reserved = False
        async with _auto_quiz_lock:
            if doc_id in _auto_quiz_inflight:
                print(f"ℹ️  Auto-quiz skipped doc {doc_id}: already in progress")
                return
            _auto_quiz_inflight.add(doc_id)
            reserved = True
        try:
            result = await db.execute(select(DocumentORM).where(DocumentORM.id == doc_id))
            doc = result.scalars().first()
            if not doc or doc.doc_type != "material":
                return

            existing_quiz = await find_quiz_by_doc_and_criteria(
                db,
                doc_id=doc_id,
                n_items=_AUTO_QUIZ_N_ITEMS,
                n_options=_AUTO_QUIZ_N_OPTIONS,
            )
            if existing_quiz:
                print(f"ℹ️  Auto-quiz skipped doc {doc_id}: quiz already exists")
                return

            text = ""
            if doc.raw_text:
                text = doc.raw_text
            elif doc.google_drive_url or doc.s3_path:
                try:
                    text = await ensure_document_text(doc, db)
                except Exception as e:
                    print(f"⚠️  Auto-quiz text extraction failed for doc {doc_id}: {e}")

            if not text or not text.strip():
                print(f"⚠️  Auto-quiz skipped doc {doc_id}: no extractable text")
                return

            print(f"🧠 Auto-quiz started doc {doc_id}: {doc.title}")
            raw_items = await asyncio.to_thread(
                generate_quiz,
                passage=text[:15000],
                n_items=_AUTO_QUIZ_N_ITEMS,
                n_options=_AUTO_QUIZ_N_OPTIONS,
            )
            if not raw_items:
                print(f"⚠️  Auto-quiz skipped doc {doc_id}: no valid questions")
                return

            db_quiz = QuizORM(course_id=doc.course_id, created_by=None)
            db.add(db_quiz)
            await db.flush()

            question_count = 0
            for item in raw_items:
                options = item.get("options") or []
                answer_index = item.get("answer_index")
                if answer_index is None or answer_index < 0 or answer_index >= len(options):
                    continue
                correct_answer = options[answer_index]
                db.add(
                    QuizQuestionORM(
                        quiz_id=db_quiz.id,
                        question=item.get("stem", ""),
                        type="mcq",
                        options=options,
                        correct_answer=correct_answer,
                    )
                )
                question_count += 1

            if question_count == 0:
                await db.rollback()
                print(f"⚠️  Auto-quiz skipped doc {doc_id}: no valid questions")
                return

            db.add(QuizDocumentORM(quiz_id=db_quiz.id, doc_id=doc.id))
            await db.commit()
            print(f"✅ Auto-quiz generated doc {doc_id}")
        except Exception as e:
            await db.rollback()
            print(f"⚠️  Auto-quiz skipped doc {doc_id}: {e}")
        finally:
            if reserved:
                async with _auto_quiz_lock:
                    _auto_quiz_inflight.discard(doc_id)

async def agent_worker_loop(worker_id: int):
    print(f"🚀 Agent Worker {worker_id} started.")
    while True:
        try:
            priority, sequence, task_type, doc_id, user_id = await agent_queue.get()
            print(f"⚙️ Worker {worker_id} processing {task_type} for doc {doc_id}")
            
            if task_type == "summary":
                await process_summary_task(doc_id, user_id)
            elif task_type == "quiz":
                await process_quiz_task(doc_id, user_id)
                
            agent_queue.task_done()
        except asyncio.CancelledError:
            print(f"🛑 Agent Worker {worker_id} stopped.")
            break
        except Exception as e:
            print(f"⚠️ Worker {worker_id} encountered an error: {e}")
            traceback.print_exc()

def enqueue_agent_task(task_type: str, doc_id: int, user_id: int | None, priority: int = 10):
    global _sequence_counter
    _sequence_counter += 1
    # priority 1 = manual high priority, 10 = background low priority
    agent_queue.put_nowait((priority, _sequence_counter, task_type, doc_id, user_id))
