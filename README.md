# TokoKu

**Aplikasi POS (Point of Sale) offline-first untuk UMKM Indonesia.** Multi-tenant, bisa dipakai tanpa internet, support thermal receipt printer 80mm, dan full role-based access (OWNER/ADMIN/KASIR).

---

## Problem yang Diselesaikan

- **Koneksi internet tidak stabil** → offline-first dengan IndexedDB (Dexie.js), semua transaksi simpan lokal dulu, sync ke Supabase di background
- **Data tercampur antar-toko** → multi-tenant dengan Row Level Security (RLS) per `store_id`
- **Kasir perlu antarmuka cepat** → React dengan keyboard shortcuts (F1–F10), focus trap, barcode scanner support
- **Pemilik toko sulit pantau** → admin dashboard dengan rekap shift otomatis, stock history, activity log
- **Nota thermal printer tidak standar** → print format 80mm HTML yang kompatibel dengan printer thermal umum

## Fitur Utama

- **POS Cashier** — grid produk, barcode scanner, quick keys, varian selector
- **Cart Management** — hold/recall, void, multi-payment split (CASH/DEBIT/QRIS/EWALLET)
- **Offline-First** — semua transaksi simpan ke IndexedDB, sync engine dengan retry + mutex
- **Multi-Store + Role** — OWNER/ADMIN/KASIR dengan RLS di setiap query
- **Shift Management** — open/close shift dengan rekonsiliasi kas
- **Admin Dashboard** — CRUD produk, kategori, pelanggan, staff; stock history; activity log
- **Kitchen Display System (KDS)** — untuk restoran (NEW → PREPARING → READY → SERVED)
- **Piutang (DEBT)** — transaksi dengan hutang pelanggan
- **Thermal Receipt** — print nota 80mm + laporan shift
- **Cross-Tab Sync** — BroadcastChannel untuk stock & shift antar-tab
- **Cart Persist** — Zustand persist ke sessionStorage (cart bertahan saat refresh)
- **Error Handling** — ErrorBoundary, double-submit guard, loading states, toast notifications

## Kelebihan

| Aspek | Kelebihan |
|-------|-----------|
| Offline-first | Transaksi tetap jalan walau internet mati |
| Multi-tenant | RLS PostgreSQL, aman antar-toko |
| Role-based | OWNER > ADMIN > KASIR, di middleware + RLS |
| Performa | IndexedDB local-first, zero latency untuk writes |
| Thermal printer | Format 80mm HTML standar industri |
| Keyboard shortcuts | F1–F10 untuk efisiensi kasir |

## Kekurangan

| Aspek | Kekurangan / Roadmap |
|-------|----------------------|
| Mobile | Belum ada native app atau PWA manifest |
| Payment gateway | Belum integrasi Midtrans/Xendit dll |
| Stock antar-tab | Eventual consistency (BroadcastChannel, bukan lock) |
| Testing | Belum ada automated test (e2e/integration) |
| Monitoring | Belum ada error tracking (Sentry) atau logging server |

## Tech Stack + Alasan

| Teknologi | Versi | Alasan |
|-----------|-------|--------|
| Next.js (App Router) | 16 | Full-stack React, server components, file-based routing, middleware |
| React | 19 | Concurrent features, server components, latest ecosystem |
| TypeScript | 5 | Type safety, prevent runtime errors, better DX |
| Tailwind CSS | 4 | Utility-first, dark mode built-in, desain konsisten |
| Supabase | latest | Auth, PostgreSQL + RLS, RPC, realtime — backend siap pakai |
| Dexie.js | 4 | IndexedDB wrapper — offline-first writes, transactional |
| Zustand | 5 | State management ringan, tanpa boilerplate, persist middleware |
| lucide-react | latest | Icon set konsisten, tree-shakeable |

## Cara Install / Run

### Prasyarat

- Node.js 20+
- npm 10+
- Supabase account (free tier cukup)

### Setup

```bash
git clone https://github.com/WahyutegarNugroho/TokoKu.git
cd TokoKu
npm install
```

Buat file `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### Database

1. Buka Supabase SQL Editor
2. Copy-paste dan jalankan isi `schema.sql`
3. Semua tabel, RLS policies, triggers, dan RPC functions akan terbuat otomatis

### Development

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

### Build & Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Struktur Direktori

```
src/
├── app/               # App Router pages & layouts
│   ├── (auth)/        # login, register
│   ├── (dashboard)/   # cashier, admin, categories, stores
│   ├── onboarding/    # create-store, join-store
│   └── store-picker/  # select active store
├── components/        # UI components
│   ├── admin/         # Admin dashboard widgets
│   ├── cashier/       # CartPanel, ProductGrid, PaymentModal, dll
│   └── *.tsx          # Shared (AuthGuard, Header, Sidebar, dll)
├── hooks/             # Custom React hooks
├── lib/               # dexie, supabase, syncEngine, api, utils
├── store/             # Zustand stores (auth, cart, shift)
└── proxy.ts           # Next.js middleware (auth + RBAC)
```

## Environment Variables

| Variable | Required | Deskripsi |
|----------|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon/public key Supabase |

## Lisensi

Hak cipta © 2026 Wahyu T. Nugroho.
