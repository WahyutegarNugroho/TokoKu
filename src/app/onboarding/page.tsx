'use client';

import Link from 'next/link';
import { Store, KeyRound, ArrowRight } from 'lucide-react';

export default function OnboardingPage() {
  return (
    <div className="bg-surface p-8 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.15)] border border-hairline">
      <div className="text-center mb-8">
        <h1 className="font-sans font-bold text-2xl text-ink">Selamat Datang!</h1>
        <p className="text-slate font-sans text-sm mt-1">Pilih langkah untuk memulai menggunakan TokoKu</p>
      </div>

      <div className="space-y-4">
        <Link
          href="/onboarding/create-store"
          className="block p-6 rounded-xl border border-hairline hover:border-primary/40 hover:bg-primary-soft/20 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-success rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Store className="w-6 h-6 text-on-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-sans font-bold text-lg text-ink">Buat Toko Baru</h2>
              <p className="text-slate font-sans text-sm mt-1">
                Daftarkan toko Anda dan mulai kelola produk, stok, dan transaksi
              </p>
              <div className="flex items-center gap-1 text-primary text-sm font-semibold mt-3 font-sans">
                Buat Toko
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>

        <Link
          href="/onboarding/join-store"
          className="block p-6 rounded-xl border border-hairline hover:border-ai-accent/40 hover:bg-ai-accent/5 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-ai-accent rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <KeyRound className="w-6 h-6 text-on-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-sans font-bold text-lg text-ink">Gabung ke Toko</h2>
              <p className="text-slate font-sans text-sm mt-1">
                Sudah memiliki toko? Masukkan kode undangan dari pemilik atau admin toko
              </p>
              <div className="flex items-center gap-1 text-ai-accent text-sm font-semibold mt-3 font-sans">
                Gabung Toko
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
