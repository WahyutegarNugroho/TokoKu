'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/dexie';
import { Loader2 } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';

interface Props { storeId?: string; }

interface Customer { id: string; name: string; phone: string; email: string; created_at: string; }

export default function CustomerManager({ storeId }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase.from('customers').select('*').eq('store_id', storeId).order('name');
        if (error) throw error;
        if (data) {
          await db.transaction('rw', db.customers, async () => {
            const mapped = data.map(c => ({
              id: c.id,
              store_id: c.store_id,
              name: c.name,
              phone: c.phone || '',
              email: c.email || '',
              created_at: c.created_at
            }));
            await db.customers.bulkPut(mapped);
            // clean up deleted
            const newIds = new Set(mapped.map(c => c.id));
            const existing = await db.customers.where('store_id').equals(storeId).toArray();
            const toDelete = existing.filter(c => !newIds.has(c.id)).map(c => c.id);
            if (toDelete.length > 0) await db.customers.bulkDelete(toDelete);
          });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch customers from server, showing local data:', err);
      useToastStore.getState().addToast('Gagal memuat data pelanggan dari server. Menampilkan data lokal.', 'warning');
    } finally {
      const local = await db.customers.where('store_id').equals(storeId).toArray();
      local.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(local);
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { if (storeId) setTimeout(() => fetchCustomers(), 0); }, [storeId, fetchCustomers]);

  const addCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedName || !storeId) return;
    
    // Validations (F4)
    if (trimmedName.length < 2) {
      setMsg({ text: 'Nama pelanggan minimal 2 karakter.', type: 'error' });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    if (trimmedPhone && !/^\+?[0-9]{8,15}$/.test(trimmedPhone)) {
      setMsg({ text: 'Nomor telepon tidak valid (8-15 digit angka).', type: 'error' });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setMsg({ text: 'Format email tidak valid.', type: 'error' });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    
    if (!navigator.onLine) {
      setMsg({ text: 'Menambah pelanggan memerlukan koneksi internet.', type: 'error' });
      setTimeout(() => setMsg(null), 3000);
      return;
    }

    try {
      const { error } = await supabase.from('customers').insert({
        store_id: storeId,
        name: trimmedName,
        phone: trimmedPhone || null,
        email: trimmedEmail || null
      });
      if (error) throw error;
      setMsg({ text: 'Pelanggan ditambahkan.', type: 'success' });
      setName(''); setPhone(''); setEmail('');
      fetchCustomers();
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : 'Gagal menambahkan pelanggan.', type: 'error' });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const deleteCustomer = async (id: string) => {
    if (!navigator.onLine) {
      setMsg({ text: 'Menghapus pelanggan memerlukan koneksi internet.', type: 'error' });
      setTimeout(() => setMsg(null), 3000);
      return;
    }

    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      setMsg({ text: 'Pelanggan dihapus.', type: 'success' });
      setDeleteConfirmId(null);
      fetchCustomers();
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : 'Gagal menghapus pelanggan.', type: 'error' });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="p-5">
      {msg && <div className={`mb-4 p-3 rounded-lg text-sm border ${msg.type === 'success' ? 'bg-success-soft text-success border-success/20' : 'bg-danger-soft text-danger border-danger/20'}`}>{msg.text}</div>}
      <form onSubmit={addCustomer} className="flex gap-3 mb-6 flex-wrap">
        <input type="text" required placeholder="Nama" value={name} onChange={e => setName(e.target.value)} className="bg-surface border border-hairline rounded-lg px-3 h-[48px] text-sm focus:outline-none focus:border-primary flex-1 min-w-[150px]" />
        <input type="text" placeholder="Telepon" value={phone} onChange={e => setPhone(e.target.value)} className="bg-surface border border-hairline rounded-lg px-3 h-[48px] text-sm focus:outline-none focus:border-primary w-[140px]" />
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="bg-surface border border-hairline rounded-lg px-3 h-[48px] text-sm focus:outline-none focus:border-primary flex-1 min-w-[150px]" />
        <button type="submit" className="bg-primary text-on-primary font-semibold text-sm h-[48px] px-5 rounded-lg hover:bg-primary-pressed cursor-pointer">Tambah</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full"><thead><tr className="border-b border-hairline text-left text-xs uppercase tracking-wider text-slate font-sans font-semibold"><th className="p-3">Nama</th><th className="p-3">Telepon</th><th className="p-3">Email</th><th className="p-3">Tanggal</th><th className="p-3 text-center">Aksi</th></tr></thead>
          <tbody className="divide-y divide-hairline">
            {loading ? (
              <tr><td colSpan={5} className="p-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                <p className="text-sm text-slate font-sans">Memuat data pelanggan...</p>
              </td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-slate text-sm">Belum ada pelanggan.</td></tr>
            ) : customers.map(c => (
              <tr key={c.id} className="hover:bg-surface-muted">
                <td className="p-3 font-semibold text-ink text-sm">{c.name}</td>
                <td className="p-3 text-charcoal text-sm">{c.phone || '-'}</td>
                <td className="p-3 text-charcoal text-sm">{c.email || '-'}</td>
                <td className="p-3 text-slate text-sm">{new Date(c.created_at).toLocaleDateString('id-ID')}</td>
                <td className="p-3 text-center">
                  {deleteConfirmId === c.id ? (
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => deleteCustomer(c.id)} className="bg-danger text-white hover:opacity-90 p-1.5 rounded cursor-pointer text-xs font-semibold">Ya</button>
                      <button onClick={() => setDeleteConfirmId(null)} className="bg-surface border border-hairline text-charcoal hover:bg-canvas p-1.5 rounded cursor-pointer text-xs font-semibold">Batal</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirmId(c.id)} className="text-danger hover:bg-danger-soft p-1.5 rounded cursor-pointer text-xs font-semibold">Hapus</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
