"""
Quiz helper utilities for criteria matching and response shaping.
"""

from __future__ import annotations

from typing import Any, Iterable, List, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from DB.schemas import Quiz as QuizORM
from DB.schemas import QuizDocument as QuizDocumentORM


def _normalize_options(options: Any) -> List[str]:
    if options is None:
        return []
    if isinstance(options, list):
        return [str(option) for option in options]
    if isinstance(options, dict):
        return [str(option) for option in options.values()]
    return [str(options)]


def compute_quiz_criteria(questions: Iterable) -> Tuple[int, int]:
    questions_list = list(questions)
    question_count = len(questions_list)
    option_count = 0

    for question in questions_list:
        options = _normalize_options(getattr(question, "options", None))
        if options:
            option_count = len(options)
            break

    return question_count, option_count


def build_quiz_items(questions: Iterable) -> List[dict]:
    items = []
    for question in questions:
        options = _normalize_options(getattr(question, "options", None))
        correct_answer = getattr(question, "correct_answer", None)
        answer_index = options.index(correct_answer) if correct_answer in options else 0
        items.append(
            {
                "stem": getattr(question, "question", ""),
                "options": options,
                "answer_index": answer_index,
            }
        )
    return items


async def find_quiz_by_doc_and_criteria(
    db: AsyncSession,
    *,
    doc_id: int,
    n_items: int,
    n_options: int,
) -> QuizORM | None:
    quiz_ids = (
        await db.execute(
            select(QuizDocumentORM.quiz_id).where(QuizDocumentORM.doc_id == doc_id)
        )
    ).scalars().all()
    if not quiz_ids:
        return None

    quizzes = (
        await db.execute(
            select(QuizORM)
            .options(selectinload(QuizORM.questions))
            .where(QuizORM.id.in_(quiz_ids))
        )
    ).scalars().all()

    for quiz in quizzes:
        question_count, option_count = compute_quiz_criteria(quiz.questions)
        if question_count == n_items and option_count == n_options:
            return quiz

    return None
