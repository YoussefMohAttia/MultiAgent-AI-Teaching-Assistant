"""
Shared Google AI Studio / OpenAI-compatible client used by all AI services.
"""

from openai import OpenAI
from Core.config import settings


def get_ai_client() -> OpenAI:
    """Return an OpenAI SDK client pointed at the Google AI Studio API."""
    if not settings.GOOGLE_AI_API_KEY:
        raise EnvironmentError(
            "GOOGLE_AI_API_KEY is not configured. "
            "Set it in .env or as an environment variable."
        )
    return OpenAI(
        api_key=settings.GOOGLE_AI_API_KEY,
        base_url=settings.GOOGLE_AI_BASE_URL,
    )


# Keep legacy alias so existing imports don't break during transition
get_openrouter_client = get_ai_client


def chat_completion(
    prompt: str,
    *,
    system: str = "You are an expert academic assistant.",
    model: str | None = None,
    temperature: float = 0.3,
    max_tokens: int = 1500,
) -> str:
    """Send a single prompt and return the assistant's text response."""
    client = get_ai_client()
    resolved_model = model or settings.AI_MODEL_NAME

    # Gemma models on Google AI Studio don't support system instructions.
    # Merge the system message into the user prompt for those models.
    _models_without_system = {"gemma"}
    model_lower = resolved_model.lower()
    if any(tag in model_lower for tag in _models_without_system):
        merged_prompt = f"{system}\n\n{prompt}" if system else prompt
        messages = [{"role": "user", "content": merged_prompt}]
    else:
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ]

    response = client.chat.completions.create(
        model=resolved_model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content.strip()
