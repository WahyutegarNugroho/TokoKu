'use client';

import React from 'react';
import { useToastStore } from '@/store/toastStore';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: 'bg-success-soft text-success border-success/20 dark:bg-success/10',
  error: 'bg-danger-soft text-danger border-danger/20 dark:bg-danger/10',
  warning: 'bg-warning-soft text-warning border-warning/20 dark:bg-warning/10',
  info: 'bg-primary-soft text-primary border-primary/20 dark:bg-primary/10',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div role="status" aria-live="polite" className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-xs md:max-w-sm w-full pointer-events-none px-4 md:px-0">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl border shadow-floating flex items-start gap-3 transition-all duration-300 transform translate-y-0 opacity-100 font-sans text-sm ${styles[toast.type]}`}
          >
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold">{toast.message}</div>
            <button
              aria-label="Tutup notifikasi"
              onClick={() => removeToast(toast.id)}
              className="text-muted hover:text-ink cursor-pointer p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
