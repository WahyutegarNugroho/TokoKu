'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { Store, MapPin, Phone, Loader2, KeyRound } from 'lucide-react';

export default function CreateStorePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('create_store_with_membership', {
        p_store_name: name.trim(),
        p_store_address: address.trim() || null,
        p_store_phone: phone.trim() || null,
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const createdStoreId = data.store_id;

      // Langsung set state — bypass initialize() yang kena RLS
      const storeInfo = {
        id: createdStoreId,
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        logo_url: null,
        tax_enabled: true,
        tax_rate: 11,
      };

      useAuthStore.setState({
        activeStore: storeInfo,
        activeRole: 'OWNER',
        memberships: [{ store: storeInfo, role: 'OWNER' as const }],
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem('activeStoreId', createdStoreId);
      }

      router.replace('/cashier');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat toko.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface p-8 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.15)] border border-hairline">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-success rounded-xl flex items-center justify-center mx-auto mb-4">
          <Store className="w-7 h-7 text-on-primary" />
        </div>
        <h1 className="font-sans font-bold text-2xl text-ink">Buat Toko Baru</h1>
        <p className="text-slate font-sans text-sm mt-1">Lengkapi informasi toko Anda untuk memulai</p>
      </div>

      {error && (
        <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm mb-6 border border-danger/20 font-sans">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-charcoal mb-1">Nama Toko *</label>
          <div className="relative">
            <Store className="absolute left-3 top-3.5 w-4 h-4 text-steel" />
            <input
              type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface border border-hairline rounded-lg pl-10 pr-4 h-12 text-[15px] focus:outline-none focus:border-primary font-sans"
              placeholder="Contoh: Toko Sumber Makmur"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-charcoal mb-1">Alamat</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-steel" />
            <input
              type="text" value={address} onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-surface border border-hairline rounded-lg pl-10 pr-4 h-12 text-[15px] focus:outline-none focus:border-primary font-sans"
              placeholder="Jl. Merdeka No. 123, Jakarta"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-charcoal mb-1">Telepon Toko</label>
          <div className="relative">
            <Phone className="absolute left-3 top-3.5 w-4 h-4 text-steel" />
            <input
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-surface border border-hairline rounded-lg pl-10 pr-4 h-12 text-[15px] focus:outline-none focus:border-primary font-sans"
              placeholder="021-12345678"
            />
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full bg-success text-on-primary font-semibold text-[15px] h-12 rounded-lg hover:bg-success/90 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buat Toko & Mulai'}
        </button>
      </form>

      <div className="mt-6 text-center border-t border-hairline pt-4">
        <Link href="/onboarding/join-store" className="text-primary hover:underline text-sm font-sans font-medium inline-flex items-center gap-1">
          <KeyRound className="w-3.5 h-3.5" />
          Punya kode undangan? Gabung toko yang sudah ada
        </Link>
      </div>
    </div>
  );
}
