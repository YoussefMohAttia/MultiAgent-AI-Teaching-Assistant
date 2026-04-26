"""
RAG-based chatbot tutor service.

Extracted from Ai Team/Main/chatbot.ipynb — TutorChatbot class (section 6).

Uses ChromaDB's native query for retrieval and the OpenRouter chat_completion
helper for generation. Avoids heavy torch/sentence-transformers dependency.

Usage:
    answer, sources = ask_tutor(course_id, question, conversation_id)
"""

from __future__ import annotations

from typing import Dict, Iterator, List, Tuple

from services.openrouter_client import chat_completion, chat_completion_stream
from services.pdf_processor import query_course_documents

# ---------------------------------------------------------------------------
# In-memory conversation store  (swap for Redis / DB in production)
# ---------------------------------------------------------------------------
_conversations: Dict[str, List[dict]] = {}   # conversation_id -> list of messages

TUTOR_SYSTEM = (
    "You are a helpful and patient tutor. Use the following context "
    "from the uploaded documents to answer the student's question.\n\n"
    "If the answer is in the context, explain it clearly and in detail. "
    "If you're not sure or if the information isn't in the context, say so "
    "honestly and suggest related topics you can help with.\n\n"
    "Be encouraging, clear, and educational in your responses. "
    "Break down complex concepts when needed."
)


def ask_tutor(
    course_id: int,
    question: str,
    conversation_id: str = "default",
) -> Tuple[str, List[dict]]:
    """
    Ask the RAG tutor a question scoped to a course's documents.

    Returns (answer_text, source_snippets).
    """
    # 1.  Retrieve relevant chunks from the course's vector store
    retrieved = query_course_documents(course_id, question, n_results=4)
    context_text = "\n\n---\n\n".join(d["content"] for d in retrieved) if retrieved else "(No documents indexed for this course yet.)"

    # 2.  Build conversation history snippet (last 6 turns)
    history = _conversations.get(conversation_id, [])
    history_text = ""
    for msg in history[-6:]:
        role = "Student" if msg["role"] == "user" else "Tutor"
        history_text += f"{role}: {msg['content']}\n"

    # 3.  Build the full prompt
    prompt = (
        f"Context from documents:\n{context_text}\n\n"
        f"Previous conversation:\n{history_text}\n"
        f"Student's Question: {question}\n\n"
        "Tutor's Answer:"
    )

    # 4.  Call the LLM
    answer = chat_completion(
        prompt,
        system=TUTOR_SYSTEM,
        max_tokens=1500,
        temperature=0.7,
    )

    # 5.  Update conversation memory
    if conversation_id not in _conversations:
        _conversations[conversation_id] = []
    _conversations[conversation_id].append({"role": "user", "content": question})
    _conversations[conversation_id].append({"role": "assistant", "content": answer})

    # 6.  Format sources
    sources = [
        {
            "page": d["metadata"].get("page"),
            "snippet": d["content"][:300],
        }
        for d in retrieved
    ]

    return answer, sources


def ask_tutor_stream(
    course_id: int | None,
    question: str,
    conversation_id: str = "default",
) -> Tuple[Iterator[str], List[dict]]:
    """
    Stream a tutor answer token-by-token.

    Returns (token_iterator, source_snippets).
    """
    retrieved = query_course_documents(course_id, question, n_results=4) if course_id else []
    context_text = (
        "\n\n---\n\n".join(d["content"] for d in retrieved)
        if retrieved
        else "(No documents indexed for this course yet.)"
    )

    history = _conversations.get(conversation_id, [])
    history_text = ""
    for msg in history[-6:]:
        role = "Student" if msg["role"] == "user" else "Tutor"
        history_text += f"{role}: {msg['content']}\n"

    prompt = (
        f"Context from documents:\n{context_text}\n\n"
        f"Previous conversation:\n{history_text}\n"
        f"Student's Question: {question}\n\n"
        "Tutor's Answer:"
    )

    token_stream = chat_completion_stream(
        prompt,
        system=TUTOR_SYSTEM,
        max_tokens=1500,
        temperature=0.7,
    )

    def _wrapped_stream() -> Iterator[str]:
        full_answer_parts: List[str] = []
        for token in token_stream:
            full_answer_parts.append(token)
            yield token

        final_answer = "".join(full_answer_parts).strip()
        if conversation_id not in _conversations:
            _conversations[conversation_id] = []
        _conversations[conversation_id].append({"role": "user", "content": question})
        _conversations[conversation_id].append({"role": "assistant", "content": final_answer})

    sources = [
        {
            "page": d["metadata"].get("page"),
            "snippet": d["content"][:300],
        }
        for d in retrieved
    ]

    return _wrapped_stream(), sources


def reset_conversation(conversation_id: str) -> None:
    """Clear a conversation's history."""
    _conversations.pop(conversation_id, None)
