"""
RAG-based chatbot tutor service.

Extracted from Ai Team/Main/chatbot.ipynb — TutorChatbot class (section 6).

Uses ChromaDB's native query for retrieval and the OpenRouter chat_completion
helper for generation. Avoids heavy torch/sentence-transformers dependency.

Usage:
    answer, sources = ask_tutor(course_id, question, conversation_id)
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, Iterator, List, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from Core.config import settings
from DB.schemas import ChatConversation, ChatMessage
from services.openrouter_client import chat_completion, chat_completion_stream
from services.pdf_processor import query_course_documents

# ---------------------------------------------------------------------------
# In-memory conversation store  (swap for Redis / DB in production)
# ---------------------------------------------------------------------------
_conversations: Dict[str, List[dict]] = {}   # conversation_id -> list of messages

MAX_HISTORY_MESSAGES = 6

TUTOR_SYSTEM = (
    "You are a helpful and patient tutor. Use the following context "
    "from the uploaded documents to answer the student's question.\n\n"
    "If the answer is in the context, explain it clearly and in detail. "
    "If you're not sure or if the information isn't in the context, say so "
    "honestly and suggest related topics you can help with.\n\n"
    "Be encouraging, clear, and educational in your responses. "
    "Break down complex concepts when needed."
)

GENERAL_SYSTEM = (
    "You are a helpful, concise general-purpose assistant. "
    "Answer conversationally and directly without assuming a tutoring role."
)

CHAT_TIMEOUT_S = 60


def _normalize_conversation_id(conversation_id: str | None) -> str:
    if not conversation_id:
        return "default"
    normalized = conversation_id.strip()
    return normalized or "default"


def _scope_key(course_id: int | None) -> str:
    return f"course:{course_id}" if course_id else "general"


def _to_utc_naive(timestamp: datetime | None) -> datetime | None:
    if not timestamp:
        return None
    if timestamp.tzinfo:
        return timestamp.astimezone(timezone.utc).replace(tzinfo=None)
    return timestamp


async def _load_db_history(
    db: AsyncSession,
    user_id: int,
    conversation_id: str,
    course_id: int | None,
) -> List[ChatMessage]:
    scope_key = _scope_key(course_id)
    stmt = select(ChatConversation).where(
        ChatConversation.user_id == user_id,
        ChatConversation.conversation_key == conversation_id,
        ChatConversation.scope_key == scope_key,
    )
    result = await db.execute(stmt)
    conversation = result.scalars().first()

    if not conversation:
        return []

    cutoff = datetime.utcnow() - timedelta(hours=settings.CHAT_HISTORY_TTL_HOURS)
    last_message_at = _to_utc_naive(conversation.last_message_at)
    if last_message_at and last_message_at < cutoff:
        await db.delete(conversation)
        await db.commit()
        return []

    msg_stmt = (
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(MAX_HISTORY_MESSAGES)
    )
    msg_result = await db.execute(msg_stmt)
    messages = list(reversed(msg_result.scalars().all()))
    return messages


async def _persist_db_turn(
    db: AsyncSession,
    user_id: int,
    conversation_id: str,
    course_id: int | None,
    question: str,
    answer: str,
) -> None:
    scope_key = _scope_key(course_id)
    now = datetime.utcnow()

    stmt = select(ChatConversation).where(
        ChatConversation.user_id == user_id,
        ChatConversation.conversation_key == conversation_id,
        ChatConversation.scope_key == scope_key,
    )
    result = await db.execute(stmt)
    conversation = result.scalars().first()

    if conversation:
        cutoff = datetime.utcnow() - timedelta(hours=settings.CHAT_HISTORY_TTL_HOURS)
        last_message_at = _to_utc_naive(conversation.last_message_at)
        if last_message_at and last_message_at < cutoff:
            await db.delete(conversation)
            await db.flush()
            conversation = None

    if not conversation:
        conversation = ChatConversation(
            user_id=user_id,
            course_id=course_id,
            conversation_key=conversation_id,
            scope_key=scope_key,
            last_message_at=now,
        )
        db.add(conversation)
        await db.flush()

    conversation.last_message_at = now
    db.add_all(
        [
            ChatMessage(conversation_id=conversation.id, role="user", content=question),
            ChatMessage(conversation_id=conversation.id, role="assistant", content=answer),
        ]
    )
    await db.commit()


async def _build_history_text(
    conversation_id: str,
    course_id: int | None,
    db: AsyncSession | None,
    user_id: int | None,
) -> str:
    history_text = ""
    if db and user_id:
        messages = await _load_db_history(db, user_id, conversation_id, course_id)
        for msg in messages:
            role = "Student" if msg.role == "user" else "Tutor"
            history_text += f"{role}: {msg.content}\n"
        return history_text

    history = _conversations.get(conversation_id, [])
    for msg in history[-MAX_HISTORY_MESSAGES:]:
        role = "Student" if msg["role"] == "user" else "Tutor"
        history_text += f"{role}: {msg['content']}\n"
    return history_text


async def persist_chat_turn(
    conversation_id: str,
    course_id: int | None,
    question: str,
    answer: str,
    db: AsyncSession | None = None,
    user_id: int | None = None,
) -> None:
    conversation_id = _normalize_conversation_id(conversation_id)
    if db and user_id:
        await _persist_db_turn(db, user_id, conversation_id, course_id, question, answer)
        return

    if conversation_id not in _conversations:
        _conversations[conversation_id] = []
    _conversations[conversation_id].append({"role": "user", "content": question})
    _conversations[conversation_id].append({"role": "assistant", "content": answer})


async def ask_tutor(
    course_id: int | None,
    question: str,
    conversation_id: str = "default",
    source_path: str | None = None,
    document_id: int | None = None,
    db: AsyncSession | None = None,
    user_id: int | None = None,
) -> Tuple[str, List[dict]]:
    """
    Ask the RAG tutor a question scoped to a course's documents.

    Returns (answer_text, source_snippets).
    """
    if course_id:
        # 1.  Retrieve relevant chunks from the course's vector store
        retrieved = query_course_documents(
            course_id,
            question,
            n_results=4,
            source_path=source_path,
            document_id=document_id,
        )
        if retrieved:
            context_text = "\n\n---\n\n".join(d["content"] for d in retrieved)
        elif source_path:
            context_text = "(No chunks found for the selected document yet.)"
        else:
            context_text = "(No documents indexed for this course yet.)"
    else:
        retrieved = []
        context_text = ""

    # 2.  Build conversation history snippet (last 6 messages)
    conversation_id = _normalize_conversation_id(conversation_id)
    history_text = await _build_history_text(conversation_id, course_id, db, user_id)

    # 3.  Build the full prompt
    if course_id:
        prompt = (
            f"Context from documents:\n{context_text}\n\n"
            f"Previous conversation:\n{history_text}\n"
            f"Student's Question: {question}\n\n"
            "Tutor's Answer:"
        )
        system_prompt = TUTOR_SYSTEM
    else:
        prompt = (
            f"Previous conversation:\n{history_text}\n"
            f"User: {question}\n\n"
            "Assistant:"
        )
        system_prompt = GENERAL_SYSTEM

    # 4.  Call the LLM
    answer = chat_completion(
        prompt,
        system=system_prompt,
        max_tokens=1500,
        temperature=0.7,
        timeout_s=CHAT_TIMEOUT_S,
    )

    # 5.  Update conversation memory
    await persist_chat_turn(
        conversation_id,
        course_id,
        question,
        answer,
        db=db,
        user_id=user_id,
    )

    # 6.  Format sources
    sources = [
        {
            "page": d["metadata"].get("page"),
            "snippet": d["content"][:300],
        }
        for d in retrieved
    ]

    return answer, sources


async def ask_tutor_stream(
    course_id: int | None,
    question: str,
    conversation_id: str = "default",
    source_path: str | None = None,
    document_id: int | None = None,
    db: AsyncSession | None = None,
    user_id: int | None = None,
) -> Tuple[Iterator[str], List[dict]]:
    """
    Stream a tutor answer token-by-token.

    Returns (token_iterator, source_snippets).
    """
    retrieved = (
        query_course_documents(
            course_id,
            question,
            n_results=4,
            source_path=source_path,
            document_id=document_id,
        )
        if course_id
        else []
    )
    if retrieved:
        context_text = "\n\n---\n\n".join(d["content"] for d in retrieved)
    elif source_path:
        context_text = "(No chunks found for the selected document yet.)"
    else:
        context_text = "(No documents indexed for this course yet.)"

    conversation_id = _normalize_conversation_id(conversation_id)
    history_text = await _build_history_text(conversation_id, course_id, db, user_id)

    if course_id:
        prompt = (
            f"Context from documents:\n{context_text}\n\n"
            f"Previous conversation:\n{history_text}\n"
            f"Student's Question: {question}\n\n"
            "Tutor's Answer:"
        )
        system_prompt = TUTOR_SYSTEM
    else:
        prompt = (
            f"Previous conversation:\n{history_text}\n"
            f"User: {question}\n\n"
            "Assistant:"
        )
        system_prompt = GENERAL_SYSTEM

    token_stream = chat_completion_stream(
        prompt,
        system=system_prompt,
        max_tokens=1500,
        temperature=0.7,
        timeout_s=CHAT_TIMEOUT_S,
    )

    sources = [
        {
            "page": d["metadata"].get("page"),
            "snippet": d["content"][:300],
        }
        for d in retrieved
    ]

    return token_stream, sources


def reset_conversation(conversation_id: str) -> None:
    """Clear a conversation's history."""
    _conversations.pop(conversation_id, None)
