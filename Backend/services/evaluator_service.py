"""
Student summary evaluator service — 10-dimension hybrid evaluation.

Extracted from Ai Team/Main/EVALUATOR.ipynb.

Uses LLM-based scoring for semantic analysis and ROUGE/NLTK for
lexical metrics. Avoids heavy sentence-transformers/torch dependency.

Model: Gemma 3 12B (for evaluation scoring)
Ground truth: Summarizer service output via Gemma 3 27B
"""

from __future__ import annotations

import json
import logging
import re
import time
from collections import Counter
from typing import Dict, List, Optional, Tuple

import numpy as np

from services.openrouter_client import chat_completion
from Core.config import settings

log = logging.getLogger(__name__)

# ── Lazy singletons (loaded on first evaluation) ─────────────────────────────
_rouge_scorer_mod = None
_nltk_ready = False


def _get_rouge_scorer():
    global _rouge_scorer_mod
    if _rouge_scorer_mod is None:
        from rouge_score import rouge_scorer as rs
        _rouge_scorer_mod = rs
    return _rouge_scorer_mod


def _ensure_nltk():
    global _nltk_ready
    if not _nltk_ready:
        import nltk
        nltk.download("punkt", quiet=True)
        nltk.download("punkt_tab", quiet=True)
        nltk.download("stopwords", quiet=True)
        _nltk_ready = True


# ── Helper: OpenAI chat via Google AI Studio (Gemma 3 12B) ────────────────
# Free tier may have RPM limits — retry with exponential backoff.
_RETRY_MAX = 3
_RETRY_BASE_DELAY = 15  # seconds


def _ai_chat(prompt: str, max_tokens: int = 500) -> str:
    for attempt in range(_RETRY_MAX + 1):
        try:
            log.info("_ai_chat attempt %d/%d (model=%s)", attempt + 1, _RETRY_MAX + 1, settings.EVALUATOR_MODEL_NAME)
            result = chat_completion(
                prompt,
                max_tokens=max_tokens,
                temperature=0.3,
                model=settings.EVALUATOR_MODEL_NAME,
            )
            log.info("_ai_chat succeeded on attempt %d", attempt + 1)
            return result
        except Exception as e:
            log.warning("_ai_chat attempt %d failed: %s", attempt + 1, e)
            if "429" in str(e) and attempt < _RETRY_MAX:
                wait = _RETRY_BASE_DELAY * (2 ** attempt)
                log.info("Rate limited — sleeping %ds before retry", wait)
                time.sleep(wait)
                continue
            raise


def _ai_score(criteria_name: str, criteria_desc: str, student: str,
              context_label: str = "LECTURE", context: str = "") -> Tuple[float, str]:
    """Generic LLM-based scorer that returns (score, detail)."""
    ctx_block = f'\n{context_label}:\n"""\n{context}\n"""\n\n' if context else "\n"
    prompt = (
        f"Evaluate the {criteria_name} of the student summary below on a scale of 0-10.\n\n"
        f"Criteria:\n{criteria_desc}\n"
        f"{ctx_block}"
        f'Student Summary:\n"""\n{student}\n"""\n\n'
        'Respond ONLY with valid JSON: {"score": <number 0-10>, "reason": "<1-2 sentences>"}'
    )
    try:
        raw = _ai_chat(prompt, max_tokens=250)
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        data = json.loads(m.group()) if m else {}
        return round(float(data.get("score", 5)), 2), data.get("reason", "No reason provided.")
    except Exception as e:
        return 5.0, f"Evaluation error: {e}"


# ── Reference summary & key-point extraction ─────────────────────────────────

def generate_reference_summary(lecture: str) -> str:
    prompt = (
        "Read the lecture below carefully and write a comprehensive, accurate, "
        "and well-structured summary that:\n"
        "  - Covers ALL key concepts, definitions, and main ideas\n"
        "  - Preserves important terminology exactly as used in the lecture\n"
        "  - Is logically organised with clear transitions between ideas\n"
        "  - Is written in clear, formal academic prose\n\n"
        f"LECTURE:\n{lecture}\n\nSUMMARY:"
    )
    return _ai_chat(prompt, max_tokens=1500)


