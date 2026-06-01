'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Store, Users, BarChart3, WifiOff, ArrowRight, LayoutDashboard, ChevronDown, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function LandingPage() {
  const { user, isInitialized, activeStore, memberships } = useAuthStore();
  const isAuthenticated = isInitialized && !!user;
  const hasStore = memberships.length > 0;
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: 'Apakah TokoKu benar-benar gratis?', a: 'Iya, kamu bisa daftar dan langsung pakai TokoKu tanpa biaya. Nanti kalau usahamu udah besar, ada fitur tambahan yang bisa kamu pilih sesuai kebutuhan.' },
    { q: 'Gimana cara mulainya?', a: 'Tinggal daftar pake email dan password. Setelah itu buat toko — kasih nama, alamat, dan kamu udah siap mulai jualan. Gak sampai 5 menit!' },
    { q: 'Internet mati, gimana dong?', a: 'Tenang aja. TokoKu tetap bisa dipake walau internet mati. Semua transaksi disimpan di HP/laptop kamu dan otomatis nyambung lagi pas internet balik.' },
    { q: 'Bisa dipakai di HP?', a: 'Bisa banget! TokoKu jalan di HP, laptop, PC, atau tablet lewat browser. Tinggal buka aja, gak perlu install apa-apa.' },
    { q: 'Data toko saya aman?', a: 'Aman banget. Setiap toko punya data sendiri-sendiri, gak tercampur dengan toko lain. Disimpan aman di cloud pake teknologi enkripsi.' },
    { q: 'Bisa untuk berapa toko?', a: 'Satu akun bisa buat banyak toko sekaligus. Tinggal undang staf pake kode undangan. Masing-masing toko punya data dan pengaturan sendiri.' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-hairline">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-on-primary" />
            </div>
            <span className="font-sans font-bold text-lg text-ink tracking-tight">TokoKu</span>
          </div>
          <div className="flex items-center gap-3">
            {hasStore ? (
              <Link href={activeStore ? '/cashier' : '/onboarding'} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-pressed transition-colors font-sans shadow-sm">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            ) : isAuthenticated ? (
              <Link href="/onboarding" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-pressed transition-colors font-sans shadow-sm">
                <Store className="w-4 h-4" />
                Buat Toko
              </Link>
            ) : (
              <>
                <Link href="/login" className="px-5 py-2.5 text-sm font-semibold text-charcoal hover:text-primary transition-colors font-sans">
                  Masuk
                </Link>
                <Link href="/register" className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-pressed transition-colors font-sans shadow-sm">
                  Daftar Gratis
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-ai-accent/5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-ai-accent/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 bg-primary-soft text-primary text-xs font-bold px-4 py-1.5 rounded-full mb-6 uppercase tracking-wider font-sans">
            <Sparkles className="w-3.5 h-3.5" />
            Gratis untuk Dicoba
          </div>

          <h1 className="font-sans font-extrabold text-4xl md:text-6xl text-ink leading-tight max-w-4xl mx-auto">
            Aplikasi Kasir Online<br />
            yang <span className="text-primary">Gampang Banget</span> Dipake
          </h1>

          <p className="mt-6 text-lg md:text-xl text-slate max-w-2xl mx-auto font-sans leading-relaxed">
            Catat transaksi, atur stok, pantau omzet dari HP atau laptop
            biar usaha kecilmu makin rapi tanpa ribet.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            {hasStore ? (
              <Link href={activeStore ? '/cashier' : '/onboarding'} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold text-base rounded-xl hover:bg-primary-pressed transition-all shadow-lg shadow-primary/25 font-sans group">
                Buka Dashboard
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : isAuthenticated ? (
              <Link href="/onboarding" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold text-base rounded-xl hover:bg-primary-pressed transition-all shadow-lg shadow-primary/25 font-sans group">
                Buat Toko Sekarang
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <>
                <Link href="/register" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold text-base rounded-xl hover:bg-primary-pressed transition-all shadow-lg shadow-primary/25 font-sans group">
                  Coba Gratis
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/login" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-surface text-charcoal font-bold text-base rounded-xl border border-hairline hover:border-primary/30 hover:bg-primary-soft/30 transition-all font-sans">
                  Sudah Punya Akun? Masuk
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-sans font-extrabold text-3xl md:text-4xl text-ink">Kenapa TokoKu?</h2>
            <p className="text-slate mt-3 text-lg font-sans">Dibuat khusus biar usaha kecil makin gampang diurus</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="group p-8 rounded-xl border border-hairline bg-surface hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
              <div className="w-14 h-14 bg-primary-soft text-primary rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <WifiOff className="w-7 h-7" />
              </div>
              <h3 className="font-sans font-bold text-xl text-ink mb-2">Anti Macet Internet</h3>
              <p className="text-slate font-sans leading-relaxed">
                Internet mati? Kasir tetap jalan. Semua transaksi disimpan otomatis dan tersambung lagi pas online.
              </p>
            </div>

            <div className="group p-8 rounded-xl border border-hairline bg-surface hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
              <div className="w-14 h-14 bg-primary-soft text-primary rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Store className="w-7 h-7" />
              </div>
              <h3 className="font-sans font-bold text-xl text-ink mb-2">Bisa untuk Banyak Toko</h3>
              <p className="text-slate font-sans leading-relaxed">
                Pantau semua cabang dari satu akun. Undang staf dengan kode undangan, atur akses masing-masing.
              </p>
            </div>

            <div className="group p-8 rounded-xl border border-hairline bg-surface hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
              <div className="w-14 h-14 bg-primary-soft text-primary rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-7 h-7" />
              </div>
              <h3 className="font-sans font-bold text-xl text-ink mb-2">Laporan Otomatis</h3>
              <p className="text-slate font-sans leading-relaxed">
                Tahu omzet harian, stok kritis, dan produk terlaris tanpa hitung manual. Semua otomatis.
              </p>
            </div>

            <div className="group p-8 rounded-xl border border-hairline bg-surface hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
              <div className="w-14 h-14 bg-primary-soft text-primary rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7" />
              </div>
              <h3 className="font-sans font-bold text-xl text-ink mb-2">Kelola Staf</h3>
              <p className="text-slate font-sans leading-relaxed">
                Undang kasir dan admin dengan kode undangan. Kontrol akses tiap orang — Owner, Admin, atau Kasir.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-sans font-extrabold text-3xl md:text-4xl text-ink">Pertanyaan Umum</h2>
            <p className="text-slate mt-3 text-lg font-sans">Yang sering ditanyakan soal TokoKu</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-hairline overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left bg-surface hover:bg-primary-soft/30 transition-colors cursor-pointer"
                >
                  <span className="font-sans font-semibold text-base text-ink">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate transition-transform duration-200 flex-shrink-0 ${openFaq === i ? 'rotate-180' : ''
                    }`} />
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${openFaq === i ? 'max-h-48' : 'max-h-0'
                  }`}>
                  <p className="px-6 pb-4 text-slate font-sans leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="py-20 bg-gradient-to-r from-primary to-ai-accent">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-sans font-extrabold text-3xl md:text-4xl text-white">Siap Bikin Usaha Lebih Rapi?</h2>
          <p className="text-white/80 mt-4 text-lg font-sans">
            {hasStore ? 'Lanjutkan kelola toko Anda dari dashboard.' : isAuthenticated ? 'Lengkapi profil toko Anda untuk mulai berjualan.' : 'Gratis. Gampang. Tinggal daftar dan mulai jualan.'}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
            {hasStore ? (
              <Link href={activeStore ? '/cashier' : '/onboarding'} className="inline-flex items-center gap-2 px-10 py-4 bg-surface text-primary font-bold text-base rounded-xl hover:bg-primary-soft transition-all shadow-lg font-sans group">
                Buka Dashboard
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : isAuthenticated ? (
              <Link href="/onboarding" className="inline-flex items-center gap-2 px-10 py-4 bg-surface text-primary font-bold text-base rounded-xl hover:bg-primary-soft transition-all shadow-lg font-sans group">
                Buat Toko Sekarang
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <Link href="/register" className="inline-flex items-center gap-2 px-10 py-4 bg-surface text-primary font-bold text-base rounded-xl hover:bg-primary-soft transition-all shadow-lg font-sans group">
                Daftar Gratis Sekarang
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-stone text-sm font-sans">&copy; 2026 TokoKu. Aplikasi Kasir untuk UMKM Indonesia.</p>
        </div>
      </footer>
    </div>
  );
}
