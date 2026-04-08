"""
Production-ready essay grading module for backend integration.

Default behavior is aligned with the selected production profile:
- Fine-tuned checkpoint (regression or ordinal auto-detected)
- Ordinal decode threshold = 0.50
- No post-hoc calibration

Example backend usage:
    from essaygrader_backend_module import GraderConfig, EssayGrader

    cfg = GraderConfig(model_path="./fine_tuned_essaygrader)
    grader = EssayGrader(cfg)
    result = grader.predict("Some IELTS essay text")
    print(result.to_dict())
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Callable, Optional
import argparse
import json

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


MAX_BAND = 9.0
BAND_STEP = 0.5


@dataclass
class GraderConfig:
    model_path: str = "./fine_tuned_essaygrader"
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

    def to_dict(self) -> dict:
        return asdict(self)


class EssayGrader:
    """Backend-friendly grader wrapper around a Hugging Face checkpoint."""

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
        """Predict IELTS overall band for one essay."""
        text = self._build_input_text(essay, question)
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
        )

    def predict_batch(
        self,
        essays: list[str],
        questions: Optional[list[Optional[str]]] = None,
    ) -> list[GradeResult]:
        """Predict IELTS bands for a list of essays."""
        if questions is not None and len(questions) != len(essays):
            raise ValueError("questions length must match essays length")

        out: list[GradeResult] = []
        for idx, essay in enumerate(essays):
            q = questions[idx] if questions is not None else None
            out.append(self.predict(essay=essay, question=q))
        return out


def _read_essay_from_args(args: argparse.Namespace) -> str:
    if args.essay_text and args.essay_file:
        raise ValueError("Use either --essay-text or --essay-file, not both.")

    if args.essay_file:
        with open(args.essay_file, "r", encoding="utf-8") as f:
            text = f.read().strip()
    elif args.essay_text:
        text = args.essay_text.strip()
    else:
        raise ValueError("Provide --essay-text or --essay-file.")

    if not text:
        raise ValueError("Essay text is empty.")
    return text


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Production essay grader module (single-essay CLI)",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--model", default="./fine_tuned_essaygrader_ordinal_balanced", help="Model path or HF id")
    parser.add_argument("--essay-text", default=None, help="Essay text inline")
    parser.add_argument("--essay-file", default=None, help="Path to text file containing one essay")
    parser.add_argument("--question", default=None, help="Optional question/prompt")
    parser.add_argument("--max-length", type=int, default=512, help="Tokenizer max length")
    parser.add_argument("--device", default=None, choices=["cpu", "cuda", None], help="Force device")
    parser.add_argument("--ordinal-threshold", type=float, default=0.50, help="Ordinal decision threshold")
    parser.add_argument("--use-question-prefix", action="store_true", help="Prefix question before essay")
    parser.add_argument("--calibration-method", choices=["none", "linear"], default="none")
    parser.add_argument("--calibration-slope", type=float, default=1.0)
    parser.add_argument("--calibration-intercept", type=float, default=0.0)
    args = parser.parse_args()

    essay = _read_essay_from_args(args)

    cfg = GraderConfig(
        model_path=args.model,
        max_length=args.max_length,
        device=args.device,
        ordinal_threshold=args.ordinal_threshold,
        use_question_prefix=args.use_question_prefix,
        calibration_method=args.calibration_method,
        calibration_slope=args.calibration_slope,
        calibration_intercept=args.calibration_intercept,
    )

    grader = EssayGrader(cfg)
    result = grader.predict(essay=essay, question=args.question)
    print(json.dumps(result.to_dict(), indent=2))


if __name__ == "__main__":
    main()
