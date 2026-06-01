<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — AI Agent Knowledge Base
> **TokoKu — Aplikasi Kasir UMKM** | Versi: 2.0 | Bahasa: Bilingual (ID/EN)
> Dokumen ini adalah sumber kebenaran tunggal (*single source of truth*) bagi semua AI Agent yang beroperasi di dalam proyek ini.

---

## PROJECT OVERVIEW

Multi-tenant POS with offline-first architecture for Indonesian UMKM. Next.js 16 + React 19 + Tailwind CSS 4 + TypeScript 5.

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (private — see warning above), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 via `@tailwindcss/postcss` |
| Backend | Supabase (auth, PostgreSQL with RLS + RPC) |
| Local DB | Dexie 4 (IndexedDB) — all writes go here first |
| State | Zustand 5 (auth, cart, shift stores) |
| Fonts | Inter (UI), Geist Mono (financial) via `next/font/google` |
| Icons | lucide-react |
| Linting | ESLint 9 flat config (`eslint.config.mjs`) |
| Analytics | @vercel/analytics, @vercel/speed-insights |

### Commands
| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Dev server (localhost:3000) |
| `npm run build` | Build production |
| `npm run start` | Start production server |
| `npm run lint` | ESLint (flat config) |

No test framework is configured.

### Project Structure
```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/               # login, register
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/          # cashier, admin, categories, stores
│   │   ├── admin/page.tsx
│   │   ├── cashier/page.tsx
│   │   ├── categories/page.tsx
│   │   ├── layout.tsx       # Sidebar + Header layout
│   │   └── stores/page.tsx
│   ├── onboarding/           # create-store, join-store
│   │   ├── create-store/page.tsx
│   │   ├── join-store/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── store-picker/page.tsx # Select active store
│   ├── layout.tsx            # Root layout (fonts, metadata, dark mode)
│   ├── page.tsx              # Landing page
│   ├── error.tsx             # Client error boundary
│   ├── global-error.tsx      # Global error boundary
│   └── globals.css           # Tailwind directives + global styles
├── components/
│   ├── admin/                # AnalyticsTab, StaffTab
│   ├── cashier/              # CartPanel, ProductGrid, PaymentModal, ReceiptModal, etc.
│   ├── AuthGuard.tsx         # Role-based route protection
│   ├── AuthNav.tsx           # Auth-aware navigation
│   ├── Header.tsx            # Dashboard header
│   ├── Sidebar.tsx           # Dashboard sidebar navigation
│   ├── CategoryManager.tsx   # CRUD kategori
│   ├── CustomerManager.tsx   # CRUD pelanggan
│   ├── ActivityLogView.tsx   # Log aktivitas
│   ├── StockHistoryView.tsx  # Riwayat stok
│   ├── ConfirmModal.tsx      # Konfirmasi dialog
│   ├── ErrorBoundary.tsx     # Error boundary wrapper
│   ├── RupiahInput.tsx       # Input dengan format Rupiah
│   └── Skeleton.tsx          # Loading skeleton
├── hooks/
│   ├── useDebounce.ts        # Debounce untuk search input
│   ├── useFocusTrap.ts       # Focus trap untuk modal
│   ├── useMasterDataSync.ts  # Sync master data (categories, products, customers) dari Supabase ke Dexie
│   └── useSyncEngine.ts      # React wrapper untuk sync engine
├── lib/
│   ├── api.ts                # Supabase REST wrappers (categories, products, members, stores, invites, transactions)
│   ├── dataService.ts        # Data access layer (profiles, memberships, shifts)
│   ├── dexie.ts              # IndexedDB schema (10 tables, 6 version migrations)
│   ├── printReceipt.ts       # Thermal receipt printer (80mm HTML format)
│   ├── supabase.ts           # Client-side Supabase (createBrowserClient)
│   ├── supabase-server.ts    # Server-side Supabase for middleware
│   ├── syncEngine.ts         # Offline sync: shifts + pending transactions + returns
│   └── utils.ts              # escapeHtml, formatShortId, formatRupiah, getSafeErrorMessage
├── store/
│   ├── authStore.ts          # Auth + store membership state (Zustand)
│   ├── cartStore.ts          # Cart, checkout (local first), refund (Zustand)
│   └── shiftStore.ts         # Shift open/close (local first) (Zustand)
└── proxy.ts                  # Next.js middleware (role-based routes, auth redirect)
public/
├── images/                   # App images (if any)
├── audio/                    # Sound effects (future)
├── docs/                     # Documents (future)
└── videos/                   # Videos (future)
```

