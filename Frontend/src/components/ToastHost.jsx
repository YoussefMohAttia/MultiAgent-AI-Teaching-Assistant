import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CircleCheck, Info, X } from 'lucide-react';
import { useToasts } from '../contexts/ToastContext';

export default function ToastHost() {
  const { toasts, dismissToast } = useToasts();

  if (!toasts || !toasts.length) return null;

  const toneStyles = {
    success: {
      border: 'border-green-200',
      bg: 'bg-green-50',
      text: 'text-green-800',
      iconBg: 'bg-green-100',
      iconText: 'text-green-700',
      bar: 'bg-green-400',
      icon: CircleCheck,
    },
    warning: {
      border: 'border-yellow-200',
      bg: 'bg-yellow-50',
      text: 'text-yellow-800',
      iconBg: 'bg-yellow-100',
      iconText: 'text-yellow-700',
      bar: 'bg-yellow-400',
      icon: AlertTriangle,
    },
    info: {
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      text: 'text-blue-800',
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-700',
      bar: 'bg-blue-400',
      icon: Info,
    },
  };

  return (
    <div className="fixed top-6 right-6 z-50 flex w-[22rem] max-w-[calc(100vw-1.5rem)] flex-col gap-3" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => {
          const style = toneStyles[toast.tone] || toneStyles.info;
          const Icon = style.icon || Info;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 24, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, y: -6, scale: 0.98 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`relative overflow-hidden rounded-2xl border ${style.bg} px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.20)] backdrop-blur-xl ${style.border}`}
            >
              <div className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
              <div className="flex items-start justify-between gap-3 pl-3">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.iconBg}`}>
                  <Icon className={`h-4.5 w-4.5 ${style.iconText}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-base font-semibold ${style.text}`}>
                    {toast.title}
                  </div>
                  {toast.subtitle ? (
                    <div className="mt-0.5 truncate text-sm font-medium text-slate-500">
                      {toast.subtitle}
                    </div>
                  ) : null}
                  <div className="mt-2 text-sm leading-5 text-slate-600">
                    {toast.message}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-700"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
