# ⚡ DropFest — Micro-Drop & Pre-Order Hub for Indie Brands

<p align="center">
  <strong>Platform rilis produk terbatas (micro-drop) & pre-order profesional untuk brand indie lokal.</strong><br>
  Menggantikan alur manual via Instagram DM/WhatsApp dengan sistem penguncian slot otomatis, verifikasi pembayaran terpusat, dan pelacakan pesanan instan.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3.1-blue?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.5.3-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-5.4.2-purple?logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4.1-38B2AC?logo=tailwind-css" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL_&_Auth-green?logo=supabase" alt="Supabase">
</p>

---

## 🎯 Latar Belakang & Masalah
Brand indie (streetwear, label vinyl, sneakers kustom, artisan coffee, dll.) sering kali menjalankan rilis produk edisi terbatas (*micro-drop*) secara manual melalui WhatsApp atau Instagram DM. Alur manual ini menimbulkan kendala:
- ❌ Kuota slot sering over-selling atau habis tanpa terkontrol.
- ❌ Rentan *slot squatting* (pesanan dibuat berulang tanpa niat membayar).
- ❌ Rekap manual alamat pengiriman dan verifikasi mutasi transfer bank yang melelahkan.
- ❌ Pembeli kesulitan memantau status pembayaran dan pesanannya.

**DropFest** menyatukan seluruh alur ini ke dalam satu platform web yang aman, terstruktur, dan ramah pengguna.

---

## ✨ Fitur Utama

### 🛍️ Untuk Pembeli (Customer Experience - Guest Checkout)
- **⚡ Drop Showcase & Countdown:** Halaman katalog produk dengan status *Live*, *Segera Hadir*, dan *Selesai* beserta timer hitung mundur.
- **🔒 Penguncian Slot Otomatis (Atomic Slot Locking):** Pre-order aman via Postgres RPC `create_order` yang mengunci kuota secara atomik selama 24 jam.
- **🛡️ Proteksi Anti-Squatting:** 1 email hanya diperbolehkan memiliki 1 pesanan aktif per drop.
- **🔍 Track My Order (Tanpa Akun):** Pelanggan dapat mengecek status pesanan dan rincian transaksi kapan saja cukup menggunakan kombinasi **Order ID + Email**.
- **📤 Upload Bukti Transfer:** Unggah foto struk/screenshot transfer bank langsung dari halaman pelacakan pesanan.
- **📝 Join Waitlist:** Daftar antrean otomatis jika kuota drop sudah penuh (*sold out*) atau belum dimulai.

### 👑 Untuk Pemilik Brand (Brand Management)
- **🔐 Autentikasi Brand Owner:** Login & registrasi aman berbasis Supabase Auth dengan isolasi data *Row-Level Security (RLS)*.
- **📊 Dashboard Terpusat:** Pantau statistik rilis, slot tersisa, total omzet, dan daftar pesanan masuk.
- **✅ Panel Verifikasi Pembayaran:** Tinjau bukti transfer yang diunggah pembeli dan lakukan tindakan *Approve (Lunas)* atau *Reject (Tolak dengan alasan)* dalam satu transaksi atomik.
- **🚚 Export Alamat Pengiriman:** Download rekap data penerima dan alamat pengiriman ke format file CSV siap kirim untuk kurir logistik.

### 🤖 Sistem Otomatis
- **⏰ Slot Expiry (pg_cron):** Database secara otomatis memeriksa dan membatalkan pesanan yang belum dibayar dalam 24 jam setiap 15 menit, lalu mengembalikan slot kuota ke publik tanpa campur tangan manual.

---

## 🏗️ Arsitektur & Keamanan (PRD v2.0)

DropFest menerapkan **Hybrid Access Pattern**:
1. **Customer (Tanpa Akun):** Menjaga kecepatan belanja tanpa hambatan login (*frictionless checkout*). Semua operasi penulisan data sensitif (`orders`, `payment_proofs`, `waitlist`) dialihkan melalui **PostgreSQL RPC Functions (`SECURITY DEFINER`)**, bukan query `INSERT`/`UPDATE` langsung dari client.
2. **Brand Owner (Wajib Login):** Diproteksi menggunakan Supabase Auth dan tabel relasi `brand_owners`. Kebijakan RLS memastikan pemilik brand hanya dapat membaca dan mengelola data miliknya sendiri.
3. **Proteksi PII Pelanggan:** Email, nomor WhatsApp, dan alamat pelanggan tidak pernah diekspos melalui `SELECT` publik.

### Skema 7 Tabel Database
```
brand_owners (1) ──< brands (N)
brands (1) ──< products (N)
brands (1) ──< drops (N) >── products (1)
drops (1) ──< orders (N)
orders (1) ──< payment_proofs (1)
drops (1) ──< waitlist (N)
```

---

## 💻 Tech Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Lucide React + React Router v6
- **Backend & Database:** Supabase (PostgreSQL 15+, Supabase Auth, Supabase Storage)
- **Database Logic:** PL/pgSQL RPC Functions + Row-Level Security (RLS)
- **Scheduler:** `pg_cron` extension

---

## 🚀 Memulai Proyek (Local Development)

### 1. Prasyarat
- [Node.js](https://nodejs.org/) versi 18+ atau 20+
- Akun [Supabase](https://supabase.com)

### 2. Kloning Repository
```bash
git clone https://github.com/USERNAME-ANDA/DropFest.git
cd DropFest
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Konfigurasi Environment Variables
Salin template `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Buka file `.env` dan isi dengan kredensial Supabase project Anda:
```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Setup Database Supabase
1. Buka Supabase Dashboard > **SQL Editor**.
2. Buka file [`supabase/schema.sql`](supabase/schema.sql), salin seluruh isinya, tempel ke SQL Editor, lalu klik **Run**.
3. *(Opsional)* Jalankan script [`supabase/storage_setup.sql`](supabase/storage_setup.sql) untuk menyiapkan storage bucket `payment-proofs`.

### 6. Jalankan Server Pengembangan
```bash
npm run dev
```
Buka browser di `http://localhost:5173` atau port yang tertera di terminal.

---

## 📂 Struktur Direktori Proyek

```
DropFest/
├── public/                 # Static assets
├── src/
│   ├── components/         # Komponen UI (Navbar, Footer, dll.)
│   ├── hooks/              # Custom React hooks (useBreakpoint, dll.)
│   ├── lib/                # Supabase client singleton & RPC helper
│   ├── pages/              # Halaman aplikasi
│   │   ├── LandingPage.tsx # Landing page promosi
│   │   ├── HomePage.tsx    # Showcase drop aktif & populer
│   │   ├── DropsPage.tsx   # Katalog semua drop + search & filter
│   │   ├── DropDetailPage.tsx # Detail produk + Modal Pre-Order & Waitlist
│   │   ├── BrandsPage.tsx  # Direktori brand indie
│   │   └── TrackOrderPage.tsx # Pelacakan pesanan + Upload bukti transfer
│   ├── types/              # TypeScript database & RPC types
│   ├── App.tsx             # Routing & layout setup
│   ├── index.css           # Design system tokens & utility classes
│   └── main.tsx            # React root entry point
├── supabase/
│   ├── schema.sql          # Skema database 7 tabel, RLS, RPC, & seed data
│   └── storage_setup.sql   # Konfigurasi Supabase Storage bucket
├── tailwind.config.js      # Konfigurasi Tailwind & palet warna PreProduct
├── .env.example            # Template kredensial environment
└── README.md
```

---

## 📄 Lisensi
Proyek ini dibuat untuk keperluan manajemen rilis pre-order brand independen. Seluruh hak cipta dilindungi.
