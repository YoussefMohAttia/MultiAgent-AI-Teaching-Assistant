const ACTIVITY_KEY = 'profile_recent_activity_v1';
const STATS_KEY = 'profile_stats_v1';
const MAX_ITEMS = 10;

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

export function getRecentActivity() {
  const raw = localStorage.getItem(ACTIVITY_KEY);
  return safeParse(raw, []);
}

export function recordActivity(item) {
  if (!item || !item.title) return;
  const list = getRecentActivity();
  const now = Date.now();

  const entry = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    type: item.type || 'general',
    title: item.title,
    route: item.route || '/dashboard',
    detail: item.detail || '',
    timestamp: now,
  };

  const first = list[0];
  if (
    first &&
    first.title === entry.title &&
    first.type === entry.type &&
    first.route === entry.route
  ) {
    list[0] = { ...first, timestamp: now };
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
    return;
  }

  const next = [entry, ...list].slice(0, MAX_ITEMS);
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
}
