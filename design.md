# TokoKu Design System Specification

**Version:** alpha  
**Name:** TokoKu-Design-Analysis

---

## 1. Overview
TokoKu adalah aplikasi kasir untuk UMKM Indonesia dengan estetika hangat dan ramah:
*   **Front-Office (Ruang Kerja Kasir):** Berlatar belakang kontras tinggi yang dioptimalkan untuk respons sentuhan instan.
*   **Back-Office (Dasbor Analitik):** Permukaan padat data yang menampilkan metrik-metrik finansial secara terperinci.

Sistem menggunakan **Inter** untuk prosa UI, **Geist Mono** untuk data teknis (SKU, harga, log transaksi), dan warna **orange** (`#f97316`) sebagai identitas aksi utama. Desain layout menggunakan:
*   **2-Kolom Terpisah** untuk kasir (grid produk & sidebar keranjang belanja).
*   **3-Kolom Terstruktur** untuk analitik admin.

Sistem ini menerapkan arsitektur *offline-first*. Indikator sinkronisasi jaringan diletakkan secara permanen di area navigasi atas untuk memberikan kepastian langsung mengenai status sinkronisasi data lokal (IndexedDB) ke server cloud.

---

## 2. Design Tokens

### 2.1 Colors (Sistem Warna)

| Kategori | Token Name | Value | Deskripsi / Skenario Penggunaan |
| :--- | :--- | :--- | :--- |
| **Brand & Aksi Utama** | `primary` | `#f97316` | TokoKu Core. Warna orange hangat untuk aksi penentu akhir transaksi seperti "Checkout". |
| | `primary-pressed` | `#ea580c` | State aktif saat tombol utama ditekan (umpan balik taktil instan). |
| | `primary-soft` | `#ffedd5` | Latar belakang aksen pelengkap untuk menyoroti area total belanja. |
| **Aksi Sekunder** | `secondary` | `#1f2937` | Warna latar/elemen gelap. |
| | `secondary-pressed` | `#111827` | State aktif elemen sekunder gelap. |
| **Status Keuangan & Jaringan** | `success` | `#10b981` | Transaksi berhasil, laci kas terbuka aman, indikator Online. |
| | `success-soft` | `#d1fae5` | Latar belakang badge Online. |
| | `warning` | `#f59e0b` | Mode Offline (menyimpan di IndexedDB) atau peringatan stok menipis. |
| | `warning-soft` | `#fef3c7` | Latar belakang badge Offline / stok menipis. |
| | `danger` | `#ef4444` | Aksi pembatalan berisiko tinggi seperti Void item atau Refund. |
| | `danger-pressed` | `#dc2626` | State aktif tombol bahaya/batal. |
| | `danger-soft` | `#fee2e2` | Latar belakang tombol Void lembut. |
| **AI Integration** | `ai-accent` | `#f59e0b` | Aksen warna amber untuk asisten AI. |
| | `ai-bg-blur` | `rgba(255, 255, 255, 0.9)` | Latar belakang semi-transparan panel AI chat dengan efek blur. |
| **Permukaan & Batas (Surface)** | `canvas` | `#f3f4f6` | Dasar aplikasi untuk mengurangi kelelahan mata kasir selama shift panjang. |
| | `surface` | `#ffffff` | Latar belakang kartu produk, baris keranjang, dan dialog modal. |
| | `surface-muted` | `#f9fafb` | Permukaan pelengkap dengan kontras rendah. |
| | `hairline` | `#e5e7eb` | Garis pembatas tipis 1px untuk memisahkan struktur antar elemen. |
| | `hairline-soft` | `#f3f4f6` | Garis pembatas yang sangat lembut untuk baris item belanja. |
| **Teks & Ink** | `ink` | `#111827` | Warna teks utama dengan kontras tertinggi. |
| | `charcoal` | `#374151` | Warna teks sekunder/tombol. |
| | `slate` | `#4b5563` | Warna teks pembantu atau label form. |
| | `steel` | `#9ca3af` | Warna ikon atau placeholder. |
| | `stone` | `#d1d5db` | Batas/elemen dengan penekanan rendah. |
| | `muted` | `#9ca3af` | Teks keterangan atau non-aktif. |
| **Kontras Teks (On-Color)** | `on-primary` | `#ffffff` | Teks di atas warna primer. |
| | `on-dark` | `#ffffff` | Teks di atas warna latar belakang gelap. |

### 2.2 Typography (Tipografi)
Sistem menggunakan font **Inter** untuk keterbacaan antarmuka dan **Geist Mono** untuk kejelasan data angka/teknis.

