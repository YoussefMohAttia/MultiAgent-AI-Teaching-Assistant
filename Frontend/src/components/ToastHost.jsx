import { X } from 'lucide-react';
import { useToasts } from '../contexts/ToastContext';

export default function ToastHost() {
  const { toasts, dismissToast } = useToasts();

  if (!toasts || !toasts.length) return null;

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 w-[20rem]" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`relative overflow-hidden rounded-xl border bg-slate-900/95 shadow-2xl px-4 py-3 text-sm animate-in slide-in-from-right-2 fade-in ${toast.tone === 'success' ? 'border-emerald-500/40' : toast.tone === 'warning' ? 'border-amber-500/40' : 'border-slate-700/70'}`}
        >
          <div className={`absolute inset-y-0 left-0 w-1 ${toast.tone === 'success' ? 'bg-emerald-400' : toast.tone === 'warning' ? 'bg-amber-400' : 'bg-indigo-400'}`} />
          <div className="flex items-start justify-between gap-3">
            <div className="ml-3">
              <div className="text-slate-100 font-semibold">{toast.title}</div>
              <div className="text-slate-400 mt-1">{toast.message}</div>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="text-slate-500 hover:text-slate-200 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
