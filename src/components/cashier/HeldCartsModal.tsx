'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/dexie';
import { type CartItem } from '@/types';
import { ShoppingCart, Trash2, RotateCcw } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useToastStore } from '@/store/toastStore';

interface HeldCartsModalProps {
  show: boolean;
  storeId: string;
  onClose: () => void;
  onRecall: (id: string) => Promise<void>;
}

interface HeldCartRecord {
  id: string;
  store_id: string;
  items: CartItem[];
  created_at: string;
  customer_id: string | null;
  tax_enabled: boolean;
  tax_rate: number;
  discount: number;
  discount_type?: 'FIXED' | 'PERCENT';
}

export default function HeldCartsModal({ show, storeId, onClose, onRecall }: HeldCartsModalProps) {
  const focusRef = useFocusTrap(show);
  const [heldCarts, setHeldCarts] = useState<HeldCartRecord[]>([]);
  const [recallingId, setRecallingId] = useState<string | null>(null);

  const loadHeldCarts = useCallback(async () => {
    if (!storeId) return;
    try {
      const data = await db.heldCarts.where('store_id').equals(storeId).toArray();
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setHeldCarts(data.map(r => ({ ...r, items: r.items as CartItem[] })));
    } catch (err) {
      console.error(err);
      useToastStore.getState().addToast('Gagal memuat transaksi tertunda.', 'error');
    }
  }, [storeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (show) loadHeldCarts();
  }, [show, storeId, loadHeldCarts]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await db.heldCarts.delete(id);
      loadHeldCarts();
    } catch (err) {
      console.error(err);
      useToastStore.getState().addToast('Gagal menghapus transaksi tertunda.', 'error');
    }
  }, [loadHeldCarts]);

  if (!show) return null;

  return (
    <div ref={focusRef} className="fixed inset-0 bg-secondary/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl border border-hairline max-w-md w-full overflow-hidden shadow-floating" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-hairline flex justify-between items-center">
          <h3 className="font-sans font-bold text-[16px] text-ink flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" /> Transaksi Tertunda
          </h3>
          <button onClick={onClose} className="text-muted hover:text-ink text-sm font-semibold cursor-pointer">Tutup</button>
        </div>

        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {heldCarts.length === 0 ? (
            <p className="text-sm text-slate text-center py-8 font-sans">Tidak ada transaksi yang ditunda.</p>
          ) : (
            heldCarts.map((c) => {
              const totalAmount = c.items.reduce((sum: number, item: CartItem) => sum + item.product.price * item.quantity, 0);
              return (
                <div key={c.id} className="border border-hairline p-4 rounded-lg flex justify-between items-center hover:bg-surface-muted transition-all">
                  <div className="font-sans">
                    <p className="text-xs text-muted font-mono">{new Date(c.created_at).toLocaleTimeString('id-ID')} - {new Date(c.created_at).toLocaleDateString('id-ID')}</p>
                    <p className="text-sm font-bold text-ink mt-0.5">{c.items.length} Item • Rp {totalAmount.toLocaleString('id-ID')}</p>
                    <p className="text-xs text-slate truncate max-w-[200px]">{c.items.map((i: CartItem) => i.product.name).join(', ')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      aria-label="Pulihkan transaksi"
                      disabled={recallingId === c.id}
                      onClick={async () => {
                        if (recallingId) return;
                        setRecallingId(c.id);
                        try {
                          await onRecall(c.id);
                          onClose();
                        } catch {
                          setRecallingId(null);
                        }
                      }}
                      className="p-2 text-primary hover:bg-primary-soft rounded-lg transition-colors cursor-pointer border border-hairline border-primary/20 disabled:opacity-50"
                      title="Pulihkan"
                    >
                      {recallingId === c.id ? (
                        <span className="block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      aria-label="Hapus transaksi tertunda"
                      onClick={() => handleDelete(c.id)}
                      className="p-2 text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer border border-hairline border-danger/20"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