| Token | Font Family | Size | Weight | Line Height | Letter Spacing | Penggunaan |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `display-price` | Inter | 36px | 700 | 1.10 | -1px | Angka total tagihan akhir di keranjang belanja kasir. |
| `heading-1` | Inter | 28px | 600 | 1.20 | - | Judul utama dasbor admin atau modal transaksi sukses. |
| `heading-2` | Inter | 24px | 600 | 1.25 | - | Judul bagian besar (misalnya nama kategori produk aktif). |
| `heading-3` | Inter | 20px | 600 | 1.30 | - | Judul kartu atau penanda ringkasan widget laporan. |
| `heading-4` | Inter | 18px | 600 | 1.35 | - | Judul sub-seksi atau sub-kartu. |
| `body-lg-medium` | Inter | 16px | 500 | 1.40 | - | Nama produk di dalam grid belanja kasir. |
| `body-md` | Inter | 15px | 400 | 1.50 | - | Teks deskripsi reguler dan teks input form. |
| `body-sm` | Inter | 14px | 400 | 1.50 | - | Teks deskripsi kecil. |
| `body-sm-medium` | Inter | 14px | 500 | 1.50 | - | Nama item di dalam baris daftar belanja keranjang. |
| `caption` | Inter | 13px | 400 | 1.40 | - | Label keterangan kecil. |
| `micro-uppercase`| Inter | 11px | 600 | 1.40 | 0.5px | Label status sinkronisasi, otorisasi peran pengguna (KASIR, ADMIN). |
| `button-md` | Inter | 15px | 600 | 1.30 | - | Teks label pada tombol aksi. |
| `code-md` | Geist Mono | 14px | 500 | 1.40 | - | Nilai subtotal harga per item barang. |
| `code-sm` | Geist Mono | 13px | 400 | 1.40 | - | Kode unik SKU produk dan nomor identifikasi invoice. |

### 2.3 Border Radius (Shapes)

*   `rounded-xs` (4px): Sudut elemen mikro.
*   `rounded-sm` (6px): Label badge status atau indikator takaran stok.
*   `rounded-md` (8px): Sudut kolom input pencarian teks dan elemen baris daftar belanja lokal.
*   `rounded-lg` (12px): Standardisasi kartu produk makro, panel laci keranjang belanja, serta tombol eksekusi transaksi utama.
*   `rounded-xl` (16px): Panel obrolan asisten AI (ai-chat-panel).
*   `rounded-full` (9999px): Bulat mutlak untuk FAB pemicu AI dan pil indikator jaringan.

### 2.4 Spacing & Touch Targets

*   **Satuan Dasar:** 4px dinamis.
*   `spacing-xxs`: 4px
*   `spacing-xs`: 8px (jarak antar elemen internal kartu)
*   `spacing-sm`: 12px
*   `spacing-md`: 16px (jarak antar baris keranjang)
*   `spacing-lg`: 20px
*   `spacing-xl`: 24px (gap pembatas utama antar modul layout)
*   `spacing-xxl`: 32px
*   `spacing-xxxl`: 40px
*   **Zona Aman Sentuh (`touch-target`):** Wajib minimal **48px** untuk elemen interaktif kasir.
*   **Tata Letak Pembatas (`layout-gap`):** 24px.

---

## 3. Layout Grid

### 3.1 Antarmuka Kasir (Front-Office)
*   Menggunakan layout grid **2 kolom** besar dengan rasio **8:4** pada layar mendatar.
    *   **Kolom Kiri (8/12):** Area pencarian barang berskala besar & grid katalog produk.
    *   **Kolom Kanan (4/12):** Laci keranjang belanja, rincian hitungan kalkulasi (subtotal, diskon, pajak, total), dan tombol eksekusi transaksi.

### 3.2 Antarmuka Admin (Back-Office)
*   Menggunakan susunan **3 kolom** terstruktur:
    *   **Sidebar Navigasi Kiri:** Lebar tetap **240px** yang kokoh.
    *   **Konten Utama (Fluid):** Sisi kanan yang menampung kartu ringkasan eksekutif dan tabel analisis data.

---

## 4. Elevation & Depth (Sistem Bayangan)
Sistem POS ini mengutamakan tampilan *flat* terstruktur untuk menjaga kecepatan *rendering* pada perangkat berspesifikasi standar. Dimensi kedalaman hanya digunakan untuk memisahkan fokus lapisan fungsional.

| Level | Sentuhan Visual | Skenario Penggunaan |
| :--- | :--- | :--- |
| **Level 0 (Flat)** | Tanpa bayangan, batas 1px `hairline` (`#e5e7eb`) | Kartu katalog produk, kolom input kasir, baris tabel data. |
| **Level 1 (Hover/Focus)** | `rgba(0, 0, 0, 0.05) 0px 2px 4px` | State aktif saat kolom input pencarian sedang dipilih kasir. |
| **Level 2 (Floating)** | `rgba(0, 0, 0, 0.15) 0px 12px 32px` | Komponen mengambang seperti widget obrolan asisten AI. |

---

## 5. UI Components

### 5.1 Tombol-Tombol Operasional
*   **`button-checkout`**
    *   *Deskripsi:* Tombol utama kasir untuk memicu pembayaran.
    *   *Visual:* Background `primary` (`#4f46e5`), teks `on-primary` (`#ffffff`), font `button-md`, border-radius `lg` (12px), tinggi minimal wajib **48px**, padding `0 24px`.
    *   *Pressed State (`button-checkout-pressed`):* Background berubah menjadi `primary-pressed` (`#4338ca`).
