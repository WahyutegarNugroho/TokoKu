'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/dexie';
import { productBatchesApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { Loader2, Plus, Calendar, Trash2, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';

interface BatchItem {
  id: string;
  product_id: string;
  product_name?: string;
  sku?: string;
  batch_no: string;
  expiry_date: string;
  quantity: number;
}

export default function BatchExpiryTab() {
  const { activeStore } = useAuthStore();
  const storeId = activeStore?.id;
  const addToast = useToastStore((s) => s.addToast);

  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [selectedProductId, setSelectedProductId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [qty, setQty] = useState('0');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      // Load products to map names
      const localProds = await db.products.where('store_id').equals(storeId).toArray();
      setProducts(localProds.map(p => ({ id: p.id, name: p.name, sku: p.sku })));

      // Load batches from Dexie first
      const localBatches = await db.productBatches.where('store_id').equals(storeId).toArray();
      const mappedLocal = localBatches.map(b => {
        const p = localProds.find(pr => pr.id === b.product_id);
        return {
          id: b.id,
          product_id: b.product_id,
          product_name: p?.name || '(Produk Dihapus)',
          sku: p?.sku || '-',
          batch_no: b.batch_no,
          expiry_date: b.expiry_date,
          quantity: b.quantity
        };
      });
      setBatches(mappedLocal);

      // Load from Supabase if online
      if (navigator.onLine) {
        const { data } = await productBatchesApi.list(storeId);
        if (data) {
          await db.transaction('rw', db.productBatches, async () => {
            const mapped = data.map(b => ({
              id: b.id,
              store_id: b.store_id,
              product_id: b.product_id,
              batch_no: b.batch_no,
              expiry_date: b.expiry_date,
              quantity: Number(b.quantity),
              created_at: b.created_at
            }));
            await db.productBatches.bulkPut(mapped);
            const newIds = new Set(mapped.map(b => b.id));
            const existing = await db.productBatches.where('store_id').equals(storeId).toArray();
            const toDelete = existing.filter(b => !newIds.has(b.id)).map(b => b.id);
            if (toDelete.length > 0) await db.productBatches.bulkDelete(toDelete);
          });

          const freshBatches = await db.productBatches.where('store_id').equals(storeId).toArray();
          setBatches(freshBatches.map(b => {
            const p = localProds.find(pr => pr.id === b.product_id);
            return {
              id: b.id,
              product_id: b.product_id,
              product_name: p?.name || '(Produk Dihapus)',
              sku: p?.sku || '-',
              batch_no: b.batch_no,
              expiry_date: b.expiry_date,
              quantity: b.quantity
            };
          }));
        }
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal memuat batch.', 'error');
    } finally {
      setLoading(false);
    }
  }, [storeId, addToast]);

  useEffect(() => {
    if (storeId) {
      const timer = setTimeout(() => {
        fetchData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [storeId, fetchData]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !selectedProductId || !batchNo.trim() || !expiryDate) {
      addToast('Harap lengkapi semua bidang.', 'error');
      return;
    }
    const quantity = parseInt(qty) || 0;
    if (quantity < 0) {
      addToast('Jumlah tidak boleh negatif.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await productBatchesApi.create(storeId, {
        product_id: selectedProductId,
        batch_no: batchNo.trim(),
        expiry_date: new Date(expiryDate).toISOString(),
        quantity
      });
      addToast('Batch berhasil ditambahkan.', 'success');
      setSelectedProductId('');
      setBatchNo('');
      setExpiryDate('');
      setQty('0');
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBatch = async (id: string) => {
    if (!storeId) return;
    try {
      await productBatchesApi.delete(storeId, id);
      addToast('Batch berhasil dihapus.', 'success');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menghapus.', 'error');
    }
  };

  const getStatusBadge = (expiryStr: string) => {
    const now = new Date();
    const expiry = new Date(expiryStr);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="w-3.5 h-3.5" /> Kadaluarsa
        </span>
      );
    } else if (diffDays <= 30) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-warning-soft text-warning">
          <AlertTriangle className="w-3.5 h-3.5" /> Segera Kadaluarsa
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-success-soft text-success">
          <CheckCircle className="w-3.5 h-3.5" /> Aman
        </span>
      );
    }
  };

  const filteredBatches = batches.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.product_name?.toLowerCase().includes(q) ||
      b.sku?.toLowerCase().includes(q) ||
      b.batch_no.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
      <div className="p-5 border-b border-hairline bg-surface-muted">
        <h3 className="font-sans font-bold text-[18px] text-ink">Manajemen Batch & Kadaluarsa</h3>
        <p className="text-xs text-slate font-sans mt-1">Kelola nomor batch dan tanggal kadaluarsa untuk produk retail/FMCG.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-5">
        {/* Form Panel */}
        <div className="bg-canvas p-5 rounded-xl border border-hairline-soft h-fit">
          <h4 className="font-sans font-bold text-sm text-ink mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Tambah Batch Baru
          </h4>
          <form onSubmit={handleCreateBatch} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">Pilih Produk</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
                className="w-full bg-surface border border-hairline rounded-lg px-3 h-[40px] text-[13px] focus:outline-none focus:border-primary font-sans"
              >
                <option value="">Pilih...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-charcoal mb-1">Nomor Batch</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BATCH-01"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  className="w-full bg-surface border border-hairline rounded-lg px-3 h-[40px] text-xs focus:outline-none focus:border-primary font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-charcoal mb-1">Jumlah</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full bg-surface border border-hairline rounded-lg px-3 h-[40px] text-xs focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">Tanggal Kadaluarsa</label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-surface border border-hairline rounded-lg px-3 h-[40px] text-xs focus:outline-none focus:border-primary font-sans"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-on-primary font-semibold text-xs h-[40px] rounded-lg hover:bg-primary-pressed transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Plus className="w-3.5 h-3.5" /> Tambah Batch
            </button>
          </form>
        </div>

        {/* List Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate" />
            <input
              type="text"
              placeholder="Cari nama produk, SKU, atau no batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-canvas border border-hairline rounded-lg pl-9 pr-3 h-[40px] text-xs focus:outline-none focus:border-primary"
            />
          </div>

          <div className="overflow-x-auto border border-hairline-soft rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-hairline bg-surface-muted text-slate text-left font-semibold font-sans">
                  <th className="p-3">Produk</th>
                  <th className="p-3">Batch No</th>
                  <th className="p-3">Kadaluarsa</th>
                  <th className="p-3 text-center">Stok</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                      Memuat data batch...
                    </td>
                  </tr>
                ) : filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate">
                      Belum ada data batch produk.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map(b => (
                    <tr key={b.id} className="hover:bg-surface-muted">
                      <td className="p-3">
                        <p className="font-bold text-ink">{b.product_name}</p>
                        <p className="text-[10px] text-slate font-mono">{b.sku}</p>
                      </td>
                      <td className="p-3 font-mono font-semibold text-charcoal">{b.batch_no}</td>
                      <td className="p-3 font-sans text-charcoal">
                        {new Date(b.expiry_date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="p-3 font-mono text-center text-charcoal">{b.quantity}</td>
                      <td className="p-3">{getStatusBadge(b.expiry_date)}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setDeleteConfirmId(b.id)}
                          className="p-1.5 text-danger hover:bg-danger-soft rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!deleteConfirmId}
        title="Hapus Batch?"
        message="Stok batch ini akan dihapus dari sistem."
        confirmLabel="Hapus"
        cancelLabel="Batal"
        danger
        onConfirm={() => deleteConfirmId && handleDeleteBatch(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
