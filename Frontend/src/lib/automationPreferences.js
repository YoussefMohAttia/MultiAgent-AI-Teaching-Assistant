const STORAGE_PREFIX = 'automation_prefs_v1';

function safeParse(value, fallback) {
  try {
    return JSON.parse(value) || fallback;
  } catch {
    return fallback;
  }
}

function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => String(id)).filter((id) => id);
}

function getStorageKey(userId) {
  return `${STORAGE_PREFIX}_${userId || 'guest'}`;
}

export function readAutomationPrefs(userId) {
  const raw = localStorage.getItem(getStorageKey(userId));
  const fallback = { selectedCourseIds: [], updatedAt: null };
  const data = safeParse(raw, fallback);

  return {
    selectedCourseIds: normalizeIds(data.selectedCourseIds),
    updatedAt: data.updatedAt || null,
  };
}

export function saveAutomationPrefs(userId, selectedCourseIds) {
  const payload = {
    selectedCourseIds: normalizeIds(selectedCourseIds),
    updatedAt: Date.now(),
  };

  localStorage.setItem(getStorageKey(userId), JSON.stringify(payload));
  return payload;
}

export function hasAutomationPrefs(userId) {
  return Boolean(localStorage.getItem(getStorageKey(userId)));
}
