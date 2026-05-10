"""
Audio helpers for Text-to-Speech (TTS) and Speech-to-Text (STT).

Uses the same OpenAI-compatible client as the rest of the AI services.
"""

from __future__ import annotations

from typing import Optional

from Core.config import settings
from services.openrouter_client import get_ai_client


def synthesize_speech(
    text: str,
    *,
    voice: Optional[str] = None,
    model: Optional[str] = None,
    response_format: Optional[str] = None,
) -> bytes:
    """Convert text into speech audio bytes."""
    client = get_ai_client()
    resolved_model = model or settings.TTS_MODEL_NAME
    resolved_voice = voice or settings.TTS_VOICE_NAME
    resolved_format = response_format or settings.TTS_RESPONSE_FORMAT

    response = client.audio.speech.create(
        model=resolved_model,
        voice=resolved_voice,
        input=text,
        response_format=resolved_format,
    )
    return response.content


def transcribe_audio(
    audio_bytes: bytes,
    *,
    filename: str,
    content_type: Optional[str] = None,
    model: Optional[str] = None,
    prompt: Optional[str] = None,
    language: Optional[str] = None,
) -> str:
    """Transcribe speech audio bytes into text."""
    client = get_ai_client()
    resolved_model = model or settings.STT_MODEL_NAME
    resolved_content_type = content_type or "application/octet-stream"

    response = client.audio.transcriptions.create(
        model=resolved_model,
        file=(filename, audio_bytes, resolved_content_type),
        prompt=prompt,
        language=language,
    )
    return response.text