### Routing
| Route | Component | Akses |
|-------|-----------|-------|
| `/` | Landing/Home page | Publik |
| `/login` | Login page | Publik (tanpa session) |
| `/register` | Register page | Publik (tanpa session) |
| `/cashier` | POS Checkout (2-column grid) | Semua role |
| `/admin` | Admin Dashboard (3-column) | OWNER, ADMIN |
| `/categories` | Category Management | OWNER, ADMIN |
| `/stores` | Store Management | OWNER |
| `/onboarding` | Onboarding (create/join store) | Perlu auth, tanpa store |
| `/store-picker` | Pilih toko aktif | Perlu auth, multiple stores |

### Project Conventions
- **Components**: `.tsx` extension untuk komponen, `.ts` untuk lib/hooks/utils
- **TypeScript**: Definisikan interface/type secara eksplisit. DILARANG `any` tanpa alasan sah.
- **Error Handling**: Setiap komponen fetch data WAJIB handle: Loading → Error → Empty → Data states
- **Offline-first**: Semua writes ke IndexedDB (Dexie) dulu, sync ke Supabase background
- **UUID**: Semua entity pakai `crypto.randomUUID()` — tidak ada auto-increment integers
- **Sync Status**: Dilacak via `sync_status` boolean di transactions & returns
- **Icons**: Hanya dari `lucide-react`
- **Design System**: `design.md` adalah otoritas (colors, typography, spacing, layout)
- **Touch Targets**: Minimum **48px** untuk cashier UI
- **Fonts**: Geist Mono untuk financial/monospace data, Inter untuk UI prose
- **Middleware**: Role-based access di `src/proxy.ts`, auth guard client-side di `AuthGuard` component

### Roles
OWNER > ADMIN > KASIR (enforced by Supabase RLS + middleware `proxy.ts` + `AuthGuard` component)

