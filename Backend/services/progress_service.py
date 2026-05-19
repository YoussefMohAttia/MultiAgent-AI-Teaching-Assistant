from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Dict, Iterable, List, Tuple

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from DB.schemas import User, UserProgress, UserTask

LEVEL_TABLE = [
    {"level": 1, "xp": 0, "rank": "Copper"},
    {"level": 2, "xp": 100, "rank": "Copper"},
    {"level": 3, "xp": 220, "rank": "Bronze"},
    {"level": 4, "xp": 380, "rank": "Bronze"},
    {"level": 5, "xp": 580, "rank": "Silver"},
    {"level": 6, "xp": 820, "rank": "Silver"},
    {"level": 7, "xp": 1100, "rank": "Gold"},
    {"level": 8, "xp": 1420, "rank": "Gold"},
    {"level": 9, "xp": 1800, "rank": "Platinum"},
    {"level": 10, "xp": 2250, "rank": "Platinum"},
    {"level": 11, "xp": 2750, "rank": "Emerald"},
    {"level": 12, "xp": 3300, "rank": "Emerald"},
    {"level": 13, "xp": 3900, "rank": "Diamond"},
    {"level": 14, "xp": 4600, "rank": "Diamond"},
    {"level": 15, "xp": 5400, "rank": "Champion"},
    {"level": 16, "xp": 6400, "rank": "Champion"},
    {"level": 17, "xp": 7600, "rank": "Grand Champion"},
    {"level": 18, "xp": 9000, "rank": "Grand Champion"},
    {"level": 19, "xp": 11000, "rank": "Legend"},
    {"level": 20, "xp": 14000, "rank": "Legend"},
]

TASK_DEFS = [
    {
        "key": "daily_summaries",
        "title": "Summarize twice",
        "description": "Generate 2 summaries today",
        "goal": 2,
        "metric_key": "summaries",
        "xp_reward": 50,
    },
    {
        "key": "daily_quiz_correct",
        "title": "Quiz accuracy",
        "description": "Answer 5 quiz questions correctly",
        "goal": 5,
        "metric_key": "quiz_correct",
        "xp_reward": 40,
    },
    {
        "key": "daily_focus",
        "title": "Focus sessions",
        "description": "Complete 2 pomodoro cycles",
        "goal": 2,
        "metric_key": "pomodoro_cycles",
        "xp_reward": 30,
    },
    {
        "key": "daily_tutor",
        "title": "Ask the tutor",
        "description": "Send 3 tutor questions",
        "goal": 3,
        "metric_key": "chats",
        "xp_reward": 20,
    },
    {
        "key": "daily_essay",
        "title": "Grade an essay",
        "description": "Submit 1 essay for grading",
        "goal": 1,
        "metric_key": "essays",
        "xp_reward": 25,
    },
    {
        "key": "daily_evaluation",
        "title": "Evaluate a summary",
        "description": "Run 1 summary evaluation",
        "goal": 1,
        "metric_key": "evaluations",
        "xp_reward": 25,
    },
]

ACHIEVEMENTS = [
    {"key": "streak_3", "title": "3-day streak", "metric_key": "day_streak", "goal": 3},
    {"key": "streak_7", "title": "7-day streak", "metric_key": "day_streak", "goal": 7},
    {"key": "streak_14", "title": "14-day streak", "metric_key": "day_streak", "goal": 14},
    {"key": "summaries_3", "title": "3 summaries created", "metric_key": "summaries", "goal": 3},
    {"key": "summaries_10", "title": "10 summaries created", "metric_key": "summaries", "goal": 10},
    {"key": "quizzes_2", "title": "2 quizzes generated", "metric_key": "quizzes_generated", "goal": 2},
    {"key": "quizzes_10", "title": "10 quizzes generated", "metric_key": "quizzes_generated", "goal": 10},
    {"key": "focus_3", "title": "3 focus cycles", "metric_key": "pomodoro_cycles", "goal": 3},
    {"key": "focus_10", "title": "10 focus cycles", "metric_key": "pomodoro_cycles", "goal": 10},
    {"key": "chats_20", "title": "20 tutor chats", "metric_key": "chats", "goal": 20},
    {"key": "essays_5", "title": "5 essays graded", "metric_key": "essays", "goal": 5},
    {"key": "evaluations_5", "title": "5 evaluations completed", "metric_key": "evaluations", "goal": 5},
]


def resolve_level(xp: int) -> Tuple[int, str, int, float]:
    xp = max(0, int(xp))
    level = LEVEL_TABLE[0]["level"]
    rank = LEVEL_TABLE[0]["rank"]
    next_xp = LEVEL_TABLE[1]["xp"] if len(LEVEL_TABLE) > 1 else LEVEL_TABLE[0]["xp"]

    for idx, row in enumerate(LEVEL_TABLE):
        if xp >= row["xp"]:
            level = row["level"]
            rank = row["rank"]
            if idx + 1 < len(LEVEL_TABLE):
                next_xp = LEVEL_TABLE[idx + 1]["xp"]
            else:
                next_xp = row["xp"]
        else:
            break

    if next_xp == LEVEL_TABLE[0]["xp"]:
        progress = 1.0
    elif next_xp == LEVEL_TABLE[-1]["xp"] and xp >= next_xp:
        progress = 1.0
    else:
        prev_xp = max(r["xp"] for r in LEVEL_TABLE if r["xp"] <= xp)
        span = max(1, next_xp - prev_xp)
        progress = (xp - prev_xp) / span

    return level, rank, next_xp, float(min(1.0, max(0.0, progress)))