def extract_key_points(lecture: str) -> List[str]:
    prompt = (
        "Read the lecture below and extract exactly 15 key points.\n\n"
        "Rules for key points:\n"
        "  - Each point must be a SHORT, CONCRETE, FACTUAL statement (1-2 sentences max)\n"
        "  - Cover the most important concepts, facts, arguments, trade-offs, and conclusions\n"
        "  - Include specific details where relevant (names, numbers, examples)\n"
        "  - Do NOT paraphrase vaguely — be precise and grounded in the lecture text\n"
        "  - Cover different sections of the lecture (not just the introduction)\n\n"
        f"LECTURE:\n{lecture}\n\n"
        'Return ONLY valid JSON: {{"key_points": ["<point1>", "<point2>", ..., "<point15>"]}}'
    )
    try:
        raw = _ai_chat(prompt, max_tokens=1000)
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        data = json.loads(m.group()) if m else {}
        pts = data.get("key_points", [])
        return pts if pts else [lecture[:200]]
    except Exception:
        return [lecture[:200]]


# ══════════════════════════════════════════════════════════════════════════════
#  10 Scoring functions — each returns (score, detail_text)
# ══════════════════════════════════════════════════════════════════════════════

def _score_correctness(student: str, reference: str, lecture: str) -> Tuple[float, str]:
    """Hybrid: ROUGE against reference + LLM accuracy check."""
    rs_mod = _get_rouge_scorer()
    sc = rs_mod.RougeScorer(["rouge1", "rougeL"], use_stemmer=True)
    rs = sc.score(reference, student)
    rouge = (rs["rouge1"].fmeasure + rs["rougeL"].fmeasure) / 2

    llm_score, llm_reason = _ai_score(
        "CORRECTNESS",
        "  - Summary accurately reflects the lecture content\n"
        "  - No misrepresentations or distortions of the original ideas\n"
        "  - Key facts and relationships are preserved",
        student, "LECTURE", lecture,
    )

    hybrid = 0.50 * (llm_score / 10) + 0.50 * rouge
    detail = f"ROUGE={rouge:.2f}, LLM={llm_score}/10. {llm_reason}"
    return round(hybrid * 10, 2), detail


def _score_relevance(student: str, lecture: str) -> Tuple[float, str]:
    return _ai_score(
        "RELEVANCE",
        "  - Summary focuses on the most important topics from the lecture\n"
        "  - No off-topic or irrelevant content\n"
        "  - Covers the core ideas proportionally",
        student, "LECTURE", lecture,
    )


def _score_coherence(student: str) -> Tuple[float, str]:
    prompt = (
        "Evaluate the COHERENCE of the student summary below on a scale of 0-10.\n\n"
        "Coherence criteria:\n"
        "  - Ideas flow logically\n"
        "  - Clear transitions and connective phrases\n"
        "  - No contradictions or abrupt topic jumps\n"
        "  - Well-organised, easy to follow\n\n"
        f'Student Summary:\n"""\n{student}\n"""\n\n'
        'Respond ONLY with valid JSON: {"score": <number 0-10>, "reason": "<1-2 sentences>"}'
    )
    try:
        raw = _ai_chat(prompt, max_tokens=200)
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        data = json.loads(m.group()) if m else {}
        return round(float(data.get("score", 5)), 2), data.get("reason", "No reason provided.")
    except Exception as e:
        return 5.0, f"Evaluation error: {e}"


def _score_completeness(student: str, reference: str, key_points: List[str]) -> Tuple[float, str]:
    """Hybrid: ROUGE recall + LLM completeness check."""
    rs_mod = _get_rouge_scorer()
    sc = rs_mod.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
    rs = sc.score(reference, student)
    recall = (rs["rouge1"].recall + rs["rouge2"].recall + rs["rougeL"].recall) / 3

    kp_text = "\n".join(f"- {p}" for p in key_points[:10]) if key_points else "(none)"
    llm_score, llm_reason = _ai_score(
        "COMPLETENESS",
        f"  - Covers all key points from the lecture:\n{kp_text}\n"
        "  - No important ideas are omitted\n"
        "  - Comprehensive coverage of the subject matter",
        student, "REFERENCE SUMMARY", reference,
    )

    hybrid = 0.50 * (llm_score / 10) + 0.50 * recall
    detail = f"ROUGE-recall={recall:.2f}, LLM={llm_score}/10. {llm_reason}"
    return round(hybrid * 10, 2), detail


