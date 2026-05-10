import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((toast) => {
    const id = ++idRef.current;
    const payload = {
      id,
      title: toast.title || '',
      message: toast.message || '',
      tone: toast.tone || 'info',
    };
    setToasts((prev) => [...prev, payload]);

    const timeoutMs = Number.isFinite(toast.timeoutMs) ? toast.timeoutMs : 6000;
    if (timeoutMs > 0) {
      setTimeout(() => dismissToast(id), timeoutMs);
    }

    return id;
  }, [dismissToast]);

  const value = useMemo(
    () => ({
      toasts,
      pushToast,
      dismissToast,
    }),
    [toasts, pushToast, dismissToast]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToasts() {
  return useContext(ToastContext);
}
