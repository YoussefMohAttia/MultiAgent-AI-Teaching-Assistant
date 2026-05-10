"""
Essay grading service using a fine-tuned Hugging Face sequence classifier.

Loads the model lazily on first request and keeps it in memory for reuse.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock
from typing import Callable, Optional
import re

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from Core.config import settings

MAX_BAND = 9.0
BAND_STEP = 0.5


@dataclass
class GraderConfig:
    model_path: str
    max_length: int = 512
    device: Optional[str] = None
    ordinal_threshold: float = 0.50
    use_question_prefix: bool = False
    calibration_method: str = "none"  # one of: none, linear
    calibration_slope: float = 1.0
    calibration_intercept: float = 0.0


@dataclass
class GradeResult:
    predicted_band: float
    raw_band: float
    calibrated_band: float
    objective: str
    ordinal_threshold: float
    word_count: int
    model_path: str

    def to_dict(self) -> dict:
        return asdict(self)


class EssayGrader:
    def __init__(self, config: GraderConfig):
        self.config = config
        self.device = self._resolve_device(config.device)
        self.tokenizer = AutoTokenizer.from_pretrained(config.model_path)
        self.model = AutoModelForSequenceClassification.from_pretrained(config.model_path)
        self.model.to(self.device)
        self.model.eval()

        num_labels = int(getattr(self.model.config, "num_labels", 1))
        self.objective = "ordinal" if num_labels > 1 else "regression"

        if self.config.calibration_method not in {"none", "linear"}:
            raise ValueError("calibration_method must be one of: 'none', 'linear'")

        self._calibrate_fn = self._build_calibrator()

    @staticmethod
    def _resolve_device(device: Optional[str]) -> str:
        if device:
            return device
        return "cuda" if torch.cuda.is_available() else "cpu"

    def _build_input_text(self, essay: str, question: Optional[str]) -> str:
        essay_text = essay.strip()
        if not essay_text:
            raise ValueError("Essay text is empty.")

        if not self.config.use_question_prefix:
            return essay_text

        if question is None or not question.strip():
            return essay_text

        return f"{question.strip()} {essay_text}"

    @staticmethod
    def _clip_band(value: float) -> float:
        return float(min(MAX_BAND, max(0.0, value)))

    @staticmethod
    def _round_to_half(value: float) -> float:
        return round(float(value) * 2.0) / 2.0

    def _build_calibrator(self) -> Callable[[float], float]:
        if self.config.calibration_method == "none":
            return lambda v: self._clip_band(float(v))

        slope = float(self.config.calibration_slope)
        intercept = float(self.config.calibration_intercept)
        return lambda v: self._clip_band(slope * float(v) + intercept)

    @torch.no_grad()
    def _forward_logits(self, text: str) -> torch.Tensor:
        encoded = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=self.config.max_length,
        )
        encoded = {k: v.to(self.device) for k, v in encoded.items()}
        outputs = self.model(**encoded)
        return outputs.logits

    def _decode_regression_band(self, logits: torch.Tensor) -> float:
        val = float(logits.detach().cpu().squeeze())
        return self._clip_band(val * MAX_BAND)

    def _decode_ordinal_band(self, logits: torch.Tensor) -> float:
        x = logits.detach().cpu()
        probs = torch.sigmoid(x.squeeze(0)) if x.dim() == 2 else torch.sigmoid(x)
        passed = int((probs >= float(self.config.ordinal_threshold)).sum().item())
        return self._clip_band(passed * BAND_STEP)

    def _decode_raw_band(self, logits: torch.Tensor) -> float:
        if self.objective == "ordinal":
            return self._decode_ordinal_band(logits)
        return self._decode_regression_band(logits)

    def predict(self, essay: str, question: Optional[str] = None) -> GradeResult:
        text = self._build_input_text(essay=essay, question=question)
        logits = self._forward_logits(text)

        raw_band = self._decode_raw_band(logits)
        calibrated_band = self._calibrate_fn(raw_band)
        predicted_band = self._round_to_half(calibrated_band)

        return GradeResult(
            predicted_band=predicted_band,
            raw_band=raw_band,
            calibrated_band=calibrated_band,
            objective=self.objective,
            ordinal_threshold=float(self.config.ordinal_threshold),
            word_count=len(essay.split()),
            model_path=self.config.model_path,
        )


def _resolve_model_path() -> str:
    configured = getattr(settings, "ESSAY_GRADER_MODEL_PATH", "")
    if configured:
        p = Path(configured)
        if p.exists():
            return str(p.resolve())

    backend_root = Path(__file__).resolve().parents[1]
    workspace_root = backend_root.parent

    candidates = [
        backend_root / "final_essay_grader" / "fine_tuned_essaygrader",
        backend_root / "models" / "fine_tuned_essaygrader",
        workspace_root / "Ai Team" / "Main" / "final_essay_grader" / "fine_tuned_essaygrader",
    ]

    for p in candidates:
        if p.exists():
            return str(p.resolve())

    raise FileNotFoundError(
        "Essay grader model directory not found. Set ESSAY_GRADER_MODEL_PATH in backend/.env "
        "or place the model folder at one of the expected locations."
    )


_grader: EssayGrader | None = None
_grader_lock = Lock()


def get_essay_grader() -> EssayGrader:
    global _grader

    if _grader is not None:
        return _grader

    with _grader_lock:
        if _grader is None:
            cfg = GraderConfig(model_path=_resolve_model_path())
            _grader = EssayGrader(cfg)

    return _grader


def _validate_essay_text(essay_text: str) -> None:
    """Reject clearly invalid input to avoid misleading model scores.

    Fine-tuned graders can output mid-range scores on out-of-distribution text
    (e.g., gibberish). These checks gate low-quality input before inference.
    """
    text = essay_text.strip()
    words = re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", text)
    lower_words = [w.lower() for w in words]

    if len(words) < 30:
        raise ValueError("Essay text is too short. Please provide at least 30 words.")

    # Require at least modest lexical variety.
    unique_ratio = len(set(lower_words)) / max(len(words), 1)
    if unique_ratio < 0.18:
        raise ValueError("Essay text appears repetitive or not meaningful. Please provide clear prose.")

    # Ensure the text has enough alphabetic signal (not random symbols/noise).
    alpha_chars = sum(1 for ch in text if ch.isalpha())
    alnum_chars = sum(1 for ch in text if ch.isalnum())
    alpha_ratio = alpha_chars / max(alnum_chars, 1)
    if alpha_ratio < 0.7:
        raise ValueError("Essay text appears noisy or malformed. Please provide readable English text.")

    # Require signs of real English prose, not random tokens.
    stopwords = {
        "the", "a", "an", "and", "or", "but", "if", "then", "than", "that", "this",
        "these", "those", "to", "of", "in", "on", "for", "from", "with", "by", "as",
        "is", "are", "was", "were", "be", "been", "being", "it", "its", "at", "we",
        "you", "they", "he", "she", "my", "our", "their", "not", "can", "could", "should",
        "will", "would", "do", "does", "did", "have", "has", "had", "which", "who",
        "what", "when", "where", "why", "how", "also", "because", "while", "about",
    }
    stopword_hits = sum(1 for w in lower_words if w in stopwords)
    if stopword_hits < 4:
        raise ValueError(
            "Essay text does not look like natural English writing. Please write full, meaningful sentences."
        )

    # Expect at least one sentence boundary in essay-like prose.
    sentence_marks = sum(text.count(mark) for mark in (".", "!", "?"))
    if sentence_marks < 1:
        raise ValueError(
            "Essay text should contain complete sentences with punctuation."
        )


def grade_essay(essay_text: str, question: Optional[str] = None) -> dict:
    _validate_essay_text(essay_text)
    grader = get_essay_grader()
    result = grader.predict(essay=essay_text, question=question)
    return result.to_dict()
