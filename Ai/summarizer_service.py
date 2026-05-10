"""
Document summarization service.

Extracted from Ai Team/Main/Summarizer.ipynb.
"""

from __future__ import annotations

from typing import Optional

from services.openrouter_client import chat_completion
from Core.config import settings


def summarize_text(
    text: str,
    *,
    model: Optional[str] = None,
    max_tokens: int = 1000,
    temperature: float = 0.4,
) -> str:
    """
    Summarise the given text using the configured LLM.

    Returns the summary string.
    """
    prompt = (
        "You are a summarization assistant.\n"
        "Please summarize the article below.\n\n"
        "Requirements:\n"
        "- Keep the key ideas only\n"
        "- Remove redundancies\n"
        "- Use clear academic language\n"
        "- Maintain chronological order\n\n"
        f"Article:\n{text}"
    )
    return chat_completion(
        prompt,
        system="You are an expert summarization assistant.",
        model=model or settings.AI_MODEL_NAME,
        temperature=temperature,
        max_tokens=max_tokens,
    )