def get_metric_value(progress: UserProgress, metric_key: str) -> int:
    return int(getattr(progress, metric_key, 0) or 0)


def apply_streak(progress: UserProgress, today: date) -> None:
    last_date = progress.last_active_date
    if last_date is None:
        progress.day_streak = max(1, progress.day_streak)
        progress.last_active_date = today
        return

    if last_date == today:
        return

    if last_date == today - timedelta(days=1):
        progress.day_streak = max(1, progress.day_streak + 1)
    else:
        progress.day_streak = 1
    progress.last_active_date = today


def event_to_metric_delta(event_type: str, amount: int, correct: int | None) -> Tuple[int, List[Tuple[str, int]]]:
    amount = max(1, int(amount))
    correct_count = max(0, int(correct or 0))
    xp_delta = 0
    deltas: List[Tuple[str, int]] = []

    if event_type == "summary_created":
        deltas.append(("summaries", amount))
        xp_delta = 30 * amount
    elif event_type == "quiz_generated":
        deltas.append(("quizzes_generated", amount))
        xp_delta = 20 * amount
    elif event_type == "quiz_completed":
        deltas.append(("quizzes_taken", amount))
        deltas.append(("quiz_correct", correct_count))
        xp_delta = (10 * amount) + (2 * correct_count)
    elif event_type == "chat_message":
        deltas.append(("chats", amount))
        xp_delta = 3 * amount
    elif event_type == "pomodoro_cycle":
        deltas.append(("pomodoro_cycles", amount))
        xp_delta = 15 * amount
    elif event_type == "essay_graded":
        deltas.append(("essays", amount))
        xp_delta = 25 * amount
    elif event_type == "evaluation_completed":
        deltas.append(("evaluations", amount))
        xp_delta = 25 * amount

    return xp_delta, deltas


def build_achievements(progress: UserProgress) -> List[Dict[str, int | str | bool]]:
    results = []
    for item in ACHIEVEMENTS:
        progress_value = get_metric_value(progress, item["metric_key"])
        goal = item["goal"]
        results.append({
            "key": item["key"],
            "title": item["title"],
            "goal": goal,
            "progress": min(goal, progress_value),
            "completed": progress_value >= goal,
        })
    return results


async def ensure_progress(db: AsyncSession, user_id: int) -> UserProgress:
    result = await db.execute(select(UserProgress).where(UserProgress.user_id == user_id))
    progress = result.scalars().first()
    if progress:
        return progress

    progress = UserProgress(user_id=user_id)
    db.add(progress)
    await db.flush()
    return progress


async def ensure_daily_tasks(db: AsyncSession, user_id: int, today: date) -> List[UserTask]:
    result = await db.execute(
        select(UserTask).where(
            (UserTask.user_id == user_id) & (UserTask.cycle_start == today)
        )
    )
    tasks = list(result.scalars().all())
    existing = {task.task_key for task in tasks}

    for definition in TASK_DEFS:
        if definition["key"] in existing:
            continue
        task = UserTask(
            user_id=user_id,
            task_key=definition["key"],
            title=definition["title"],
            description=definition.get("description"),
            goal=definition["goal"],
            progress=0,
            xp_reward=definition["xp_reward"],
            metric_key=definition["metric_key"],
            cycle="daily",
            cycle_start=today,
        )
        db.add(task)
        tasks.append(task)

    if tasks and any(task.id is None for task in tasks):
        await db.flush()

    return tasks


def update_tasks_for_metrics(tasks: Iterable[UserTask], metric_deltas: Iterable[Tuple[str, int]]) -> int:
    xp_bonus = 0
    delta_map: Dict[str, int] = {}
    for metric_key, delta in metric_deltas:
        if delta <= 0:
            continue
        delta_map[metric_key] = delta_map.get(metric_key, 0) + delta

    for task in tasks:
        if task.completed_at is not None:
            continue
        delta = delta_map.get(task.metric_key, 0)
        if delta <= 0:
            continue
        task.progress = min(task.goal, task.progress + delta)
        if task.progress >= task.goal:
            task.completed_at = datetime.utcnow()
            xp_bonus += task.xp_reward

    return xp_bonus


def build_task_payload(tasks: Iterable[UserTask]) -> List[Dict[str, int | str | bool | None]]:
    payload = []
    for task in tasks:
        payload.append({
            "key": task.task_key,
            "title": task.title,
            "description": task.description,
            "goal": task.goal,
            "progress": min(task.goal, task.progress),
            "xp_reward": task.xp_reward,
            "completed": task.completed_at is not None,
        })
    return payload


async def get_leaderboard(db: AsyncSession, limit: int = 10) -> List[Dict[str, int | str]]:
    stmt = (
        select(User, UserProgress)
        .join(UserProgress, User.id == UserProgress.user_id)
        .order_by(desc(UserProgress.xp))
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    payload = []
    for user, progress in rows:
        payload.append({
            "user_id": user.id,
            "name": user.name,
            "xp": progress.xp,
            "level": progress.level,
            "rank": progress.rank_title,
        })
    return payload
