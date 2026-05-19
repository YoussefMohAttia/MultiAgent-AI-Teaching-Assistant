"""
Student summary evaluator service — 6-dimension hybrid evaluation.

Extracted from Ai Team/Main/EVALUATOR.ipynb.

Uses hybrid scoring aligned with EVALUATOR.ipynb:
- embeddings + ROUGE for deterministic metrics
- LLM judging for coherence

Model: configurable evaluator model via settings.EVALUATOR_MODEL_NAME
Ground truth: summarizer service output + extracted lecture key points
"""

from __future__ import annotations

import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from typing import Dict, List, Optional, Tuple

import numpy as np

from services.openrouter_client import chat_completion
from Core.config import settings

log = logging.getLogger(__name__)

# ── Lazy singletons (loaded on first evaluation) ─────────────────────────────
_rouge_scorer_mod = None
_nltk_ready = False
_embedder_mod = None


def _get_rouge_scorer():
    global _rouge_scorer_mod
    if _rouge_scorer_mod is None:
        from rouge_score import rouge_scorer as rs
        _rouge_scorer_mod = rs
    return _rouge_scorer_mod


def _get_embedder():
    global _embedder_mod
    if _embedder_mod is None:
        from sentence_transformers import SentenceTransformer
        _embedder_mod = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder_mod


_JSON_RE = re.compile(r"\{.*?\}", re.DOTALL)


def _extract_json_block(raw: str) -> Dict:
    if not raw:
        raise ValueError("Empty response")
    for match in _JSON_RE.findall(raw):
        try:
            return json.loads(match)
        except json.JSONDecodeError:
            continue
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end > start:
        return json.loads(raw[start:end + 1])
    raise ValueError("No JSON object found")


def _ensure_nltk():
    global _nltk_ready
    if not _nltk_ready:
        import nltk
        nltk.download("punkt", quiet=True)
        nltk.download("punkt_tab", quiet=True)
        nltk.download("stopwords", quiet=True)
        _nltk_ready = True


# ── Helper: OpenAI chat via Google AI Studio  12B) ────────────────
# Keep evaluator calls single-shot: no retries/fallback to cap call volume.


def _ai_chat(prompt: str, max_tokens: int = 500) -> str:
    model_name = settings.EVALUATOR_MODEL_NAME
    log.info("_ai_chat single attempt (model=%s)", model_name)
    return chat_completion(
        prompt,
        max_tokens=max_tokens,
        temperature=0.3,
        model=model_name,
        timeout_s=settings.EVALUATOR_LLM_TIMEOUT_S,
    )


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
        data = _extract_json_block(raw)
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
    return _ai_chat(prompt, max_tokens=900)


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
        raw = _ai_chat(prompt, max_tokens=450)
        data = _extract_json_block(raw)
        pts = data.get("key_points", [])
        if isinstance(pts, list):
            cleaned = [str(p).strip() for p in pts if str(p).strip()]
            if len(cleaned) >= 3:
                return cleaned
    except Exception:
        pass
    return _fallback_key_points(lecture)


