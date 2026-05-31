"""
AI-powered quiz generation service.

Extracted from Ai Team/Main/Quiz_Generation.ipynb — Part 4 (OpenRouter Prompt API).
"""

from __future__ import annotations

import json
import re
from typing import Dict, List, Optional

from services.openrouter_client import get_ai_client
from Core.config import settings

SYSTEM_PROMPT = (
    "You are an expert educator. Generate {n_items} multiple-choice quiz\n"
    "questions from the following text, aligned with these learning objectives.\n"
    "Return ONLY a valid JSON array with this exact structure:\n"
    '[{"stem": "...", "options": ["A", "B", "C", "D"], "answer_index": 0}]\n'.replace('{', '{{').replace('}', '}}') +
    "Make distractors plausible but clearly incorrect. Vary difficulty."
)

USER_TEMPLATE = (
    "Source passage:\n{passage}\n\n"
    "Learning objectives:\n{objectives}\n\n"
    "Requirements:\n"
    "- Options must be exactly {n_options}.\n"
    "- Ensure only one option is correct.\n"
)


def _extract_first_json_array(text: str) -> str:
    """Return the first balanced JSON array embedded in arbitrary text."""
    stack = 0
    start_idx = -1
    for idx, char in enumerate(text):
        if char == "[":
            if stack == 0:
                start_idx = idx
            stack += 1
        elif char == "]" and stack:
            stack -= 1
            if stack == 0 and start_idx != -1:
                return text[start_idx : idx + 1]
    raise ValueError("No JSON array found in LLM response")


def generate_quiz(
    passage: str,
    *,
    objectives: Optional[List[str]] = None,
    n_items: int = 5,
    n_options: int = 4,
    model: Optional[str] = None,
    temperature: float = 0.7,
) -> List[Dict]:
    """
    Call the OpenRouter LLM to generate a quiz from a text passage.

    Returns a list of dicts, each with keys:
        stem, options (list[str]), answer_index (int)
    """
    objective_block = (
        "\n".join(f"- {obj}" for obj in objectives) if objectives else "- General comprehension"
    )
    formatted_system = SYSTEM_PROMPT.format(n_items=n_items)
    user_prompt = USER_TEMPLATE.format(
        passage=passage,
        objectives=objective_block,
        n_options=n_options,
    )

    client = get_ai_client()
    resolved_model = model or settings.AI_MODEL_NAME

    # Gemma models don't support system instructions on Google AI Studio.
    _models_without_system = {"gemma"}
    model_lower = resolved_model.lower()
    if any(tag in model_lower for tag in _models_without_system):
        merged_prompt = f"{formatted_system}\n\n{user_prompt}"
        messages = [{"role": "user", "content": merged_prompt}]
    else:
        messages = [
            {"role": "system", "content": formatted_system},
            {"role": "user", "content": user_prompt},
        ]

    response = client.chat.completions.create(
        model=resolved_model,
        messages=messages,
        temperature=temperature,
        max_tokens=2048,
    )

    content = response.choices[0].message.content

    # Handle streaming-style list content
    if isinstance(content, list):
        content = "".join(chunk.get("text", "") for chunk in content)

    # Strip markdown code fences
    if "```" in content:
        segments = [s.strip() for s in content.split("```") if s.strip()]
        for segment in segments:
            if segment.lstrip().startswith("["):
                content = segment
                break

    content_json = _extract_first_json_array(content)
    parsed = json.loads(content_json)
    items = parsed if isinstance(parsed, list) else []

    quiz_items: List[Dict] = []
    for item in items:
        options = item.get("options", [])
        answer_index = item.get("answer_index")
        if not options or answer_index is None:
            continue
        quiz_items.append(
            {
                "stem": item.get("stem", ""),
                "options": options,
                "answer_index": answer_index,
            }
        )
    return quiz_items
