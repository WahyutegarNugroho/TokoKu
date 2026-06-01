'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { storesApi } from '@/lib/api';
import { Store, Plus, Trash2, Loader2, MapPin, Phone, Crown, AlertTriangle, X } from 'lucide-react';
import { type MembershipRow } from '@/types';

interface UserStore {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  role: 'OWNER' | 'ADMIN' | 'KASIR';
}

export default function StoresPage() {
  const router = useRouter();
  const { user, memberships, activeStore, setActiveStore, initialize } = useAuthStore();
  const [stores, setStores] = useState<UserStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_user_memberships');
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const raw = data?.memberships || [];
      const list: UserStore[] = Array.isArray(raw)
        ? raw.map((m: MembershipRow) => ({
            id: m.store_id,
            name: m.store_name,
            address: m.store_address,
            phone: m.store_phone,
            role: m.role as 'OWNER' | 'ADMIN' | 'KASIR',
          }))
        : [];
      setStores(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar toko.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (memberships.length === 0) { router.replace('/onboarding'); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStores();
  }, [user, memberships, router, loadStores]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;
    setCreating(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('create_store_with_membership', {
        p_store_name: newName.trim(),
        p_store_address: newAddress.trim() || null,
        p_store_phone: newPhone.trim() || null,
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      await initialize();
      setShowCreate(false);
      setNewName('');
      setNewAddress('');
      setNewPhone('');
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat toko.');
      setCreating(false);
    }
  };

  const handleDelete = async (storeId: string) => {
    setDeleting(true);
    setError(null);

    try {
      const { data, error } = await storesApi.delete(storeId);
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (activeStore?.id === storeId) {
        const remaining = stores.filter((s) => s.id !== storeId);
        if (remaining.length > 0) {
          setActiveStore(remaining[0].id);
        }
      }

      await initialize();
      setShowDelete(null);
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus toko.');
      setDeleting(false);
    }
  };

  const handleSelect = (storeId: string) => {
    setActiveStore(storeId);
    router.replace('/cashier');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-sans font-bold text-2xl text-ink">Manajemen Toko</h1>
          <p className="text-slate font-sans text-sm mt-1">Kelola semua toko yang Anda miliki</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-success text-white text-sm font-semibold rounded-lg hover:bg-success/90 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Tambah Toko
        </button>
      </div>

      {error && (
        <div className="bg-danger-soft text-danger p-4 rounded-lg text-sm mb-6 border border-danger/20 font-sans">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold cursor-pointer">&times;</button>
        </div>
      )}

      <div className="space-y-3">
        {stores.map((s) => {
          const isActive = activeStore?.id === s.id;
          const isOwner = s.role === 'OWNER';
          return (
            <div
              key={s.id}
              className={`flex items-center justify-between p-5 rounded-xl border transition-all ${
                isActive
                  ? 'border-primary/40 bg-primary-soft/20'
                  : 'border-hairline bg-surface hover:border-primary/20'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 bg-primary-soft text-primary rounded-xl flex items-center justify-center flex-shrink-0">
                  <Store className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-sans font-bold text-ink truncate">{s.name}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      isOwner ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary'
                    }`}>
                      {isOwner ? <Crown className="w-3 h-3" /> : null}
                      {isOwner ? 'OWNER' : s.role}
                    </span>
                    {isActive && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success-soft text-success">
                        Aktif
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate font-sans">
                    {s.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {s.address}
                      </span>
                    )}
                    {s.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {s.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                {!isActive && (
                  <button
                    onClick={() => handleSelect(s.id)}
                    className="px-4 py-2 text-sm font-semibold text-primary border border-primary rounded-lg hover:bg-primary-soft transition-colors cursor-pointer"
                  >
                    Pilih
                  </button>
                )}
                {isOwner && (
                  <button
                    aria-label="Hapus toko"
                    onClick={() => setShowDelete(s.id)}
                    className="p-2 text-danger hover:bg-danger-soft rounded-lg transition-colors cursor-pointer"
                    title="Hapus Toko"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Store Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay" onClick={() => setShowCreate(false)}>
          <div className="bg-surface rounded-xl shadow-floating border border-hairline w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-sans font-bold text-[20px] text-ink">Tambah Toko Baru</h3>
              <button aria-label="Tutup modal tambah toko" onClick={() => setShowCreate(false)} className="p-1 text-slate hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Nama Toko *</label>
                <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-sans"
                  placeholder="Contoh: Toko Sumber Makmur" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Alamat</label>
                <input type="text" value={newAddress} onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-sans"
                  placeholder="Jl. Merdeka No. 123" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1">Telepon</label>
                <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-surface border border-hairline rounded-lg px-4 h-[48px] text-[15px] focus:outline-none focus:border-primary font-sans"
                  placeholder="021-12345678" />
              </div>
              <button type="submit" disabled={creating}
                className="w-full bg-success text-white font-semibold text-[15px] h-[48px] rounded-lg hover:bg-success/90 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-60">
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buat Toko'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay" onClick={() => setShowDelete(null)}>
          <div className="bg-surface rounded-xl shadow-floating border border-hairline w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-danger-soft text-danger rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="font-sans font-bold text-xl text-ink mb-2">Hapus Toko?</h3>
              <p className="text-slate font-sans text-sm mb-6">
                Tindakan ini tidak dapat dibatalkan. Semua data di toko ini akan dihapus permanen.
              </p>
              <p className="text-ink font-semibold text-sm mb-6">
                &ldquo;{stores.find((s) => s.id === showDelete)?.name}&rdquo;
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowDelete(null)}
                  className="flex-1 px-4 py-2.5 border border-hairline text-charcoal font-semibold text-sm rounded-lg hover:bg-canvas transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleDelete(showDelete)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 bg-danger text-white font-semibold text-sm rounded-lg hover:bg-danger/90 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
