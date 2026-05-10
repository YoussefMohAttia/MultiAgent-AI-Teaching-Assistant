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
    "You are an expert instructional designer. "
    "Generate rigorous multiple-choice quizzes. Return ONLY JSON."
)

USER_TEMPLATE = (
    "Source passage:\n{passage}\n\n"
    "Learning objectives:\n{objectives}\n\n"
    "Requirements:\n"
    "- Produce {n_items} multiple-choice questions.\n"
    "- Each question needs `stem`, `options` (exactly {n_options}), and `answer_index`.\n"
    "- Options must be concise sentences without explanations.\n"
    "- Ensure only one option is correct.\n"
    "- Return a JSON array under the key `items`.\n"
)


def _extract_first_json_object(text: str) -> str:
    """Return the first balanced JSON object embedded in arbitrary text."""
    stack = 0
    start_idx = -1
    for idx, char in enumerate(text):
        if char == "{":
            if stack == 0:
                start_idx = idx
            stack += 1
        elif char == "}" and stack:
            stack -= 1
            if stack == 0 and start_idx != -1:
                return text[start_idx : idx + 1]
    raise ValueError("No JSON object found in LLM response")


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
    user_prompt = USER_TEMPLATE.format(
        passage=passage,
        objectives=objective_block,
        n_items=n_items,
        n_options=n_options,
    )

    client = get_ai_client()
    resolved_model = model or settings.AI_MODEL_NAME

    # Gemma models don't support system instructions on Google AI Studio.
    _models_without_system = {"gemma"}
    model_lower = resolved_model.lower()
    if any(tag in model_lower for tag in _models_without_system):
        merged_prompt = f"{SYSTEM_PROMPT}\n\n{user_prompt}"
        messages = [{"role": "user", "content": merged_prompt}]
    else:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
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
            if segment.lstrip().startswith("{"):
                content = segment
                break

    content_json = _extract_first_json_object(content)
    parsed = json.loads(content_json)
    items = parsed.get("items", [])

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
