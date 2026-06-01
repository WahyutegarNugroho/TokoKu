'use client';

import React, { useState } from 'react';
import { formatShortId } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface TxItem {
  product_name: string;
  quantity: number;
  subtotal: number;
}

interface Transaction {
  id: string;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  items: TxItem[];
}

interface TransactionHistoryModalProps {
  show: boolean;
  transactions: Transaction[];
  txTotalCount: number;
  onClose: () => void;
  onLoadMore: () => void;
  onRefund: (tx: Transaction) => void;
}

export default function TransactionHistoryModal({ show, transactions, txTotalCount, onClose, onLoadMore, onRefund }: TransactionHistoryModalProps) {
  const focusRef = useFocusTrap(show);
  const [loadingMore, setLoadingMore] = useState(false);
  if (!show) return null;

  const loadedCount = transactions.length;
  const hasMore = loadedCount < txTotalCount;

  return (
    <div ref={focusRef} className="fixed inset-0 z-50 bg-overlay flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-hairline max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 space-y-4 shadow-fixed" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-sans font-bold text-lg text-ink">Riwayat Transaksi</h3>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-canvas cursor-pointer text-charcoal text-xl">&times;</button>
        </div>
        <p className="text-xs text-slate font-sans">Menampilkan {loadedCount} dari {txTotalCount} transaksi</p>
        {transactions.length === 0 ? (
          <p className="text-sm text-charcoal text-center py-8">Belum ada transaksi.</p>
        ) : (
          <>
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx.id} className="p-3 rounded-lg border border-hairline bg-canvas flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-charcoal">#{formatShortId(tx.id)}</span>
                      <span className={'text-[11px] font-semibold px-1.5 py-0.5 rounded-full ' + (tx.status === 'COMPLETED' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>{tx.status}</span>
                    </div>
                    <p className="text-sm text-ink font-semibold">Rp{tx.total_amount.toLocaleString('id-ID')}</p>
                    <p className="text-xs text-charcoal">{new Date(tx.created_at).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onRefund(tx)} disabled={tx.status !== 'COMPLETED'} className="text-[13px] font-semibold text-danger hover:underline disabled:opacity-30 disabled:no-underline whitespace-nowrap cursor-pointer">
                      Refund
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <button
                disabled={loadingMore}
                onClick={async () => { if (loadingMore) return; setLoadingMore(true); try { await onLoadMore(); } finally { setLoadingMore(false); } }}
                className="w-full h-[48px] rounded-lg border border-hairline text-charcoal font-semibold text-sm hover:bg-canvas cursor-pointer disabled:opacity-50"
              >
                {loadingMore ? 'Memuat...' : `Muat ${Math.min(20, txTotalCount - loadedCount)} Lagi...`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