def _score_conciseness(student: str, reference: str) -> Tuple[float, str]:
    ratio = len(student.split()) / max(len(reference.split()), 1)
    score = np.exp(-((ratio - 1.0) ** 2) / (2 * 0.55 ** 2)) * 10
    return round(float(np.clip(score, 0, 10)), 2), f"Length ratio: {ratio:.2f}x"


def _score_terminology(student: str, lecture: str) -> Tuple[float, str]:
    _ensure_nltk()
    from nltk.tokenize import word_tokenize
    from nltk.corpus import stopwords

    stop = set(stopwords.words("english"))

    def top_terms(text: str, n: int = 40) -> set:
        tokens = [w.lower() for w in word_tokenize(text) if w.isalpha() and len(w) > 3]
        tokens = [w for w in tokens if w not in stop]
        return {w for w, _ in Counter(tokens).most_common(n)}

    lecture_terms = top_terms(lecture, n=40)
    student_terms = {w.lower() for w in word_tokenize(student) if w.isalpha()}

    if not lecture_terms:
        return 5.0, "No domain terms extracted."
    matched = len(lecture_terms & student_terms)
    return round(matched / len(lecture_terms) * 10, 2), f"{matched}/{len(lecture_terms)} domain terms matched"


def _score_hallucination(student: str, lecture: str) -> Tuple[float, str]:
    prompt = (
        "Identify claims in the STUDENT SUMMARY NOT supported by the LECTURE.\n\n"
        f'LECTURE:\n"""\n{lecture}\n"""\n\n'
        f'STUDENT SUMMARY:\n"""\n{student}\n"""\n\n'
        'Return ONLY valid JSON:\n'
        '{"score": <0-10 where 10=no hallucinations>, '
        '"hallucinations": ["<claim1>", ...] or []}'
    )
    try:
        raw = _ai_chat(prompt, max_tokens=500)
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        data = json.loads(m.group()) if m else {}
        score = round(float(data.get("score", 7)), 2)
        items = data.get("hallucinations", [])
        detail = ("No unsupported claims detected." if not items
                  else "Unsupported claims: " + "; ".join(items[:4]))
        return score, detail
    except Exception as e:
        return 7.0, f"Evaluation error: {e}"


