import { X } from 'lucide-react';
import { useToasts } from '../contexts/ToastContext';

export default function ToastHost() {
  const { toasts, dismissToast } = useToasts();

  if (!toasts || !toasts.length) return null;

  const toneStyles = {
    success: {
      border: 'border-emerald-500/40',
      bar: 'bg-emerald-400',
      badge: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25',
    },
    warning: {
      border: 'border-amber-500/40',
      bar: 'bg-amber-400',
      badge: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25',
    },
    info: {
      border: 'border-slate-700/70',
      bar: 'bg-indigo-400',
      badge: 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/25',
    },
  };

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 w-[22rem] max-w-[calc(100vw-1.5rem)]" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`relative overflow-hidden rounded-2xl border bg-slate-950/95 shadow-[0_20px_60px_rgba(0,0,0,0.35)] px-4 py-3 text-sm backdrop-blur-xl animate-in slide-in-from-right-2 fade-in ${toneStyles[toast.tone]?.border || toneStyles.info.border}`}
        >
          <div className={`absolute inset-y-0 left-0 w-1 ${toneStyles[toast.tone]?.bar || toneStyles.info.bar}`} />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 pl-3">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 truncate text-base font-semibold text-slate-50">
                  {toast.title}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${toneStyles[toast.tone]?.badge || toneStyles.info.badge}`}>
                  {toast.tone === 'success' ? 'Ready' : toast.tone === 'warning' ? 'Getting ready' : 'Info'}
                </span>
              </div>
              {toast.subtitle ? (
                <div className="mt-1 truncate text-sm font-medium text-slate-300">
                  {toast.subtitle}
                </div>
              ) : null}
              <div className="mt-2 text-sm leading-5 text-slate-400">
                {toast.message}
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="mt-0.5 rounded-full p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
