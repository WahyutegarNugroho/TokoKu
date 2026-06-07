'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/dexie';
import { returnsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { Loader2, RotateCcw, Plus, Trash2, ChevronDown } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';

interface ReturnRecord {
  id: string;
  store_id: string;
  transaction_id: string | null;
  user_id: string;
  items: { product_id: string; quantity: number; refund_amount: number }[];
  reason: string;
  refund_amount: number;
  sync_status: boolean;
  created_at: string;
}

export default function ReturnsPage() {
  const { activeStore } = useAuthStore();
  const storeId = activeStore?.id;
  const addToast = useToastStore((s) => s.addToast);

  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [items, setItems] = useState<{ product_id: string; quantity: number; refund_amount: number }[]>([
    { product_id: '', quantity: 1, refund_amount: 0 }
  ]);
  const [reason, setReason] = useState('Supplier Return');

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const local = await db.returns.where('store_id').equals(storeId).toArray();
      local.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setReturns(local);

      if (navigator.onLine) {
        const { data } = await returnsApi.list(storeId);
        if (data) {
          await db.transaction('rw', db.returns, async () => {
            await db.returns.bulkPut(data);
            const newIds = new Set(data.map(r => r.id));
            const existing = await db.returns.where('store_id').equals(storeId).toArray();
            const toDelete = existing.filter(r => !newIds.has(r.id)).map(r => r.id);
            if (toDelete.length > 0) await db.returns.bulkDelete(toDelete);
          });
          const fresh = await db.returns.where('store_id').equals(storeId).toArray();
          fresh.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setReturns(fresh);
        }
      }
    } catch (error) {
      console.error('Failed to fetch returns:', error);
      addToast('Failed to load returns', 'error');
    } finally {
      setLoading(false);
    }
  }, [storeId, addToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const handleAddItem = () => {
    setItems([...items, { product_id: '', quantity: 1, refund_amount: 0 }]);
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: string, value: unknown) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  const handleSubmit = async () => {
    if (!storeId || items.some(i => !i.product_id)) {
      addToast('Silakan isi semua produk', 'error');
      return;
    }

    setSubmitting(true);
    try {
      // Save to local IndexedDB first
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const refundAmount = items.reduce((sum, i) => sum + i.refund_amount, 0);

      await db.returns.add({
        id,
        store_id: storeId,
        transaction_id: null, // Non-transaction return
        user_id: useAuthStore.getState().profile?.id || '',
        items,
        reason,
        refund_amount: refundAmount,
        sync_status: false,
        created_at: now,
      });

      addToast('Return berhasil dicatat', 'success');
      setShowForm(false);
      setItems([{ product_id: '', quantity: 1, refund_amount: 0 }]);
      setReason('Supplier Return');
      fetchData();
    } catch (error) {
      console.error('Failed to create return:', error);
      addToast('Gagal mencatat return', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (returnId: string) => {
    if (!storeId) return;
    setSubmitting(true);
    try {
      await db.returns.delete(returnId);
      await returnsApi.delete(storeId, returnId);
      addToast('Return dihapus', 'success');
      fetchData();
    } catch (error) {
      console.error('Failed to delete return:', error);
      addToast('Gagal menghapus return', 'error');
    } finally {
      setSubmitting(false);
      setDeleteConfirmId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalRefund = returns.reduce((sum, r) => sum + r.refund_amount, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-6 h-6 text-primary" />
          <h1 className="font-sans font-bold text-2xl text-ink">Kelola Return</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="h-[44px] px-4 bg-primary text-on-primary font-sans font-semibold text-sm rounded-xl hover:bg-primary-pressed transition-colors flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Buat Return
        </button>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md border border-hairline overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-hairline bg-surface-muted">
              <h3 className="font-sans font-bold text-lg text-ink">Buat Return Baru</h3>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="font-sans font-semibold text-xs text-charcoal block">
                  Alasan Return
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Supplier Return, Barang Rusak"
                  className="w-full bg-canvas border border-hairline rounded-xl px-3 h-[40px] text-sm text-charcoal focus:outline-none focus:border-primary"
                />
              </div>

              {/* Items */}
              <div className="space-y-2">
                <label className="font-sans font-semibold text-xs text-charcoal block">
                  Produk
                </label>
                {items.map((item, idx) => (
                  <div key={idx} className="space-y-1 p-3 bg-canvas rounded-lg border border-hairline-soft">
                    <input
                      type="text"
                      value={item.product_id}
                      onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                      placeholder="ID Produk atau SKU"
                      className="w-full bg-surface border border-hairline rounded-lg px-2 py-1 text-xs text-charcoal focus:outline-none focus:border-primary"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                        placeholder="Qty"
                        className="bg-surface border border-hairline rounded-lg px-2 py-1 text-xs text-charcoal focus:outline-none focus:border-primary"
                      />
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={item.refund_amount}
                        onChange={(e) => handleItemChange(idx, 'refund_amount', parseFloat(e.target.value) || 0)}
                        placeholder="Jumlah"
                        className="bg-surface border border-hairline rounded-lg px-2 py-1 text-xs text-charcoal focus:outline-none focus:border-primary"
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="text-xs text-red-600 hover:text-red-700 font-semibold"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={handleAddItem}
                  className="text-xs text-primary font-semibold hover:text-primary-pressed"
                >
                  + Tambah Produk
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-hairline bg-surface-muted flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 h-[40px] rounded-xl border border-hairline text-charcoal font-sans font-semibold text-sm hover:bg-canvas"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 h-[40px] rounded-xl bg-primary text-on-primary font-sans font-semibold text-sm hover:bg-primary-pressed disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-canvas rounded-xl border border-hairline p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs font-sans font-semibold text-slate uppercase tracking-wider">Total Return</span>
            <span className="text-lg font-mono font-bold text-ink block mt-1">{returns.length}</span>
          </div>
          <div>
            <span className="text-xs font-sans font-semibold text-slate uppercase tracking-wider">Total Refund</span>
            <span className="text-lg font-mono font-bold text-ink block mt-1">Rp {totalRefund.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      {/* Returns List */}
      {returns.length === 0 ? (
        <div className="bg-canvas rounded-xl border border-hairline-soft p-8 text-center">
          <RotateCcw className="w-12 h-12 text-slate/40 mx-auto mb-3" />
          <p className="text-sm text-slate font-sans">Belum ada return</p>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map((ret) => (
            <div key={ret.id} className="bg-canvas rounded-xl border border-hairline overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === ret.id ? null : ret.id)}
                className="w-full p-4 flex items-center justify-between hover:bg-canvas-hover transition-colors"
              >
                <div className="text-left flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-slate">{ret.id.slice(0, 8)}</span>
                    {ret.transaction_id ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">Refund</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">Supplier</span>
                    )}
                  </div>
                  <p className="text-sm font-sans font-semibold text-ink">{ret.reason}</p>
                  <p className="text-xs text-slate mt-1">{new Date(ret.created_at).toLocaleString('id-ID')}</p>
                </div>
                <div className="text-right mr-3">
                  <p className="font-mono font-bold text-ink">Rp {ret.refund_amount.toLocaleString('id-ID')}</p>
                  <p className={`text-xs font-semibold ${ret.sync_status ? 'text-green-600' : 'text-amber-600'}`}>
                    {ret.sync_status ? '✓ Synced' : '⧖ Pending'}
                  </p>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-slate transition-transform ${expandedId === ret.id ? 'rotate-180' : ''}`}
                />
              </button>

              {expandedId === ret.id && (
                <div className="border-t border-hairline p-4 bg-surface-muted space-y-3">
                  {ret.transaction_id && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                      <p className="text-xs font-semibold text-blue-900">Linked Transaction:</p>
                      <p className="font-mono text-xs text-blue-700">{ret.transaction_id}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-slate uppercase tracking-wider mb-2">Items</p>
                    {ret.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs mb-1">
                        <span className="text-ink font-mono">{item.product_id}</span>
                        <span className="text-slate">× {item.quantity}</span>
                        <span className="font-mono font-semibold text-ink">Rp {item.refund_amount.toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setDeleteConfirmId(ret.id)}
                    className="w-full mt-3 h-[36px] rounded-lg bg-red-100 text-red-700 font-sans font-semibold text-sm hover:bg-red-200 transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> Hapus
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteConfirmId}
        title="Hapus Return?"
        message="Return akan dihapus dari sistem."
        confirmLabel="Hapus"
        cancelLabel="Batal"
        danger
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
