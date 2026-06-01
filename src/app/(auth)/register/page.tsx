'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { ShoppingCart, Mail, Lock, User, Phone, Loader2, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { user, isInitialized, initialize, signUp } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isInitialized) initialize();
  }, [isInitialized, initialize]);

  // Redirect if already logged in
  useEffect(() => {
    if (!isInitialized) return;
    if (user) {
      router.replace('/onboarding');
    }
  }, [user, isInitialized, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    if (!fullName.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }

    setLoading(true);
    const result = await signUp(email, password, fullName.trim(), phone.trim());
    setLoading(false);
    setCooldown(3);
    const timer = setInterval(() => setCooldown((c) => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; }), 1000);
    if (result.error) {
      setError(result.error);
    }
    // Redirect handled by useEffect above after state updates
  };

  return (
    <div className="bg-surface p-8 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.15)] border border-hairline">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
          <ShoppingCart className="w-7 h-7 text-on-primary" />
        </div>
        <h1 className="font-sans font-bold text-2xl text-ink">Buat Akun Baru</h1>
        <p className="text-slate font-sans text-sm mt-1">Daftar gratis untuk mulai menggunakan TokoKu</p>
      </div>

      {error && (
        <div className="bg-danger-soft text-danger p-3 rounded-lg text-sm mb-6 border border-danger/20 font-sans">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-charcoal mb-1">Nama Lengkap</label>
          <div className="relative">
            <User className="absolute left-3 top-3.5 w-4 h-4 text-steel" />
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-surface border border-hairline rounded-lg pl-10 pr-4 h-12 text-[15px] focus:outline-none focus:border-primary font-sans"
              placeholder="Nama lengkap Anda"
            />
          </div>
        </div>

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
          <label className="block text-sm font-semibold text-charcoal mb-1">Nomor HP</label>
          <div className="relative">
            <Phone className="absolute left-3 top-3.5 w-4 h-4 text-steel" />
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-surface border border-hairline rounded-lg pl-10 pr-4 h-12 text-[15px] focus:outline-none focus:border-primary font-sans"
              placeholder="08123456789"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
                placeholder="Min 6 karakter"
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
          <div>
            <label className="block text-sm font-semibold text-charcoal mb-1">Konfirmasi</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 w-4 h-4 text-steel" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-surface border border-hairline rounded-lg pl-10 pr-12 h-12 text-[15px] focus:outline-none focus:border-primary font-sans"
                placeholder="Ulangi password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 p-0.5 text-steel hover:text-charcoal transition-colors cursor-pointer"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || cooldown > 0}
          className="w-full bg-primary text-on-primary font-semibold text-[15px] h-12 rounded-lg hover:bg-primary-pressed transition-colors flex items-center justify-center cursor-pointer disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : cooldown > 0 ? `Tunggu ${cooldown}s` : 'Daftar Sekarang'}
        </button>
      </form>

      <div className="mt-6 text-center border-t border-hairline pt-4">
        <Link href="/login" className="text-primary hover:underline text-sm font-sans font-medium">
          Sudah punya akun? Masuk
        </Link>
      </div>
    </div>
  );
}
