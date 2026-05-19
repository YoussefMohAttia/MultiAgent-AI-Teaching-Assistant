import { useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

function getCourseLabel(course, index) {
  return course.title || course.course_title || course.name || `Course ${index + 1}`;
}

export default function CourseAutomationSelector({
  courses,
  selectedCourseIds,
  onChange,
  disabled = false,
}) {
  const { t } = useLanguage();
  const courseIds = useMemo(
    () => (courses || []).map((course) => String(course.id)),
    [courses]
  );
  const selectedSet = useMemo(
    () => new Set((selectedCourseIds || []).map((id) => String(id))),
    [selectedCourseIds]
  );
  const allSelected = courseIds.length > 0 && courseIds.every((id) => selectedSet.has(id));

  const handleToggleAll = (checked) => {
    onChange(checked ? courseIds : []);
  };

  const handleToggleCourse = (courseId, checked) => {
    const next = new Set(selectedSet);
    if (checked) {
      next.add(courseId);
    } else {
      next.delete(courseId);
    }
    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 px-4 py-3 text-sm text-slate-900 dark:text-slate-200">
        <span className="font-medium">{t('automationAllCourses')}</span>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => handleToggleAll(e.target.checked)}
          disabled={disabled || courseIds.length === 0}
          className="h-4 w-4 accent-sky-600 dark:accent-indigo-500"
        />
      </label>

      {courses.length === 0 ? (
        <p className="text-xs text-slate-600 dark:text-slate-500">{t('automationEmpty')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {courses.map((course, index) => {
            const courseId = String(course.id);
            return (
              <label
                key={courseId}
                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 px-4 py-3 text-sm text-slate-900 dark:text-slate-200"
              >
                <span className="truncate">{getCourseLabel(course, index)}</span>
                <input
                  type="checkbox"
                  checked={selectedSet.has(courseId)}
                  onChange={(e) => handleToggleCourse(courseId, e.target.checked)}
                  disabled={disabled}
                  className="h-4 w-4 accent-sky-600 dark:accent-indigo-500"
                />
              </label>
            );
          })}
        </div>
      )}

      {courses.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('automationSelectionHint')}
        </p>
      )}
    </div>
  );
}