*   **`button-void`**
    *   *Deskripsi:* Tombol destruktif bernilai bahaya tinggi untuk menghapus item belanja.
    *   *Visual:* Background `danger-soft` (`#fee2e2`), teks `danger` (`#ef4444`), font `button-md`, border-radius `lg` (12px), tinggi minimal wajib **48px**.
    *   *Pressed State (`button-void-pressed`):* Warna bertukar secara radikal menjadi solid (background `danger` `#ef4444`, teks `on-primary` `#ffffff`) untuk memberikan konfirmasi visual yang kuat.
*   **`button-secondary`**
    *   *Deskripsi:* Tombol pendukung (misal untuk menunda transaksi / Hold Cart).
    *   *Visual:* Background `surface` (`#ffffff`), teks `charcoal` (`#374151`), border `1px solid hairline` (`#e5e7eb`), font `button-md`, border-radius `lg` (12px), tinggi minimal wajib **48px**.

### 5.2 Kartu Produk & Baris Keranjang
*   **`product-card`**
    *   *Visual:* Background `surface` (`#ffffff`), border-radius `lg` (12px), padding `md` (16px), border `1px solid hairline` (`#e5e7eb`).
*   **`cart-row`**
    *   *Visual:* Latar belakang transparan (`transparent`), border-bottom `1px solid hairline-soft` (`#f3f4f6`), padding `sm 0` (12px atas-bawah).

### 5.3 Formulir & Bidang Input
*   **`search-bar`**
    *   *Deskripsi:* Kolom pencarian produk berskala besar di bagian atas panel kasir.
    *   *Visual:* Background `surface` (`#ffffff`), teks `ink` (`#111827`), font `body-md`, border-radius `lg` (12px), border `1px solid hairline` (`#e5e7eb`), tinggi minimal wajib **48px**. Fokus aktif mengubah border menjadi warna solid.

### 5.4 Status & Indikator Jaringan
*   **`badge-online`**
    *   *Visual:* Background `success-soft` (`#d1fae5`), teks `success` (`#10b981`), font `micro-uppercase`, border-radius `full` (9999px), padding `4px 10px`.
*   **`badge-offline`**
    *   *Visual:* Background `warning-soft` (`#fef3c7`), teks `warning` (`#f59e0b`), font `micro-uppercase`, border-radius `full` (9999px), padding `4px 10px`.

### 5.5 Elemen Kecerdasan Buatan (AI Assistant)
*   **`ai-trigger-fab`**
    *   *Deskripsi:* Tombol lingkaran mengambang di pojok kanan bawah antarmuka kasir. Berfungsi sebagai pemicu asisten pemecahan masalah teknis perangkat keras toko.
    *   *Visual:* Background `ai-accent` (`#6366f1`), teks `on-primary` (`#ffffff`), border-radius `full` (9999px), ukuran diameter **56px**.
*   **`ai-chat-panel`**
    *   *Deskripsi:* Panel asisten virtual yang muncul dengan efek transisi transparan dari arah pemicu.
    *   *Visual:* Background `ai-bg-blur` (`rgba(255, 255, 255, 0.9)`), border-radius `xl` (16px), border `1px solid hairline` (`#e5e7eb`), shadow `rgba(0, 0, 0, 0.15) 0px 12px 32px`. Menggunakan efek blur latar belakang agar kasir tetap dapat melihat bayangan transaksi aktif di belakang panel bantuan.

---

## 6. Do's and Don'ts

### Do (Lakukan)
*   **UUID Lokal:** Gunakan tipe data UUID untuk setiap entitas rekam medis data transaksi yang dibuat di lokal untuk menghindari tabrakan data saat sinkronisasi otomatis berjalan.
*   **Zona Sentuh 48px:** Pertahankan tinggi target sentuh fungsionalitas utama di batas minimal **48px** untuk efisiensi kecepatan kerja kasir fisik.
*   **Geist Mono untuk Angka:** Gunakan jenis font **Geist Mono** untuk semua tampilan representasi data keuangan, kuantitas kuantitatif, dan pelacakan nomor identifikasi SKU barang.
*   **Pembersihan Sukses:** Lakukan pembersihan otomatis berkala di sistem lokal IndexedDB untuk data transaksi yang status sinkronisasinya sudah terverifikasi bernilai sukses di server utama.

### Don't (Hindari)
*   **Auto-increment Integer Lokal:** Jangan menggunakan sistem penomoran berurut otomatis (*auto-increment integer*) sebagai identitas data di sisi lokal klien; hal ini akan merusak integritas basis data PostgreSQL pusat saat proses sinkronisasi paralel berjalan dari beberapa cabang.
*   **Animasi Berlebih:** Jangan menambahkan animasi hiasan yang memakan waktu transisi lebih dari **150ms** pada alur transaksi kasir; operasional kasir membutuhkan respon UI yang instan tanpa jeda visual.
*   **Penyalahgunaan Warna Status:** Jangan menggunakan warna identitas utama merah (`#ef4444`) atau hijau (`#10b981`) untuk elemen hiasan generik; kedua warna ini dilindungi khusus untuk fungsi penanda status krusial dan penanganan darurat sistem finansial.
