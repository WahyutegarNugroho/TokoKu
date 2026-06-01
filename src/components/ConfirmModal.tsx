'use client';

import { useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ open, title, message, confirmLabel = 'Ya, Hapus', cancelLabel = 'Batal', danger, onConfirm, onCancel }: ConfirmModalProps) {
  const focusRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div ref={focusRef} className="fixed inset-0 z-50 flex items-center justify-center bg-overlay" onClick={onCancel}>
      <div className="bg-surface rounded-xl shadow-floating border border-hairline w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${danger ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button aria-label="Tutup dialog konfirmasi" onClick={onCancel} className="p-1 text-slate hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <h3 className="font-sans font-bold text-[18px] text-ink mb-2">{title}</h3>
        <p className="font-sans text-sm text-slate mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 h-[48px] rounded-lg border border-hairline text-charcoal font-semibold text-[14px] hover:bg-canvas transition-colors cursor-pointer">{cancelLabel}</button>
          <button onClick={onConfirm} className={`flex-1 h-[48px] rounded-lg text-on-primary font-semibold text-[14px] transition-colors cursor-pointer ${danger ? 'bg-danger hover:bg-danger-pressed' : 'bg-primary hover:bg-primary-pressed'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
