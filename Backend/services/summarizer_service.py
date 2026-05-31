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
    prompt = f"Document:\n{text}"
    return chat_completion(
        prompt,
        system=(
            "You are an expert technical summarizer. Summarize the following document "
            "into a concise, structured summary. Provide the key points as bullet points, "
            "preserving all important technical details. Avoid adding any information not "
            "present in the source text.bullets each no more than 2 sentences. "
            "Use clear, professional language and maintain logical order."
        ),
        model=model or settings.AI_MODEL_NAME,
        temperature=temperature,
        max_tokens=max_tokens,
    )
