'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/dexie';
import { promotionsApi } from '@/lib/api';
import { useToastStore } from '@/store/toastStore';
import ConfirmModal from '@/components/ConfirmModal';
import { SkeletonTable } from '@/components/Skeleton';
import { Tag, Edit2, Trash2, Plus } from 'lucide-react';

interface Promotion {
  id: string;
  name: string;
  description?: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  start_date: string;
  end_date: string;
  enabled: boolean;
}

interface PromoManagerProps {
  storeId?: string;
  onActivityLog?: (action: string, description: string) => void;
}

export default function PromoManager({ storeId, onActivityLog }: PromoManagerProps) {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [value, setValue] = useState('0');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [enabled, setEnabled] = useState(true);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      // Read from Dexie first (offline-first)
      const local = await db.promotions.where('store_id').equals(storeId).toArray();
      if (local.length > 0) {
        setPromos(local);
      }
      
      // Refresh from Supabase if online
      if (navigator.onLine) {
        const { data } = await promotionsApi.list(storeId);
        if (data) {
          await db.transaction('rw', db.promotions, async () => {
            for (const p of data) {
              await db.promotions.put({
                id: p.id,
                store_id: p.store_id,
                name: p.name,
                description: p.description || undefined,
                type: p.type,
                value: Number(p.value),
                start_date: p.start_date,
                end_date: p.end_date,
                enabled: p.enabled,
              });
            }
          });
          setPromos(data);
        }
      }
    } catch (err) {
      useToastStore.getState().addToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId) setTimeout(() => fetchData(), 0);
  }, [storeId, fetchData]);

  const resetForm = () => {
    setName('');
    setDesc('');
    setType('PERCENT');
    setValue('0');
    setStartDate('');
    setEndDate('');
    setEnabled(true);
    setEditingId(null);
  };

  const editPromo = (promo: Promotion) => {
    setName(promo.name);
    setDesc(promo.description || '');
    setType(promo.type);
    setValue(promo.value.toString());
    setStartDate(promo.start_date.split('T')[0]);
    setEndDate(promo.end_date.split('T')[0]);
    setEnabled(promo.enabled);
    setEditingId(promo.id);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !storeId || !startDate || !endDate) {
      useToastStore.getState().addToast('Silakan isi semua field wajib', 'error');
      return;
    }

    if (trimmedName.length < 2) {
      useToastStore.getState().addToast('Nama promo minimal 2 karakter.', 'error');
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      useToastStore.getState().addToast('Nilai promo harus angka positif.', 'error');
      return;
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (startDateObj >= endDateObj) {
      useToastStore.getState().addToast('Tanggal mulai harus sebelum tanggal berakhir.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        description: desc.trim() || undefined,
        type,
        value: numValue,
        start_date: startDateObj.toISOString(),
        end_date: endDateObj.toISOString(),
        enabled,
      };

      if (editingId) {
        const { error } = await promotionsApi.update(storeId, editingId, payload);
        if (error) throw error;
        onActivityLog?.('UPDATE_PROMO', `Promo "${trimmedName}" diperbarui`);
        useToastStore.getState().addToast('Promo diperbarui.', 'success');
      } else {
        const { error } = await promotionsApi.create(storeId, payload);
        if (error) throw error;
        onActivityLog?.('CREATE_PROMO', `Promo "${trimmedName}" ditambahkan`);
        useToastStore.getState().addToast('Promo ditambahkan.', 'success');
      }
      
      resetForm();
      fetchData();
    } catch (err) {
      useToastStore.getState().addToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const deletePromo = async (id: string) => {
    if (!storeId) return;
    setSubmitting(true);
    try {
      const { error } = await promotionsApi.delete(storeId, id);
      if (error) throw error;
      onActivityLog?.('DELETE_PROMO', 'Promo dihapus');
      useToastStore.getState().addToast('Promo dihapus.', 'success');
      fetchData();
    } catch (err) {
      useToastStore.getState().addToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
    } finally {
      setSubmitting(false);
      setDeleteConfirmId(null);
    }
  };

  if (loading) return <SkeletonTable rows={5} />;

  const isActive = (promo: Promotion) => {
    const now = new Date();
    return promo.enabled && new Date(promo.start_date) <= now && new Date(promo.end_date) > now;
  };

  return (
    <div className="space-y-5">
      {/* Form */}
      <form onSubmit={save} className="bg-canvas rounded-xl border border-hairline p-5 space-y-4">
        <h3 className="font-sans font-bold text-lg text-ink flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          {editingId ? 'Edit Promo' : 'Tambah Promo'}
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <label className="font-sans font-semibold text-xs text-charcoal block">Nama Promo *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Diskon Gajian"
              className="w-full bg-surface border border-hairline rounded-xl px-3 h-[40px] text-sm font-sans text-charcoal focus:outline-none focus:border-primary"
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="font-sans font-semibold text-xs text-charcoal block">Deskripsi</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="e.g., Diskon spesial gajian bulan ini"
              rows={2}
              className="w-full bg-surface border border-hairline rounded-xl px-3 py-2 text-sm font-sans text-charcoal focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-sans font-semibold text-xs text-charcoal block">Tipe *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'PERCENT' | 'FIXED')}
              className="w-full bg-surface border border-hairline rounded-xl px-3 h-[40px] text-sm font-sans text-charcoal focus:outline-none focus:border-primary"
            >
              <option value="PERCENT">Persentase (%)</option>
              <option value="FIXED">Jumlah Tetap (Rp)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-sans font-semibold text-xs text-charcoal block">Nilai {type === 'PERCENT' ? '(%)' : '(Rp)'} *</label>
            <input
              type="number"
              min="0"
              step={type === 'PERCENT' ? '0.01' : '100'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
              className="w-full bg-surface border border-hairline rounded-xl px-3 h-[40px] text-sm font-mono text-charcoal focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-sans font-semibold text-xs text-charcoal block">Mulai *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-surface border border-hairline rounded-xl px-3 h-[40px] text-sm font-sans text-charcoal focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-sans font-semibold text-xs text-charcoal block">Berakhir *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-surface border border-hairline rounded-xl px-3 h-[40px] text-sm font-sans text-charcoal focus:outline-none focus:border-primary"
            />
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-hairline text-primary focus:ring-primary"
            />
            <label htmlFor="enabled" className="font-sans font-semibold text-sm text-charcoal">Aktifkan promo</label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 h-[40px] rounded-xl border border-hairline text-charcoal font-sans font-semibold text-sm hover:bg-canvas-hover"
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 h-[40px] rounded-xl bg-primary text-on-primary font-sans font-semibold text-sm hover:bg-primary-pressed disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> {editingId ? 'Perbarui' : 'Tambah'}
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline">
              <th className="px-4 py-3 text-left font-sans font-semibold text-slate text-xs uppercase tracking-wider">Nama</th>
              <th className="px-4 py-3 text-left font-sans font-semibold text-slate text-xs uppercase tracking-wider">Tipe</th>
              <th className="px-4 py-3 text-left font-sans font-semibold text-slate text-xs uppercase tracking-wider">Nilai</th>
              <th className="px-4 py-3 text-left font-sans font-semibold text-slate text-xs uppercase tracking-wider">Periode</th>
              <th className="px-4 py-3 text-left font-sans font-semibold text-slate text-xs uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-center font-sans font-semibold text-slate text-xs uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {promos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate text-sm">
                  Belum ada promo
                </td>
              </tr>
            ) : (
              promos.map((promo) => (
                <tr key={promo.id} className="border-b border-hairline-soft hover:bg-canvas-hover transition-colors">
                  <td className="px-4 py-3 font-sans font-semibold text-charcoal">{promo.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate">{promo.type}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-charcoal">
                    {promo.type === 'PERCENT' ? `${promo.value}%` : `Rp ${promo.value.toLocaleString('id-ID')}`}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate">
                    {new Date(promo.start_date).toLocaleDateString('id-ID')} - {new Date(promo.end_date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${isActive(promo) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                      {isActive(promo) ? '🟢 Aktif' : promo.enabled ? '⏱️ Dijadwalkan' : '⊘ Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2 justify-center">
                    <button
                      onClick={() => editPromo(promo)}
                      className="p-2 text-slate hover:text-primary hover:bg-primary-soft rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(promo.id)}
                      className="p-2 text-slate hover:text-danger hover:bg-danger-soft rounded-lg transition-colors"
                      title="Hapus"
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

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteConfirmId}
        title="Hapus Promo?"
        message="Promo akan dihapus dari sistem."
        confirmLabel="Hapus"
        cancelLabel="Batal"
        danger
        onConfirm={() => deleteConfirmId && deletePromo(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
