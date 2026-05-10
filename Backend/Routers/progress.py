from __future__ import annotations

from datetime import datetime

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from Core.config import settings
from DB import crud
from DB.models import ProgressEvent, ProgressSummary
from DB.session import get_db
from services.progress_service import (
    apply_streak,
    build_achievements,
    build_task_payload,
    ensure_daily_tasks,
    ensure_progress,
    event_to_metric_delta,
    get_leaderboard,
    resolve_level,
    update_tasks_for_metrics,
)

router = APIRouter()


async def _get_user_from_request(request: Request, db: AsyncSession):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    google_id = payload.get("sub")
    if not google_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = await crud.get_user_by_google_id(db, google_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


async def _build_summary(db: AsyncSession, progress, tasks) -> dict:
    level, rank, next_xp, level_progress = resolve_level(progress.xp)
    progress.level = level
    progress.rank_title = rank

    achievements = build_achievements(progress)
    leaderboard = await get_leaderboard(db, limit=10)

    totals = {
        "summaries": progress.summaries,
        "quizzes_generated": progress.quizzes_generated,
        "quizzes_taken": progress.quizzes_taken,
        "quiz_correct": progress.quiz_correct,
        "pomodoro_cycles": progress.pomodoro_cycles,
        "chats": progress.chats,
        "essays": progress.essays,
        "evaluations": progress.evaluations,
    }

    return {
        "xp": progress.xp,
        "level": level,
        "rank": rank,
        "next_level_xp": next_xp,
        "level_progress": level_progress,
        "day_streak": progress.day_streak,
        "totals": totals,
        "achievements": achievements,
        "tasks": build_task_payload(tasks),
        "leaderboard": leaderboard,
    }


@router.get("/me", response_model=ProgressSummary)
async def get_my_progress(request: Request, db: AsyncSession = Depends(get_db)):
    user = await _get_user_from_request(request, db)
    today = datetime.utcnow().date()

    progress = await ensure_progress(db, user.id)
    apply_streak(progress, today)
    tasks = await ensure_daily_tasks(db, user.id, today)

    summary = await _build_summary(db, progress, tasks)
    await db.commit()
    return summary


@router.post("/event", response_model=ProgressSummary)
async def log_progress_event(
    request: Request,
    payload: ProgressEvent,
    db: AsyncSession = Depends(get_db),
):
    user = await _get_user_from_request(request, db)
    today = datetime.utcnow().date()

    progress = await ensure_progress(db, user.id)
    apply_streak(progress, today)

    xp_delta, metric_deltas = event_to_metric_delta(
        payload.event_type, payload.amount, payload.correct
    )

    for metric_key, delta in metric_deltas:
        current = getattr(progress, metric_key, 0) or 0
        setattr(progress, metric_key, current + max(0, int(delta)))

    tasks = await ensure_daily_tasks(db, user.id, today)
    xp_bonus = update_tasks_for_metrics(tasks, metric_deltas)

    progress.xp = max(0, int(progress.xp) + xp_delta + xp_bonus)

    summary = await _build_summary(db, progress, tasks)
    await db.commit()
    return summary


@router.get("/leaderboard")
async def get_progress_leaderboard(db: AsyncSession = Depends(get_db)):
    return {"leaderboard": await get_leaderboard(db, limit=20)}
