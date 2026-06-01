'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { ShoppingCart, Mail, Lock, Loader2, Store, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, memberships, activeStore, signIn, isInitialized, initialize } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isInitialized) initialize();
  }, [isInitialized, initialize]);

  // Redirect if already logged in AND has a store
  useEffect(() => {
    if (!isInitialized) return;
    if (user && memberships.length > 0) {
      if (activeStore) {
        router.replace('/cashier');
      } else if (memberships.length > 1) {
        router.replace('/store-picker');
      } else {
        router.replace('/cashier');
      }
    }
  }, [user, memberships, activeStore, isInitialized, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) return;
    setLoading(true);
    setError(null);

    const result = await signIn(email, password);
    setLoading(false);
    setCooldown(3);
    const timer = setInterval(() => setCooldown((c) => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; }), 1000);
    if (result.error) {
      setError(result.error);
      return;
    }

    // Check if user has store memberships after login
    const { memberships: updatedMemberships } = useAuthStore.getState();
    if (updatedMemberships.length === 0) {
      setError('Akun ini belum terdaftar di toko manapun. Buat toko baru atau gabung ke toko yang sudah ada.');
    }
  };

  return (
    <div className="bg-surface p-8 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.15)] border border-hairline">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
          <ShoppingCart className="w-7 h-7 text-on-primary" />
        </div>
        <h1 className="font-sans font-bold text-2xl text-ink">Masuk ke TokoKu</h1>
        <p className="text-slate font-sans text-sm mt-1">Gunakan akun yang sudah terdaftar</p>
      </div>

      {error && (
        <div className="bg-danger-soft text-danger p-4 rounded-lg text-sm mb-6 border border-danger/20 font-sans">
          <p>{error}</p>
          {error.includes('belum terdaftar di toko') && (
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/onboarding/create-store"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-pressed transition-colors"
              >
                <Store className="w-3.5 h-3.5" />
                Buat Toko Baru
              </Link>
              <Link
                href="/onboarding/join-store"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-ai-accent text-white text-xs font-semibold rounded-lg hover:bg-ai-accent/90 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Gabung ke Toko
              </Link>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-charcoal mb-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 w-4 h-4 text-steel" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-hairline rounded-lg pl-10 pr-4 h-12 text-[15px] focus:outline-none focus:border-primary font-sans"
              placeholder="nama@email.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-charcoal mb-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 w-4 h-4 text-steel" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-hairline rounded-lg pl-10 pr-12 h-12 text-[15px] focus:outline-none focus:border-primary font-sans"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 p-0.5 text-steel hover:text-charcoal transition-colors cursor-pointer"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || cooldown > 0}
          className="w-full bg-primary text-on-primary font-semibold text-[15px] h-12 rounded-lg hover:bg-primary-pressed transition-colors flex items-center justify-center cursor-pointer disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : cooldown > 0 ? `Tunggu ${cooldown}s` : 'Masuk'}
        </button>
      </form>

      <div className="mt-6 text-center border-t border-hairline pt-4">
        <Link href="/register" className="text-primary hover:underline text-sm font-sans font-medium">
          Belum punya akun? Daftar Gratis
        </Link>
      </div>
    </div>
  );
}
