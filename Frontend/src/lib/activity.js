const STATS_KEY = 'profile_stats_v1';

function safeParse(value, fallback) {
  try {
    return JSON.parse(value) || fallback;
  } catch {
    return fallback;
  }
}

export function getStats() {
  const raw = localStorage.getItem(STATS_KEY);
  const base = {
    summaries: 0,
    quizzesGenerated: 0,
    quizzesTaken: 0,
    chats: 0,
    essays: 0,
    evaluations: 0,
  };
  return { ...base, ...safeParse(raw, {}) };
}

export function incrementStat(key, amount = 1) {
  const current = getStats();
  const next = { ...current, [key]: Math.max(0, (current[key] || 0) + amount) };
  localStorage.setItem(STATS_KEY, JSON.stringify(next));
  return next;
}

