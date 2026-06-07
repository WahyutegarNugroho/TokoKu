'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/dexie';
import { categoriesApi } from '@/lib/api';
import { useToastStore } from '@/store/toastStore';
import ConfirmModal from '@/components/ConfirmModal';
import { SkeletonTable } from '@/components/Skeleton';
import { FolderPlus, Edit2, Trash2 } from 'lucide-react';

interface Category { id: string; name: string; description: string; }

interface CategoryManagerProps {
  storeId?: string;
  onActivityLog?: (action: string, description: string) => void;
}

export default function CategoryManager({ storeId, onActivityLog }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; onConfirm: () => void } | null>(null);

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      // Read from Dexie first (offline-first)
      const local = await db.categories.where('store_id').equals(storeId).toArray();
      if (local.length > 0) {
        setCategories(local.map(c => ({ id: c.id, name: c.name, description: c.description || '' })));
      }
      // Refresh from Supabase if online
      if (navigator.onLine) {
        const { data } = await categoriesApi.list(storeId);
        if (data) {
          // Persist to Dexie for offline use
          await db.transaction('rw', db.categories, async () => {
            for (const cat of data) {
              await db.categories.put({ id: cat.id, store_id: cat.store_id, name: cat.name, description: cat.description || undefined });
            }
          });
          setCategories(data.map(c => ({ id: c.id, name: c.name, description: c.description || '' })));
        }
      }
    } catch (err) { useToastStore.getState().addToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error'); }
    finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => { if (storeId) setTimeout(() => fetchData(), 0); }, [storeId, fetchData]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !storeId) return;

    if (trimmedName.length < 2) {
      useToastStore.getState().addToast('Nama kategori minimal 2 karakter.', 'error');
      return;
    }
    
    try {
      if (editingId) {
        const { error } = await categoriesApi.update(storeId!, editingId, trimmedName, desc);
        if (error) throw error;
        onActivityLog?.('UPDATE_CATEGORY', 'Kategori ' + trimmedName + ' diperbarui');
        useToastStore.getState().addToast('Kategori diperbarui.', 'success');
      } else {
        const { error } = await categoriesApi.create(storeId, trimmedName, desc);
        if (error) throw error;
        onActivityLog?.('CREATE_CATEGORY', 'Kategori ' + trimmedName + ' ditambahkan');
        useToastStore.getState().addToast('Kategori ditambahkan.', 'success');
      }
      setName(''); setDesc(''); setEditingId(null); fetchData();
    } catch (err) { useToastStore.getState().addToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error'); }
  };

  const remove = (id: string) => {
    setConfirm({ title: 'Hapus Kategori', message: 'Yakin ingin menghapus kategori ini? Produk dengan kategori ini akan kehilangan kategorinya.', danger: true, onConfirm: async () => {
      setConfirm(null);
      try {
        const cat = categories.find(c => c.id === id);
        const { error } = await categoriesApi.remove(storeId!, id);
        if (error) throw error;
        onActivityLog?.('DELETE_CATEGORY', 'Kategori ' + (cat?.name || '') + ' dihapus');
        useToastStore.getState().addToast('Kategori dihapus.', 'success'); fetchData();
      }
      catch (err) { useToastStore.getState().addToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error'); }
    }});
  };

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-surface p-6 rounded-xl border border-hairline h-fit">
          <h3 className="font-sans font-bold text-[18px] text-ink mb-4 flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-primary" /> {editingId ? 'Edit Kategori' : 'Tambah Kategori'}
          </h3>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1">Nama</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-sans" placeholder="Nama kategori" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1">Deskripsi</label>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)}
                className="w-full bg-surface border border-hairline rounded-lg p-3 text-[15px] focus:outline-none focus:border-primary font-sans" rows={3} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-primary text-on-primary font-semibold text-[14px] h-[48px] rounded-lg hover:bg-primary-pressed transition-colors cursor-pointer">{editingId ? 'Simpan' : 'Tambah'}</button>
              {editingId && <button type="button" onClick={() => { setEditingId(null); setName(''); setDesc(''); }} className="px-4 border border-hairline text-charcoal font-semibold rounded-lg hover:bg-canvas cursor-pointer">Batal</button>}
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 bg-surface rounded-xl border border-hairline overflow-hidden">
          <div className="p-5 border-b border-hairline bg-surface-muted">
            <h3 className="font-sans font-bold text-[18px] text-ink">Daftar Kategori ({categories.length})</h3>
          </div>
          {loading ? <div className="p-6"><SkeletonTable rows={4} /></div>
          : categories.length === 0 ? <div className="p-12 text-center text-slate font-sans">Belum ada kategori.</div>
          : <table className="w-full"><thead><tr className="border-b border-hairline text-left text-xs uppercase tracking-wider text-slate bg-surface-muted font-sans font-semibold"><th className="p-4">Nama</th><th className="p-4">Deskripsi</th><th className="p-4 text-center">Aksi</th></tr></thead><tbody className="divide-y divide-hairline">{categories.map(cat => (
            <tr key={cat.id} className="hover:bg-surface-muted font-sans">
              <td className="p-4 font-bold text-ink">{cat.name}</td>
              <td className="p-4 text-charcoal">{cat.description || '-'}</td>
              <td className="p-4">
                <div className="flex justify-center gap-2">
                  <button aria-label="Edit kategori" onClick={() => { setEditingId(cat.id); setName(cat.name); setDesc(cat.description || ''); }} className="p-2 text-primary hover:bg-primary-soft rounded-lg cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                  <button aria-label="Hapus kategori" onClick={() => remove(cat.id)} className="p-2 text-danger hover:bg-danger-soft rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
          ))}</tbody></table>}
        </div>
      </div>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        danger={confirm?.danger}
        confirmLabel={confirm?.danger ? 'Ya, Hapus' : 'Ya'}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
