'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { KeyRound, Loader2, Store } from 'lucide-react';

export default function JoinStorePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('join_store_with_invite', {
        p_code: code.trim().toUpperCase(),
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (typeof window !== 'undefined') {
        localStorage.setItem('activeStoreId', data.store_id);
      }

      await useAuthStore.getState().initialize();

      router.replace('/cashier');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal bergabung ke toko.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface p-8 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.15)] border border-hairline">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-ai-accent rounded-xl flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-7 h-7 text-on-primary" />
        </div>
        <h1 className="font-sans font-bold text-2xl text-ink">Gabung ke Toko</h1>
        <p className="text-slate font-sans text-sm mt-1">Masukkan kode undangan dari pemilik atau admin toko</p>
      </div>

      {error && (
        <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm mb-6 border border-danger/20 font-sans">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-charcoal mb-1">Kode Undangan</label>
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full bg-surface border border-hairline rounded-lg px-4 h-14 text-center text-2xl font-mono font-bold tracking-[0.3em] focus:outline-none focus:border-primary uppercase"
            placeholder="ABCD1234"
            maxLength={8}
          />
        </div>

        <button
          type="submit" disabled={loading || code.trim().length < 4}
          className="w-full bg-ai-accent text-on-primary font-semibold text-[15px] h-12 rounded-lg hover:bg-ai-accent/90 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gabung Sekarang'}
        </button>
      </form>

      <div className="mt-6 text-center border-t border-hairline pt-4">
        <Link href="/onboarding/create-store" className="text-primary hover:underline text-sm font-sans font-medium inline-flex items-center gap-1">
          <Store className="w-3.5 h-3.5" />
          Ingin buat toko sendiri? Buat Toko Baru
        </Link>
      </div>
    </div>
  );
}