### Key Files
| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client (env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `src/lib/dexie.ts` | IndexedDB schema — 10 tables, 6 version migrations |
| `src/lib/syncEngine.ts` | Offline sync: shifts + pending transactions + returns |
| `src/lib/api.ts` | Supabase REST wrappers (categories, products, members, stores, invites, activity, stock history, transactions) |
| `src/lib/dataService.ts` | Data access layer (user profiles, memberships via RPC, shift CRUD) |
| `src/store/authStore.ts` | Auth + store membership state |
| `src/store/cartStore.ts` | Cart, checkout (local first), refund with multi-payment split |
| `src/store/shiftStore.ts` | Shift open/close (local first) |
| `src/proxy.ts` | Next.js middleware — role-based routing + auth redirects |
| `schema.sql` | Full PostgreSQL schema (968 lines) + RLS policies + triggers + RPC |
| `design.md` | Design tokens (colors, typography, spacing, layout grid, UI components) |

### Schema Conventions
- All tables scoped to `store_id` for multi-tenancy
- RLS enforced on all tables via `store_members` membership checks
- Trigger auto-creates `public.users` profile on Supabase auth signup
- Important columns: `sync_status` on transactions, `status` on transactions (COMPLETED/REFUNDED/VOIDED)

### Important Constraints
- `CLAUDE.md` just contains `@AGENTS.md` — always update AGENTS.md instead
- `design.md` is the design system authority — always refer to it for colors/tokens
- Migration scripts in root are gitignored (contain secrets) — do not commit
- Env vars required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `.env.local` exists but should never be committed

---

## 🧭 INDEKS KNOWLEDGE ITEMS

| ID | Kategori | Judul |
|----|----------|-------|
| K-01 | Arsitektur | 3-Tier Agent Architecture |
| K-02 | Fondasi | Clean Code & Industry Standards |
| K-03 | Workflow | Build from Scratch — 4-Phase Protocol |
| K-04 | Workflow | Maintenance & Evolution Protocol |
| K-05 | Keamanan | Security & Anti-Regression Rules |
| K-06 | Keamanan | Lock Critical Core Logic |
| K-07 | Proses | Self-Correction & Troubleshooting Protocol |
| K-08 | Proses | Context-First Reading Mandate |
| K-09 | Output | Code Output Standards |
| K-10 | Output | Response Format Contract |

---

## K-01 · 3-Tier Agent Architecture

Setiap pekerjaan coding dikategorikan ke dalam salah satu dari tiga tier. Agent **wajib** mengidentifikasi tier sebelum mengeksekusi.

```
┌─────────────────────────────────────────────────────┐
│  TIER 1 — THE BLUEPRINT (Arsitektur & Perencanaan)  │
│  Non-deterministik. Output: dokumen, diagram,       │
│  struktur folder. DILARANG menulis logika bisnis.   │
├─────────────────────────────────────────────────────┤
│  TIER 2 — THE BRAIN (Konfigurasi & Integrasi)       │
│  Semi-deterministik. Output: config files,          │
│  schema DB, service layer, wiring antar komponen.   │
├─────────────────────────────────────────────────────┤
│  TIER 3 — THE BODY (Implementasi Logika Bisnis)     │
│  Deterministik penuh. Output: kode produksi yang    │
│  bisa langsung dijalankan. WAJIB bebas dari bug.    │
└─────────────────────────────────────────────────────┘
```

**Aturan Tier Transition:**
- Jangan loncat dari Tier 1 ke Tier 3 tanpa persetujuan user di Tier 2.
- Jika user minta Tier 3, agent harus memastikan Tier 1 & 2 sudah selesai atau diasumsikan secara eksplisit.

---

## K-02 · Clean Code & Industry Standards

### Penamaan (Naming Conventions)
```
Variables & Functions : camelCase      → getUserById, cartItems
Classes & Interfaces  : PascalCase     → PosDatabase, IProductRepo
Constants             : SCREAMING_SNAKE→ MAX_RETRY_COUNT, API_TIMEOUT
Files (komponen)      : PascalCase     → CartPanel.tsx, AuthGuard.tsx
Files (lib/hooks)     : kebab-case     → use-debounce.ts, data-service.ts
Database columns      : snake_case     → created_at, store_id
```

### Prinsip Wajib
1. **Single Responsibility** — Satu fungsi/kelas hanya melakukan satu hal.
2. **DRY (Don't Repeat Yourself)** — Ekstrak logika duplikat ke utility/helper.
3. **YAGNI (You Aren't Gonna Need It)** — Jangan buat abstraksi yang belum dibutuhkan.
4. **Fail Fast** — Validasi input di awal fungsi (guard clauses), bukan di akhir.
5. **No Magic Numbers** — Semua angka/string literal harus menjadi named constant.

### TypeScript Strictness
```typescript
// ✅ WAJIB — Definisikan interface/type secara eksplisit
interface Product {
  id: string;
  store_id: string;
  name: string;
  price: number;
  stock: number;
  category_id: string | null;
}

// ❌ DILARANG — any tanpa alasan yang sah
function process(data: any): any { ... }

// ✅ BOLEH — unknown + type guard jika tipe memang tidak diketahui
function process(data: unknown): Product {
  if (!isProduct(data)) throw new TypeError('Invalid product shape');
  return data;
}
```

---

## K-03 · Build from Scratch — 4-Phase Protocol

### FASE 1 · Blueprint (Tier 1 & 2)

**Trigger:** User meminta membangun aplikasi baru dari nol.

**Checklist wajib sebelum output:**
- [ ] Tentukan tech stack secara eksplisit
- [ ] Buat struktur direktori sesuai konvensi proyek ini
- [ ] Definisikan file konfigurasi awal (ESLint, tsconfig, .env.example)
- [ ] Identifikasi dependensi utama beserta versinya
- [ ] **STOP** — Minta persetujuan user sebelum lanjut ke Fase 2

**Template Struktur Proyek (Sesuai Project Ini):**
```
src/
├── app/                   # Next.js App Router pages + layouts
│   ├── (auth)/            # login, register
│   ├── (dashboard)/       # cashier, admin, categories, stores
│   ├── onboarding/        # create-store, join-store
│   └── store-picker/      # store selection
├── components/            # UI components
│   ├── admin/             # Admin-specific components
│   ├── cashier/           # Cashier-specific components
│   └── *.tsx              # Shared components (AuthGuard, Header, Sidebar, dll)
├── hooks/                 # Custom React hooks
├── lib/                   # Dexie, Supabase, sync engine, utils
├── store/                 # Zustand stores (auth, cart, shift)
└── proxy.ts               # Next.js middleware
```

---

### FASE 2 · Frontend Component Development (Tier 3)

**Trigger:** Blueprint sudah disetujui, mulai implementasi UI.

**Aturan Komponen:**

```typescript
// ✅ POLA YANG BENAR — Presentational Component
// File: components/cashier/ProductGrid.tsx
"use client";

interface ProductGridProps {
  products: LocalProduct[];
  isLoading: boolean;
  onAddToCart: (product: LocalProduct) => void;
}

export function ProductGrid({ products, isLoading, onAddToCart }: ProductGridProps) {
  if (isLoading) return <ProductGridSkeleton />;
  if (products.length === 0) return <EmptyState message="Tidak ada produk" />;

  return (
    <div className="grid grid-cols-3 gap-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onSelect={onAddToCart} />
      ))}
    </div>
  );
}

// ✅ Container Component — tahu tentang hooks & state
// File: app/(dashboard)/cashier/page.tsx
export default function CashierPage() {
  const { products, isLoading, error } = useMasterDataSync();
  const { cart, addToCart } = useCartStore();

  if (error) return <ErrorBanner message="Gagal memuat produk" />;

  return (
    <div className="grid grid-cols-[1fr_400px] gap-4">
      <ProductGrid products={products} isLoading={isLoading} onAddToCart={addToCart} />
      <CartPanel cart={cart} /* ... */ />
    </div>
  );
}
```

**Urutan Pengerjaan:**
1. Buat komponen dengan mock data di page.tsx lokal → Review visual
2. Integrasikan hooks dan store
3. Handle loading, error, empty states

---

### FASE 3 · Backend API Development (Tier 3)

**Trigger:** Frontend sudah disetujui, mulai implementasi API.

**Proyek ini menggunakan Supabase sebagai backend — bukan REST API manual.**

**Urutan Pembuatan:**
```
Schema SQL → RLS Policies → RPC Functions → lib/api.ts wrapper → Zustand store action
```

**Pattern Implementasi:**

```typescript
// 1. SCHEMA — Tambah table/column di schema.sql
// create table public.returns (
//   id uuid default gen_random_uuid() primary key,
//   transaction_id uuid references public.transactions(id),
//   ...
// );

// 2. RPC — Buat stored function di Supabase
// create or replace function increment_product_stock(...)

// 3. API WRAPPER — di src/lib/api.ts
export const returnsApi = {
  create: async (storeId: string, dto: CreateReturnDto) => {
    const { data, error } = await supabase
      .from('returns')
      .insert({ ...dto, store_id: storeId })
      .select()
      .single();
    if (error) throw new ApiError(error.message, error.code);
    return data;
  },
};

// 4. STORE ACTION — di Zustand store
// Di cartStore.ts, panggil returnsApi.create() saat refund
```

**HTTP Response Standard (via Supabase):**
```typescript
type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

// Status codes via PostgREST:
// 200 OK           → GET berhasil
// 201 Created      → POST/INSERT berhasil
// 204 No Content   → DELETE berhasil
// 400 Bad Request  → Validasi gagal
// 401 Unauthorized → Tidak autentikasi
// 403 Forbidden    → RLS menolak
// 404 Not Found    → Resource tidak ditemukan
// 409 Conflict     → Duplikat data (unique constraint)
// 500 Server Error → Unexpected error
```

---

### FASE 4 · Integration (Tier 2 + 3)

**Trigger:** FE dan BE sudah selesai secara terpisah.

**Proyek ini menggunakan arsitektur offline-first — integrasi terjadi via Dexie + sync engine.**

```typescript
// ✅ Local-First Write — semua writes ke IndexedDB dulu
// Di cartStore.ts checkout() action:
const id = crypto.randomUUID();
await db.transaction('rw', db.transactions, db.transactionItems, ...', async () => {
  await db.transactions.add({ id, store_id: storeId, ... });
  for (const item of items) {
    await db.transactionItems.add({ transaction_id: id, ... });
  }
});
return id; // Return local ID langsung, sync terjadi di background

// ✅ Background Sync — via syncEngine.ts
// Dipanggil oleh useSyncEngine hook setelah setiap transaksi
export async function syncPendingTransactions(storeId?: string) {
  const pending = await db.transactions.where({ sync_status: false }).toArray();
  for (const txn of pending) {
    // Push ke Supabase, update sync_status
  }
}
```

**Tiga State Wajib Ditangani:**
```typescript
// Setiap komponen yang fetch data WAJIB handle:
// 1. Loading State
if (isLoading) return <Skeleton />;
// 2. Error State
if (error) return <ErrorBanner error={error} onRetry={refetch} />;
// 3. Empty State
if (!data?.length) return <EmptyState />;
// 4. Data State (sukses)
return <DataGrid data={data} />;
```

**Regression Check Checklist Pasca-Integrasi:**
- [ ] Semua operasi CRUD berhasil di IndexedDB (offline)
- [ ] Sync engine berhasil push ke Supabase saat online
- [ ] Loading state muncul saat network lambat (throttle di DevTools)
- [ ] Error state muncul saat Supabase dimatikan sementara
- [ ] Empty state muncul saat DB kosong
- [ ] Data lama tidak muncul setelah operasi mutasi
- [ ] Console browser bebas dari error/warning

---

## K-04 · Maintenance & Evolution Protocol

### Bug Fixing Protocol

**Urutan Wajib — JANGAN DILEWATI:**
```
1. DIAGNOSA   → Baca log error. Identifikasi file & baris yang bermasalah.
2. ANALISIS   → Jelaskan Root Cause kepada user dalam 2-3 kalimat.
3. KONFIRMASI → Tunggu persetujuan user atas analisis.
4. EKSEKUSI   → Terapkan Surgical Modification (lihat K-05).
5. VALIDASI   → Berikan langkah verifikasi manual kepada user.
```

**Root Cause Analysis Template:**
```
🔴 GEJALA    : [Apa yang user lihat]
🔍 LOKASI    : [File:baris yang relevan]
💡 PENYEBAB  : [Mengapa ini terjadi secara teknis]
🔧 SOLUSI    : [Perubahan minimal yang diperlukan]
⚠️  RISIKO    : [Efek samping potensial jika ada]
```

---

### Feature Addition Protocol

**Urutan Wajib:**
```
1. READ      → Baca seluruh file yang akan dimodifikasi + dependensinya
2. MAP       → Identifikasi titik eksak di mana kode baru akan disisipkan
3. LOCK      → Tandai blok kode yang TIDAK boleh diubah (K-06)
4. INSERT    → Sisipkan kode baru secara presisi
5. VALIDATE  → Berikan Regression Check checklist
```

---

### Refactoring Protocol

**Kontrak Refactoring — Harus dipenuhi semua:**
- ✅ Behavior/output sistem identik 100% sebelum dan sesudah
- ✅ Semua test yang ada masih lulus
- ✅ Tidak ada komentar developer yang dihapus
- ✅ Tidak ada `@ts-expect-error`, `eslint-disable`, atau `TODO` yang dihapus
- ✅ Variabel "redundan" hanya dihapus setelah grep/search global membuktikannya tidak terpakai
- ✅ Tampilkan diff sebelum/sesudah untuk setiap file yang diubah

---

### Code Review & Security Audit Protocol

**Checklist Keamanan:**
```
□ SQL Injection     → Semua query via ORM (Supabase JS client)?
□ XSS               → Semua output user di-escape (escapeHtml di utils.ts)?
□ CSRF              → Supabase auth handles CSRF via cookies?
□ Broken Auth       → Session divalidasi di middleware + AuthGuard?
□ RBAC              → Role dicek di proxy.ts (middleware) + RLS di database?
□ Secrets           → Tidak ada API key/password yang hardcoded?
□ Dependency        → Ada library dengan known CVE? (cek npm audit)
□ Rate Limiting     → Endpoint publik dilindungi? (via Supabase)
□ IDOR              → Semua query discope ke store_id user?
□ Logging           → Tidak ada data sensitif yang masuk ke log (getSafeErrorMessage)?
```

**Output Audit Format:**
```markdown
## Security Audit Report — [nama file] — [tanggal]

### CRITICAL (Harus diperbaiki sebelum deploy)
- [ ] VULN-001: [Deskripsi] @ [file:baris]

### HIGH (Diperbaiki dalam sprint ini)
- [ ] VULN-002: [Deskripsi] @ [file:baris]

### MEDIUM / LOW (Masuk backlog)
- [ ] VULN-003: [Deskripsi] @ [file:baris]

### INFORMATIONAL (Best practice suggestion)
- INFO-001: [Saran] @ [file:baris]
```

---

### Dependency Upgrade Protocol

```
1. AUDIT   → Analisis package.json
2. PLAN    → Buat tabel: Package | Versi Lama | Versi Baru | Breaking Changes
3. STAGE   → STOP. Presentasikan plan ke user.
4. CONFIRM → Tunggu instruksi "Lanjutkan" eksplisit dari user.
5. EXECUTE → Jalankan update per batch (minor dulu, lalu major).
6. TEST    → Jalankan `npm run dev` & `npm run build` untuk verifikasi.
```

**Format Plan Mode:**
```
📦 DEPENDENCY UPGRADE PLAN
═══════════════════════════════════════════════════
Package        │ Sekarang  │ Target    │ Breaking?
───────────────┼───────────┼───────────┼──────────
next           │ 16.2.6    │ 16.3.0    │ Minor — no breaking changes expected
tailwindcss    │ 4.x       │ 4.x       │ Same major
═══════════════════════════════════════════════════
⚠️  Estimasi effort: [N] jam
```

---

## K-05 · Security & Anti-Regression Rules

### Anti-Deletion Protocol (WAJIB)

Agent **DILARANG KERAS** menghapus kode berikut tanpa instruksi eksplisit dari user:

```
🔒 PROTECTED — TIDAK BOLEH DIHAPUS/DIMODIFIKASI TANPA IZIN:
  • Semua middleware autentikasi & autorisasi (proxy.ts, AuthGuard.tsx)
  • Semua validasi input (guard clauses di awal fungsi)
  • Error handling & logging (getSafeErrorMessage, try/catch di store actions)
  • RLS policies di schema.sql
  • Environment variable references (.env)
  • Database transaction blocks (Dexie transactional writes)
  • Komentar yang menjelaskan "mengapa" (bukan "apa")
  • @typescript-eslint/... disable dengan komentar penjelasan
  • Sync engine logic (syncEngine.ts)
  • XSS prevention (escapeHtml di utils.ts)
  • Context menu prevention (jika ada di globals.css)
```

### Phantom Cleanup — DILARANG

Phantom Cleanup = menghapus/mengubah kode yang *terlihat* tidak relevan tapi sebenarnya penting.

```typescript
// ❌ PHANTOM CLEANUP — Jangan hapus ini tanpa investigasi
const _unusedImport = require('./legacy-init'); // <-- Mungkin ada side-effect!
const DEBUG_MODE = false; // <-- Mungkin dipakai di tempat lain via grep

// ✅ Jika ragu, lakukan dulu:
// grep -r "DEBUG_MODE" src/
// Hanya hapus jika hasilnya 0 baris selain definisinya
```

---

## K-06 · Lock Critical Core Logic

Sebelum menyentuh file, agent harus mengidentifikasi dan **mengunci** blok-blok berikut:

```typescript
// ✅ CARA MENANDAI BLOK YANG DIKUNCI DALAM KOMENTAR
// ==================== LOCKED: Sync Engine ====================
// ⚠️  JANGAN MODIFIKASI tanpa review dampak offline-first
export async function triggerSync(storeId?: string) {
  // ... sync logic
}
// ==================== END LOCKED ==============================
```

**Blok yang selalu dikunci secara default:**
- Algoritma kalkulasi harga/PPN/diskon (`cartStore.ts`)
- Logika permission/RBAC (`proxy.ts`, `AuthGuard.tsx`, RLS policies)
- Payment processing & split payment logic
- Sync engine (`syncEngine.ts`)
- Token generation & validation (Supabase auth)
- Database migration scripts & RLS (schema.sql)
- Dexie schema versions (`dexie.ts`)
- XSS prevention (`escapeHtml`)
- Offline-first data flow (Dexie transactional writes)

---

## K-07 · Self-Correction & Troubleshooting Protocol

Ketika agent menghasilkan output yang salah atau menghadapi error, ikuti protokol ini:

```
LANGKAH 1 — STOP. Jangan menghasilkan lebih banyak kode yang salah.
LANGKAH 2 — AKUI kesalahan secara eksplisit kepada user.
LANGKAH 3 — DIAGNOSA: Apa yang salah dan mengapa?
LANGKAH 4 — PLAN: Apa pendekatan perbaikan yang benar?
LANGKAH 5 — KONFIRMASI: Minta izin user jika perbaikan melibatkan banyak file.
LANGKAH 6 — EKSEKUSI: Terapkan perbaikan secara Surgical (K-05).
```

**Error Classification:**
```
TIER-1 ERROR : Salah arsitektur/desain → Diskusikan ulang dengan user
TIER-2 ERROR : Salah konfigurasi/integrasi → Perbaiki config, jangan logika bisnis
TIER-3 ERROR : Bug dalam logika bisnis → Surgical fix pada fungsi spesifik
```

---

## K-08 · Context-First Reading Mandate

**Sebelum** menulis atau memodifikasi kode apapun, agent **WAJIB**:

```
CHECKLIST PRA-CODING:
□ Baca seluruh file yang akan dimodifikasi (bukan hanya seksi yang relevan)
□ Baca file yang diimpor oleh file tersebut (satu level)
□ Cek apakah ada test file yang meng-cover kode yang akan diubah
□ Identifikasi semua caller/consumer dari fungsi yang akan diubah
□ Pahami kontrak (interface/type) yang sudah ada
```

**Jika file terlalu besar (>500 baris):**
```
1. Baca bagian imports & exports dulu (gambaran dependensi)
2. Baca fungsi/kelas yang paling relevan
3. Deklarasikan asumsi yang dibuat kepada user secara eksplisit
```

---

## K-09 · Code Output Standards

### Format Output Kode

Agent **WAJIB** menyertakan informasi ini di setiap blok kode:

````markdown
**File:** `src/store/cartStore.ts`
**Action:** CREATE | MODIFY | DELETE
**Affects:** CartPanel, PaymentModal, checkout flow

```typescript
// kode di sini
```

**Perubahan dari versi sebelumnya:**
- Baris 45: Tambah validasi `product.stock > 0` sebelum addToCart
- Baris 67: Ekstrak kalkulasi diskon ke helper
````

### Surgical Modification Format (Diff Style)

Untuk modifikasi pada file yang sudah ada, gunakan format diff:

```diff
// File: src/store/cartStore.ts

  addToCart: (product: LocalProduct) => {
+   if (product.stock <= 0) return; // Guard: jual produk habis
    set((state) => {
      const existing = state.cart.find((item) => item.product.id === product.id);
      if (existing) {
-       existing.quantity += 1;
+       existing.quantity = Math.min(existing.quantity + 1, product.stock); // Cek stok maksimal
      } else {
        state.cart.push({ product, quantity: 1 });
      }
    });
  },
```

---

## K-10 · Response Format Contract

Agent **WAJIB** mengikuti format respons berikut berdasarkan tipe permintaan:

### Untuk Analisis/Review (Read-Only)
```
1. RINGKASAN    → Apa yang ditemukan (3-5 kalimat)
2. TEMUAN       → List berformat dengan severity
3. REKOMENDASI  → Langkah selanjutnya yang disarankan
4. PERTANYAAN   → Jika ada ambiguitas, tanyakan SATU pertanyaan saja
```

### Untuk Implementasi (Write)
```
1. KONFIRMASI PEMAHAMAN → Ulangi apa yang akan dibuat/diubah
2. ASUMSI               → Daftar asumsi yang dibuat secara eksplisit
3. KODE                 → Output dengan format K-09
4. INSTRUKSI PENGGUNAAN → Cara mengintegrasikan kode ini
5. REGRESSION CHECK     → 3-5 langkah verifikasi manual
```

### Checkpoint Wajib (STOP & ASK)
Agent wajib berhenti dan meminta konfirmasi user ketika:
- Akan menghapus lebih dari 10 baris kode
- Akan mengubah interface/type yang dipakai di banyak tempat
- Akan mengubah schema database (schema.sql)
- Akan memodifikasi file konfigurasi keamanan (proxy.ts)
- Tidak yakin dengan requirement (ambiguitas tinggi)
- Akan membuat perubahan yang memengaruhi lebih dari 3 file
- Akan memodifikasi Dexie schema version (risiko data loss)

---

## 📋 QUICK REFERENCE — Perintah Cepat untuk User

| Perintah | Efek |
|----------|------|
| `@phase1` | Mulai Fase 1: Blueprint |
| `@phase2 [fitur]` | Mulai Fase 2: Buat komponen UI untuk [fitur] |
| `@phase3 [fitur]` | Mulai Fase 3: Buat API Backend/Supabase untuk [fitur] |
| `@phase4 [komponen]` | Mulai Fase 4: Integrasi offline-first |
| `@fix [gejala]` | Bug fix protocol |
| `@add [fitur] to [file]` | Feature addition protocol |
| `@refactor [file] for [tujuan]` | Refactoring protocol |
| `@audit [file/folder]` | Security audit |
| `@upgrade [package]` | Dependency upgrade plan |
| `@lock [blok kode]` | Tandai blok sebagai kritial, jangan diubah |

---

*Dokumen ini adalah living document. Update versi setiap kali ada perubahan signifikan pada standar proyek.*
*Last updated: 2026 | Format: Markdown | Compatible: Antigravity IDE Knowledge Items*
