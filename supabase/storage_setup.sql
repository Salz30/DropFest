-- ============================================================
-- DropFest — Supabase Storage Setup untuk Bukti Pembayaran
-- ============================================================
-- Cara pakai:
-- 1. Buka Supabase Dashboard -> Storage
-- 2. Buat bucket baru bernama "payment-proofs" (Public: Checked / Aktifkan)
-- ATAU jalankan script SQL ini di SQL Editor:
-- ============================================================

-- 1. Buat bucket payment-proofs jika belum ada
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy: Izinkan siapa saja (anon) untuk upload bukti transfer
CREATE POLICY "Public Upload Payment Proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs');

-- 3. Policy: Izinkan publik untuk melihat gambar bukti transfer yang sudah diupload
CREATE POLICY "Public Read Payment Proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-proofs');