def _score_missing_points(student: str, key_points: List[str]) -> Tuple[float, str]:
    if not key_points:
        return 5.0, "No key points available."

    kp_text = "\n".join(f"{i+1}. {p}" for i, p in enumerate(key_points))
    prompt = (
        "Below is a list of key points from a lecture and a student summary.\n"
        "Determine which key points are MISSING from the student summary.\n\n"
        f"KEY POINTS:\n{kp_text}\n\n"
        f'STUDENT SUMMARY:\n"""\n{student}\n"""\n\n'
        'Return ONLY valid JSON: {"covered_count": <int>, "total": <int>, '
        '"missing": ["<point_number: brief description>", ...]}'
    )
    try:
        raw = _ai_chat(prompt, max_tokens=500)
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        data = json.loads(m.group()) if m else {}
        covered = int(data.get("covered_count", len(key_points) // 2))
        total = int(data.get("total", len(key_points)))
        missed = data.get("missing", [])
        score = round(covered / max(total, 1) * 10, 2)

        if not missed:
            detail = "All key lecture points appear to be covered."
        else:
            snippets = [str(p)[:80] for p in missed[:3]]
            detail = f"Missing ({len(missed)}/{total} pts): " + "; ".join(snippets)
        return score, detail
    except Exception as e:
        return 5.0, f"Evaluation error: {e}"


def _score_factual_accuracy(student: str, lecture: str) -> Tuple[float, str]:
    prompt = (
        "Check whether the specific facts in the STUDENT SUMMARY are accurate "
        "according to the LECTURE.\n\n"
        f'LECTURE:\n"""\n{lecture}\n"""\n\n'
        f'STUDENT SUMMARY:\n"""\n{student}\n"""\n\n'
        'Return ONLY valid JSON:\n'
        '{"score": <0-10>, "errors": ["<error1>", ...] or [], "reason": "<1 sentence>"}'
    )
    try:
        raw = _ai_chat(prompt, max_tokens=500)
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        data = json.loads(m.group()) if m else {}
        score = round(float(data.get("score", 7)), 2)
        errors = data.get("errors", [])
        reason = data.get("reason", "")
        detail = reason if not errors else reason + "  Errors: " + "; ".join(errors[:3])
        return score, detail
    except Exception as e:
        return 7.0, f"Evaluation error: {e}"


def _score_critical_analysis(student: str) -> Tuple[float, str]:
    prompt = (
        "Evaluate the CRITICAL ANALYSIS DEPTH of the student summary on a scale of 0-10.\n\n"
        "Criteria:\n"
        "  - Student explains WHY, not just WHAT\n"
        "  - Student identifies tensions, trade-offs, or ethical dilemmas\n"
        "  - Student synthesises ideas rather than just listing facts\n\n"
        f'Student Summary:\n"""\n{student}\n"""\n\n'
        'Respond ONLY with valid JSON: {"score": <number 0-10>, "reason": "<1-2 sentences>"}'
    )
    try:
        raw = _ai_chat(prompt, max_tokens=200)
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        data = json.loads(m.group()) if m else {}
        return round(float(data.get("score", 5)), 2), data.get("reason", "No reason provided.")
    except Exception as e:
        return 5.0, f"Evaluation error: {e}"


# ══════════════════════════════════════════════════════════════════════════════
#  Public API
# ══════════════════════════════════════════════════════════════════════════════

def evaluate_summary(
    student_summary: str,
    lecture_text: str,
    reference_summary: Optional[str] = None,
    key_points: Optional[List[str]] = None,
) -> Dict:
    """
    Run the full 10-metric evaluation.

    If *reference_summary* is not provided it will be generated by the
    **summarizer service** (Gemma 3 27B) to serve as ground truth.
    If *key_points* are not provided they will be extracted from the lecture
    using the evaluator model (Gemini 2.5 Flash).

    Returns {
        "scores": { metric_name: {"score": float, "detail": str}, ... },
        "overall": float,
        "reference_summary": str,
        "key_points": list[str],
    }
    """
    # Auto-generate reference summary using the Summarizer service (Gemma 3 27B)
    if reference_summary is None:
        log.info("[EVAL] Generating reference summary …")
        from services.summarizer_service import summarize_text
        reference_summary = summarize_text(lecture_text)
    if key_points is None:
        log.info("[EVAL] Extracting key points …")
        key_points = extract_key_points(lecture_text)

    # Run all 10 scorers
    results: Dict[str, Dict] = {}
    metrics = [
        ("correctness",      lambda: _score_correctness(student_summary, reference_summary, lecture_text)),
        ("relevance",        lambda: _score_relevance(student_summary, lecture_text)),
        ("coherence",        lambda: _score_coherence(student_summary)),
        ("completeness",     lambda: _score_completeness(student_summary, reference_summary, key_points)),
        ("conciseness",      lambda: _score_conciseness(student_summary, reference_summary)),
        ("terminology",      lambda: _score_terminology(student_summary, lecture_text)),
        ("hallucination",    lambda: _score_hallucination(student_summary, lecture_text)),
        ("missing_key_points", lambda: _score_missing_points(student_summary, key_points)),
        ("factual_accuracy", lambda: _score_factual_accuracy(student_summary, lecture_text)),
        ("critical_analysis", lambda: _score_critical_analysis(student_summary)),
    ]
    for i, (name, fn) in enumerate(metrics, 1):
        log.info("[EVAL] Scoring %d/10: %s", i, name)
        score, detail = fn()
        results[name] = {"score": score, "detail": detail}
        log.info("[EVAL] %s = %.2f", name, score)

    overall = round(
        sum(v["score"] for v in results.values()) / len(results), 2
    )

    return {
        "scores": results,
        "overall": overall,
        "reference_summary": reference_summary,
        "key_points": key_points,
    }