def _fallback_key_points(lecture: str, n: int = 8) -> List[str]:
    _ensure_nltk()
    try:
        from nltk.tokenize import sent_tokenize
        sentences = sent_tokenize(lecture)
    except Exception:
        sentences = re.split(r"(?<=[.!?])\s+", lecture)

    cleaned = [re.sub(r"\s+", " ", s).strip() for s in sentences]
    filtered = [s for s in cleaned if len(s.split()) >= 6]

    if not filtered:
        return [lecture[:200]]

    seen = set()
    uniq = []
    for s in filtered:
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        uniq.append(s)

    if len(uniq) <= n:
        return uniq[:n]

    step = max(1, len(uniq) // n)
    return [uniq[i] for i in range(0, len(uniq), step)][:n]


# ══════════════════════════════════════════════════════════════════════════════
#  6 Scoring functions — each returns (score, detail_text)
# ══════════════════════════════════════════════════════════════════════════════

def _score_correctness(student: str, reference: str, lecture: str) -> Tuple[float, str]:
    """Notebook-aligned hybrid correctness.

    40% cosine(student, lecture) + 35% cosine(student, reference) + 25% ROUGE-F1.
    """
    from sentence_transformers import util

    embedder = _get_embedder()
    emb_s = embedder.encode(student, convert_to_tensor=True)
    emb_r = embedder.encode(reference, convert_to_tensor=True)
    emb_l = embedder.encode(lecture, convert_to_tensor=True)

    cos_ref = float(util.cos_sim(emb_s, emb_r))
    cos_lecture = float(util.cos_sim(emb_s, emb_l))

    rs_mod = _get_rouge_scorer()
    sc = rs_mod.RougeScorer(["rouge1", "rougeL"], use_stemmer=True)
    rs = sc.score(reference, student)
    rouge = (rs["rouge1"].fmeasure + rs["rougeL"].fmeasure) / 2

    hybrid = 0.40 * cos_lecture + 0.35 * cos_ref + 0.25 * rouge
    detail = f"cos_lecture={cos_lecture:.2f}, cos_ref={cos_ref:.2f}, rouge_f1={rouge:.2f}"
    return round(hybrid * 10, 2), detail


def _score_relevance(student: str, lecture: str) -> Tuple[float, str]:
    from sentence_transformers import util

    embedder = _get_embedder()
    chunks = [p.strip() for p in re.split(r"\n{2,}", lecture) if len(p.strip()) > 60]
    if not chunks:
        chunks = [lecture]

    emb_s = embedder.encode(student, convert_to_tensor=True)
    emb_c = embedder.encode(chunks, convert_to_tensor=True)
    sims = util.cos_sim(emb_s, emb_c)[0]

    score = 0.4 * float(sims.mean()) + 0.6 * float(sims.max())
    return round(score * 10, 2), f"mean_sim={float(sims.mean()):.2f}, max_sim={float(sims.max()):.2f}"


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
        data = _extract_json_block(raw)
        return round(float(data.get("score", 5)), 2), data.get("reason", "No reason provided.")
    except Exception as e:
        return 5.0, f"Evaluation error: {e}"


def _score_completeness(student: str, reference: str, key_points: List[str]) -> Tuple[float, str]:
    """Notebook-aligned hybrid completeness.

    50% key-point embedding coverage + 50% ROUGE recall.
    """
    from sentence_transformers import util

    embedder = _get_embedder()

    if key_points:
        emb_s = embedder.encode(student, convert_to_tensor=True)
        emb_kp = embedder.encode(key_points, convert_to_tensor=True)
        sims = util.cos_sim(emb_s, emb_kp)[0]
        covered = float((sims > 0.40).float().mean())
    else:
        covered = 0.5

    rs_mod = _get_rouge_scorer()
    sc = rs_mod.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
    rs = sc.score(reference, student)
    recall = (rs["rouge1"].recall + rs["rouge2"].recall + rs["rougeL"].recall) / 3

    hybrid = 0.50 * covered + 0.50 * recall
    detail = f"covered={covered:.2f}, rouge_recall={recall:.2f}"
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
    Run the full 6-metric evaluation.

    If *reference_summary* is not provided it will be generated by the
    **summarizer service**  to serve as ground truth.
    If *key_points* are not provided they will be extracted from the lecture
    using the configured evaluator model.

    Returns {
        "scores": { metric_name: {"score": float, "detail": str}, ... },
        "overall": float,
        "reference_summary": str,
        "key_points": list[str],
    }
    """
    lecture_ctx = lecture_text

    def _generate_reference_summary() -> str:
        log.info("[EVAL] Generating reference summary ...")
        from services.summarizer_service import summarize_text
        try:
            return summarize_text(lecture_ctx)
        except Exception as e:
            log.warning("[EVAL] Reference summary generation failed, using trimmed lecture fallback: %s", e)
            return lecture_ctx[:1500]

    def _extract_key_points_safe() -> List[str]:
        log.info("[EVAL] Extracting key points ...")
        try:
            return extract_key_points(lecture_ctx)
        except Exception as e:
            log.warning("[EVAL] Key point extraction failed, using lecture fallback: %s", e)
            return [lecture_ctx[:200]]

    results: Dict[str, Dict] = {}

    def _save_result(name: str, score: float, detail: str) -> None:
        results[name] = {"score": score, "detail": detail}
        log.info("[EVAL] %s = %.2f", name, score)

    _ensure_nltk()

    with ThreadPoolExecutor(max_workers=4) as executor:
        ref_future = None
        kp_future = None
        if reference_summary is None:
            ref_future = executor.submit(_generate_reference_summary)
        if key_points is None:
            kp_future = executor.submit(_extract_key_points_safe)

        llm_futures = {
            "coherence": executor.submit(_score_coherence, student_summary),
        }

        reference_ctx = reference_summary if reference_summary is not None else ref_future.result()
        key_points = key_points if key_points is not None else kp_future.result()

        _save_result("correctness", *_score_correctness(student_summary, reference_ctx, lecture_ctx))
        _save_result("relevance", *_score_relevance(student_summary, lecture_ctx))
        _save_result("completeness", *_score_completeness(student_summary, reference_ctx, key_points))
        _save_result("conciseness", *_score_conciseness(student_summary, reference_ctx))
        _save_result("terminology", *_score_terminology(student_summary, lecture_ctx))
        for name, future in llm_futures.items():
            score, detail = future.result()
            _save_result(name, score, detail)

    overall = round(
        sum(v["score"] for v in results.values()) / len(results), 2
    )

    return {
        "scores": results,
        "overall": overall,
        "reference_summary": reference_ctx,
        "key_points": key_points,
    }
