-- ============================================================
-- DropFest — Security Fixes & Hardening
-- Jalankan di Supabase SQL Editor SETELAH schema.sql
-- ============================================================

-- ============================================================
-- FIX SEC-01: Atomic Brand Registration
-- Hapus policy INSERT langsung pada brands & brand_owners
-- Ganti dengan RPC register_brand yang aman
-- ============================================================

-- 1. Drop insecure policies
DROP POLICY IF EXISTS "brands_insert_authenticated" ON public.brands;
DROP POLICY IF EXISTS "brand_owners_insert_own" ON public.brand_owners;

-- 2. Buat RPC pendaftaran brand yang atomik & aman
CREATE OR REPLACE FUNCTION public.register_brand(
  p_brand_name  text,
  p_slug        text,
  p_description text DEFAULT NULL,
  p_instagram   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_brand_id   uuid;
  v_clean_slug text;
BEGIN
  -- Harus login
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Silakan login terlebih dahulu.');
  END IF;

  -- Cek apakah user sudah memiliki brand
  IF EXISTS (SELECT 1 FROM public.brand_owners WHERE user_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Akun kamu sudah terhubung dengan brand. Satu akun hanya bisa memiliki satu brand.');
  END IF;

  -- Bersihkan slug
  v_clean_slug := lower(trim(regexp_replace(p_slug, '[^a-zA-Z0-9\-]+', '-', 'g')));

  IF length(v_clean_slug) < 3 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Slug brand harus minimal 3 karakter.');
  END IF;

  -- Cek slug sudah terpakai
  IF EXISTS (SELECT 1 FROM public.brands WHERE slug = v_clean_slug) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Slug brand sudah digunakan. Pilih nama/slug lain.');
  END IF;

  -- Validasi nama brand
  IF length(trim(p_brand_name)) < 2 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nama brand harus minimal 2 karakter.');
  END IF;

  -- Insert brand
  INSERT INTO public.brands (name, slug, description, instagram)
  VALUES (trim(p_brand_name), v_clean_slug, nullif(trim(p_description), ''), nullif(trim(p_instagram), ''))
  RETURNING id INTO v_brand_id;

  -- Link owner
  INSERT INTO public.brand_owners (user_id, brand_id, role)
  VALUES (v_user_id, v_brand_id, 'owner');

  RETURN jsonb_build_object(
    'success', true,
    'brand_id', v_brand_id,
    'slug', v_clean_slug,
    'message', 'Brand berhasil didaftarkan!'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'Slug brand sudah digunakan. Pilih nama/slug lain.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gagal mendaftarkan brand. Silakan coba lagi.');
END;
$$;


-- ============================================================
-- FIX SEC-02: Hapus Demo Helper RPCs yang tidak aman
-- (Opsional — jalankan jika demo_helpers.sql pernah di-run)
-- ============================================================

DROP FUNCTION IF EXISTS public.get_brand_orders_for_dashboard(uuid);
DROP FUNCTION IF EXISTS public.demo_verify_payment(uuid, text, text);


-- ============================================================
-- FIX SEC-03: Privatisasi Storage payment-proofs
-- ============================================================

-- Jika bucket sudah public, ubah ke private
-- UPDATE storage.buckets SET public = false WHERE id = 'payment-proofs';

-- Drop policy baca publik yang terlalu permisif
DROP POLICY IF EXISTS "Public Read Payment Proofs" ON storage.objects;

-- Hanya authenticated user yang bisa baca (brand owner via RLS join)
CREATE POLICY "Authenticated Read Payment Proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-proofs' AND
  auth.role() = 'authenticated'
);


-- ============================================================
-- FIX SEC-05: Revoke release_expired_slots dari public
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.release_expired_slots() FROM PUBLIC;
-- pg_cron tetap bisa memanggil karena berjalan sebagai superuser/service_role


-- ============================================================
-- FIX SEC-06: Kurangi Slot Lock Duration dari 24 jam ke 2 jam
-- Update di RPC create_order — function recreation
-- ============================================================

-- Catatan: Untuk mengubah slot lock duration, edit bagian ini di schema.sql:
-- Baris 445: now() + interval '24 hours' --> now() + interval '2 hours'
-- Jalankan CREATE OR REPLACE FUNCTION public.create_order(...) lagi dengan interval baru.


-- ============================================================
-- TAMBAHAN: RPC untuk update profil brand (logo & banner)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_brand_profile(
  p_name        text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_instagram   text DEFAULT NULL,
  p_logo_url    text DEFAULT NULL,
  p_banner_url  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_brand_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized.');
  END IF;

  -- Ambil brand milik user
  SELECT brand_id INTO v_brand_id
  FROM public.brand_owners
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Brand tidak ditemukan untuk akun ini.');
  END IF;

  -- Update hanya field yang diberikan (tidak NULL)
  UPDATE public.brands
  SET
    name        = COALESCE(nullif(trim(p_name), ''), name),
    description = CASE WHEN p_description IS NOT NULL THEN nullif(trim(p_description), '') ELSE description END,
    instagram   = CASE WHEN p_instagram IS NOT NULL THEN nullif(trim(p_instagram), '') ELSE instagram END,
    logo_url    = CASE WHEN p_logo_url IS NOT NULL THEN nullif(trim(p_logo_url), '') ELSE logo_url END,
    banner_url  = CASE WHEN p_banner_url IS NOT NULL THEN nullif(trim(p_banner_url), '') ELSE banner_url END
  WHERE id = v_brand_id;

  RETURN jsonb_build_object('success', true, 'message', 'Profil brand berhasil diperbarui.');
END;
$$;


-- ============================================================
-- SELESAI — Verifikasi
-- ============================================================
-- Cek policies setelah eksekusi:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
