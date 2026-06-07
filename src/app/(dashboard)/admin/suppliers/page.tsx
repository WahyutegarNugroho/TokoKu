'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/dexie';
import { suppliersApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { Loader2, Truck, Plus, Edit2, Trash2 } from 'lucide-react';

interface Supplier {
  id: string; name: string; phone: string; email: string; address: string;
}

export default function SuppliersPage() {
  const { activeStore } = useAuthStore();
  const storeId = activeStore?.id;
  const addToast = useToastStore((s) => s.addToast);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const local = await db.suppliers.where('store_id').equals(storeId).toArray();
      local.sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(local.map(s => ({ id: s.id, name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '' })));
      if (navigator.onLine) {
        const { data } = await suppliersApi.list(storeId);
        if (data) {
          await db.transaction('rw', db.suppliers, async () => {
            const mapped = data.map(s => ({ id: s.id, store_id: s.store_id, name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '' }));
            await db.suppliers.bulkPut(mapped);
            const newIds = new Set(mapped.map(s => s.id));
            const existing = await db.suppliers.where('store_id').equals(storeId).toArray();
            const toDelete = existing.filter(s => !newIds.has(s.id)).map(s => s.id);
            if (toDelete.length > 0) await db.suppliers.bulkDelete(toDelete);
          });
          const fresh = await db.suppliers.where('store_id').equals(storeId).toArray();
          fresh.sort((a, b) => a.name.localeCompare(b.name));
          setSuppliers(fresh.map(s => ({ id: s.id, name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '' })));
        }
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal memuat supplier.', 'error');
    } finally { setLoading(false); }
  }, [storeId, addToast]);

  useEffect(() => {
    if (storeId) {
      const timer = setTimeout(() => {
        fetchData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [storeId, fetchData]);

  const openCreate = () => {
    setEditId(null); setName(''); setPhone(''); setEmail(''); setAddress(''); setShowForm(true);
  };

  const openEdit = (s: Supplier) => {
    setEditId(s.id); setName(s.name); setPhone(s.phone); setEmail(s.email); setAddress(s.address); setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !name.trim()) return;
    setSubmitting(true);
    try {
      if (editId) {
        const { error } = await suppliersApi.update(storeId, editId, { name, phone, email, address });
        if (error) throw error;
        addToast('Supplier diperbarui.', 'success');
      } else {
        const { error } = await suppliersApi.create(storeId, { name, phone, email, address });
        if (error) throw error;
        addToast('Supplier ditambahkan.', 'success');
      }
      setShowForm(false); fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error');
    } finally { setSubmitting(false); }
  };

  const deleteSupplier = async (id: string) => {
    if (!storeId) return;
    try {
      const { error } = await suppliersApi.remove(storeId, id);
      if (error) throw error;
      addToast('Supplier dihapus.', 'success');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menghapus.', 'error');
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-hairline overflow-hidden">
      <div className="p-5 border-b border-hairline bg-surface-muted flex items-center justify-between">
        <h3 className="font-sans font-bold text-[18px] text-ink">Daftar Supplier</h3>
        <button onClick={openCreate} className="bg-primary text-on-primary font-semibold text-sm h-[40px] px-4 rounded-lg hover:bg-primary-pressed cursor-pointer flex items-center gap-2"><Plus className="w-4 h-4" />Tambah Supplier</button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={submit} className="p-5 border-b border-hairline bg-canvas/50 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" required placeholder="Nama supplier *" value={name} onChange={e => setName(e.target.value)} className="bg-surface border border-hairline rounded-lg px-3 h-[44px] text-sm focus:outline-none focus:border-primary" />
            <input type="text" placeholder="Telepon" value={phone} onChange={e => setPhone(e.target.value)} className="bg-surface border border-hairline rounded-lg px-3 h-[44px] text-sm focus:outline-none focus:border-primary" />
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="bg-surface border border-hairline rounded-lg px-3 h-[44px] text-sm focus:outline-none focus:border-primary" />
            <input type="text" placeholder="Alamat" value={address} onChange={e => setAddress(e.target.value)} className="bg-surface border border-hairline rounded-lg px-3 h-[44px] text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="bg-primary text-on-primary font-semibold text-sm h-[40px] px-4 rounded-lg hover:bg-primary-pressed cursor-pointer disabled:opacity-50 flex items-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}{editId ? 'Simpan' : 'Tambah'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="border border-hairline text-charcoal font-semibold text-sm h-[40px] px-4 rounded-lg hover:bg-canvas cursor-pointer">Batal</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-hairline text-left text-xs uppercase tracking-wider text-slate font-sans font-semibold">
              <th className="p-3">Nama</th><th className="p-3">Telepon</th><th className="p-3">Email</th><th className="p-3">Alamat</th><th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {loading ? (
              <tr><td colSpan={5} className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" /><p className="text-sm text-slate">Memuat supplier...</p></td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={5} className="p-12 text-center"><Truck className="w-12 h-12 mx-auto text-slate mb-3" /><p className="text-sm text-slate">Belum ada supplier.</p></td></tr>
            ) : suppliers.map(s => (
              <tr key={s.id} className="hover:bg-surface-muted">
                <td className="p-3 font-semibold text-ink text-sm">{s.name}</td>
                <td className="p-3 text-charcoal text-sm">{s.phone || '-'}</td>
                <td className="p-3 text-charcoal text-sm">{s.email || '-'}</td>
                <td className="p-3 text-charcoal text-sm truncate max-w-[200px]">{s.address || '-'}</td>
                <td className="p-3 text-center">
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => openEdit(s)} className="text-primary hover:bg-primary-soft p-1.5 rounded cursor-pointer"><Edit2 className="w-4 h-4" /></button>
                    {deleteConfirmId === s.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => deleteSupplier(s.id)} className="bg-danger text-white p-1.5 rounded cursor-pointer text-xs font-semibold">Ya</button>
                        <button onClick={() => setDeleteConfirmId(null)} className="bg-surface border border-hairline text-charcoal p-1.5 rounded cursor-pointer text-xs font-semibold">Batal</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirmId(s.id)} className="text-danger hover:bg-danger-soft p-1.5 rounded cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
