import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { subscribeToasts } from '../utils/toast';

const STYLES = {
  success: { icon: CheckCircle2, cls: 'border-green-200 bg-green-50 text-green-900', ic: 'text-green-600' },
  error: { icon: AlertCircle, cls: 'border-red-200 bg-red-50 text-red-900', ic: 'text-red-600' },
  warning: { icon: AlertTriangle, cls: 'border-amber-200 bg-amber-50 text-amber-900', ic: 'text-amber-600' },
  info: { icon: Info, cls: 'border-blue-200 bg-blue-50 text-blue-900', ic: 'text-blue-600' },
};

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToasts((toast) => {
      setToasts((prev) => [...prev.slice(-3), toast]);
      const ms = toast.type === 'error' ? 7000 : 4000;
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), ms);
    });
  }, []);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div
      className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto sm:w-96 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const { icon: Icon, cls, ic } = STYLES[t.type] || STYLES.info;
        return (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`toast-in pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${cls}`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${ic}`} />
            <p className="text-sm flex-1 whitespace-pre-line break-words">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="p-0.5 rounded hover:bg-black/5"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
