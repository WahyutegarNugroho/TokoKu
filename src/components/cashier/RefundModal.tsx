'use client';

import React from 'react';
import { formatShortId } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface RefundItem {
  product_name: string;
  quantity: number;
  subtotal: number;
}

interface RefundModalProps {
  show: boolean;
  transaction: {
    id: string;
    total_amount: number;
    items: RefundItem[];
  } | null;
  refundReason: string;
  refunding: boolean;
  refundQtys: number[];
  onClose: () => void;
  onReasonChange: (reason: string) => void;
  onQtyChange: (index: number, value: number) => void;
  onRefund: () => void;
}

export default function RefundModal({ show, transaction, refundReason, refunding, refundQtys, onClose, onReasonChange, onQtyChange, onRefund }: RefundModalProps) {
  const focusRef = useFocusTrap(show && !!transaction);
  if (!show || !transaction) return null;

  const totalRefund = transaction.items.reduce((sum, item, i) => {
    const qty = refundQtys[i] ?? item.quantity;
    const unitPrice = item.quantity > 0 ? item.subtotal / item.quantity : 0;
    return sum + unitPrice * qty;
  }, 0);
  const hasItems = refundQtys.some(q => q > 0);

  return (
    <div ref={focusRef} className="fixed inset-0 z-50 bg-overlay flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-hairline max-w-md w-full p-6 space-y-4 shadow-floating" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-sans font-bold text-lg text-ink">Konfirmasi Refund</h3>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-canvas cursor-pointer text-charcoal text-xl">&times;</button>
        </div>
        <p className="text-sm text-ink">
          Refund transaksi <span className="font-mono font-semibold">#{formatShortId(transaction.id)}</span>
        </p>
        {transaction.items.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {transaction.items.map((item, i) => {
              const refundQty = refundQtys[i] ?? item.quantity;
              const unitPrice = item.quantity > 0 ? item.subtotal / item.quantity : 0;
              return (
                <div key={i} className="flex items-center gap-2 text-xs text-charcoal border border-hairline rounded-lg p-2">
                  <span className="flex-1 min-w-0 truncate">{item.product_name}</span>
                  <span className="text-muted">x{item.quantity}</span>
                  <input
                    type="number"
                    min={0}
                    max={item.quantity}
                    value={refundQty}
                    onChange={e => onQtyChange(i, Math.max(0, Math.min(item.quantity, parseInt(e.target.value) || 0)))}
                    className="w-16 h-8 text-center border border-hairline rounded bg-canvas font-mono text-xs focus:outline-none focus:border-primary"
                  />
                  <span className="w-20 text-right font-mono">Rp{(unitPrice * refundQty).toLocaleString('id-ID')}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-between text-sm font-semibold">
          <span>Total Refund</span>
          <span className="font-mono text-danger">Rp{totalRefund.toLocaleString('id-ID')}</span>
        </div>
        <input type="text" value={refundReason} onChange={e => onReasonChange(e.target.value)} placeholder="Alasan refund (wajib)" className="w-full h-[48px] px-4 bg-canvas border border-hairline rounded-lg text-sm text-ink placeholder:text-charcoal focus:outline-none focus:border-primary" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-[48px] rounded-lg border border-hairline text-charcoal font-semibold text-sm hover:bg-canvas cursor-pointer">Batal</button>
          <button onClick={onRefund} disabled={refunding || !refundReason.trim() || !hasItems} className="flex-1 h-[48px] rounded-lg bg-danger text-on-primary font-semibold text-sm hover:opacity-90 disabled:opacity-40 cursor-pointer">
            {refunding ? 'Memproses...' : 'Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}
