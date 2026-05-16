"""Deduplicate quizzes linked to the same document by criteria.

Keeps the newest quiz per (document, question_count, option_count).
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime

from sqlalchemy import delete
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from DB.session import AsyncSessionLocal
from DB.schemas import Quiz as QuizORM
from DB.schemas import QuizDocument as QuizDocumentORM
from DB.schemas import QuizAttempt as QuizAttemptORM
from DB.schemas import QuizQuestion as QuizQuestionORM
from services.quiz_utils import compute_quiz_criteria


async def dedupe_quizzes(dry_run: bool = True) -> None:
    async with AsyncSessionLocal() as db:
        doc_ids = (
            await db.execute(select(QuizDocumentORM.doc_id).distinct())
        ).scalars().all()

        total_deleted = 0
        total_groups = 0

        for doc_id in doc_ids:
            quiz_ids = (
                await db.execute(
                    select(QuizDocumentORM.quiz_id).where(QuizDocumentORM.doc_id == doc_id)
                )
            ).scalars().all()

            if len(quiz_ids) < 2:
                continue

            quizzes = (
                await db.execute(
                    select(QuizORM)
                    .options(selectinload(QuizORM.questions))
                    .where(QuizORM.id.in_(quiz_ids))
                )
            ).scalars().all()

            groups: dict[tuple[int, int], list[QuizORM]] = defaultdict(list)
            for quiz in quizzes:
                criteria = compute_quiz_criteria(quiz.questions)
                groups[criteria].append(quiz)

            for criteria, bucket in groups.items():
                if len(bucket) < 2:
                    continue

                total_groups += 1
                bucket.sort(
                    key=lambda q: q.created_at or datetime.min,
                    reverse=True,
                )
                keep = bucket[0]
                delete_ids = [q.id for q in bucket[1:]]

                print(
                    f"Doc {doc_id} criteria {criteria}: keep quiz {keep.id}, delete {delete_ids}"
                )

                if dry_run:
                    continue

                await db.execute(delete(QuizAttemptORM).where(QuizAttemptORM.quiz_id.in_(delete_ids)))
                await db.execute(delete(QuizQuestionORM).where(QuizQuestionORM.quiz_id.in_(delete_ids)))
                await db.execute(delete(QuizDocumentORM).where(QuizDocumentORM.quiz_id.in_(delete_ids)))
                await db.execute(delete(QuizORM).where(QuizORM.id.in_(delete_ids)))
                total_deleted += len(delete_ids)

        if not dry_run:
            await db.commit()

        print(
            f"Dedup complete. Groups with duplicates: {total_groups}, quizzes deleted: {total_deleted}."
        )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Deduplicate document-linked quizzes")
    parser.add_argument("--apply", action="store_true", help="Apply deletions")
    args = parser.parse_args()

    asyncio.run(dedupe_quizzes(dry_run=not args.apply))
