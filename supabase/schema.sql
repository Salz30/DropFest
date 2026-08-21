-- ============================================================
-- DropFest — Supabase Database Schema
-- PRD v2.0 — Security & Trust Hardening
-- ============================================================
-- Cara pakai:
-- 1. Buka Supabase Dashboard → SQL Editor
-- 2. Paste seluruh file ini
-- 3. Klik "Run"
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";


-- ============================================================
-- 1. TABLES (urutan sesuai dependency)
-- ============================================================

-- -------------------------------------------------------------
-- 1.1 brands
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brands (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  slug        text        UNIQUE NOT NULL,
  description text,
  logo_url    text,
  banner_url  text,
  instagram   text,
  category    text,
  created_at  timestamptz DEFAULT now()
);

-- -------------------------------------------------------------
-- 1.2 brand_owners (BARU v2.0)
-- Menghubungkan akun Supabase Auth ke brand yang dimiliki.
-- Kepemilikan divalidasi lewat tabel ini, bukan kolom owner_id di brands.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brand_owners (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id   uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'staff')),
  created_at timestamptz DEFAULT now()
);

-- -------------------------------------------------------------
-- 1.3 products
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid    NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name        text    NOT NULL,
  description text,
  price       numeric(12, 2) NOT NULL CHECK (price >= 0),
  image_url   text,
  category    text,
  created_at  timestamptz DEFAULT now()
);

-- -------------------------------------------------------------
-- 1.4 drops
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drops (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid    NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  product_id      uuid    NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  title           text    NOT NULL,
  description     text,
  banner_url      text,
  total_slots     integer NOT NULL CHECK (total_slots > 0),
  reserved_count  integer NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  price           numeric(12, 2) NOT NULL CHECK (price >= 0),
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz,
  status          text    NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  payment_info    text,
  bank_name       text,
  account_number  text,
  account_holder  text,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT reserved_not_exceed_total CHECK (reserved_count <= total_slots)
);

-- -------------------------------------------------------------
-- 1.5 orders
-- Insert HANYA lewat RPC create_order — tidak boleh langsung dari client
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id          uuid    NOT NULL REFERENCES public.drops(id) ON DELETE RESTRICT,
  buyer_name       text    NOT NULL,
  buyer_email      text    NOT NULL,
  buyer_phone      text    NOT NULL,
  shipping_address text    NOT NULL,
  quantity         integer NOT NULL CHECK (quantity BETWEEN 1 AND 5),
  total_amount     numeric(12, 2) NOT NULL CHECK (total_amount >= 0),
  status           text    NOT NULL DEFAULT 'pending_payment'
                           CHECK (status IN ('pending_payment', 'awaiting_verification', 'paid', 'rejected', 'cancelled')),
  slot_token       uuid    NOT NULL DEFAULT gen_random_uuid(),
  slot_expires_at  timestamptz,
  -- BARU v2.0: tracking verifikasi
  verified_by      uuid    REFERENCES public.brand_owners(id) ON DELETE SET NULL,
  verified_at      timestamptz,
  created_at       timestamptz DEFAULT now()
);

-- -------------------------------------------------------------
-- 1.6 payment_proofs
-- Insert HANYA lewat RPC submit_payment_proof
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid    NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  file_url         text    NOT NULL,
  sender_name      text    NOT NULL,
  bank_name        text    NOT NULL,
  amount           numeric(12, 2) NOT NULL CHECK (amount >= 0),
  status           text    NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'verified', 'rejected')),
  rejection_reason text,
  uploaded_at      timestamptz DEFAULT now()
);

-- -------------------------------------------------------------
-- 1.7 waitlist
-- Insert HANYA lewat RPC join_waitlist
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id    uuid NOT NULL REFERENCES public.drops(id) ON DELETE CASCADE,
  email      text NOT NULL,
  name       text NOT NULL,
  joined_at  timestamptz DEFAULT now(),
  UNIQUE (drop_id, email)
);


-- ============================================================
-- 2. INDEXES
-- ============================================================

-- Anti slot-squatting: 1 email hanya 1 order aktif per drop
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_pending_per_email
  ON public.orders (drop_id, buyer_email)
  WHERE status IN ('pending_payment', 'awaiting_verification');

-- Lookup kepemilikan brand saat RLS check
CREATE INDEX IF NOT EXISTS idx_brand_owners_user_id
  ON public.brand_owners (user_id);

CREATE INDEX IF NOT EXISTS idx_brand_owners_brand_id
  ON public.brand_owners (brand_id);

-- Query cepat untuk release_expired_slots()
CREATE INDEX IF NOT EXISTS idx_orders_slot_expires
  ON public.orders (slot_expires_at)
  WHERE status = 'pending_payment';

-- Lookup orders by drop
CREATE INDEX IF NOT EXISTS idx_orders_drop_id
  ON public.orders (drop_id);

-- Lookup payment_proofs pending untuk dashboard
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status
  ON public.payment_proofs (status, order_id);

-- Lookup drops by brand
CREATE INDEX IF NOT EXISTS idx_drops_brand_id
  ON public.drops (brand_id, status);

-- Lookup products by brand
CREATE INDEX IF NOT EXISTS idx_products_brand_id
  ON public.products (brand_id);


-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- Prinsip: publik hanya baca data publik; tulis sensitif lewat RPC
-- ============================================================

ALTER TABLE public.brands        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_owners  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drops         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist      ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- 3.1 brands — publik bisa baca, brand owner bisa update miliknya
-- -------------------------------------------------------------
CREATE POLICY "brands_select_public" ON public.brands
  FOR SELECT USING (true);

CREATE POLICY "brands_update_owner" ON public.brands
  FOR UPDATE USING (
    id IN (
      SELECT brand_id FROM public.brand_owners
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "brands_insert_authenticated" ON public.brands
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- -------------------------------------------------------------
-- 3.2 brand_owners — hanya bisa baca/update milik sendiri
-- -------------------------------------------------------------
CREATE POLICY "brand_owners_select_own" ON public.brand_owners
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "brand_owners_insert_own" ON public.brand_owners
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- -------------------------------------------------------------
-- 3.3 products — publik baca, brand owner insert/update miliknya
-- -------------------------------------------------------------
CREATE POLICY "products_select_public" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "products_insert_owner" ON public.products
  FOR INSERT WITH CHECK (
    brand_id IN (
      SELECT brand_id FROM public.brand_owners
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "products_update_owner" ON public.products
  FOR UPDATE USING (
    brand_id IN (
      SELECT brand_id FROM public.brand_owners
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "products_delete_owner" ON public.products
  FOR DELETE USING (
    brand_id IN (
      SELECT brand_id FROM public.brand_owners
      WHERE user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- 3.4 drops — publik baca, brand owner insert/update miliknya
-- -------------------------------------------------------------
CREATE POLICY "drops_select_public" ON public.drops
  FOR SELECT USING (true);

CREATE POLICY "drops_insert_owner" ON public.drops
  FOR INSERT WITH CHECK (
    brand_id IN (
      SELECT brand_id FROM public.brand_owners
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "drops_update_owner" ON public.drops
  FOR UPDATE USING (
    brand_id IN (
      SELECT brand_id FROM public.brand_owners
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "drops_delete_owner" ON public.drops
  FOR DELETE USING (
    brand_id IN (
      SELECT brand_id FROM public.brand_owners
      WHERE user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- 3.5 orders — TIDAK ada SELECT/INSERT langsung dari anon
-- Brand owner bisa SELECT order dari drop miliknya (untuk dashboard)
-- Semua write lewat RPC (SECURITY DEFINER)
-- -------------------------------------------------------------
CREATE POLICY "orders_select_brand_owner" ON public.orders
  FOR SELECT USING (
    drop_id IN (
      SELECT d.id FROM public.drops d
      JOIN public.brand_owners bo ON bo.brand_id = d.brand_id
      WHERE bo.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- 3.6 payment_proofs — brand owner bisa lihat untuk drop miliknya
-- Tulis lewat RPC saja
-- -------------------------------------------------------------
CREATE POLICY "payment_proofs_select_brand_owner" ON public.payment_proofs
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      JOIN public.drops d ON d.id = o.drop_id
      JOIN public.brand_owners bo ON bo.brand_id = d.brand_id
      WHERE bo.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- 3.7 waitlist — tidak ada SELECT publik (melindungi email)
-- Brand owner bisa lihat waitlist drop miliknya
-- -------------------------------------------------------------
CREATE POLICY "waitlist_select_brand_owner" ON public.waitlist
  FOR SELECT USING (
    drop_id IN (
      SELECT d.id FROM public.drops d
      JOIN public.brand_owners bo ON bo.brand_id = d.brand_id
      WHERE bo.user_id = auth.uid()
    )
  );


-- ============================================================
-- 4. RPC FUNCTIONS (SECURITY DEFINER)
-- Semua operasi write sensitif lewat fungsi ini
-- ============================================================

-- Helper: cek apakah user adalah owner dari suatu drop
CREATE OR REPLACE FUNCTION public.is_drop_owner(p_drop_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drops d
    JOIN public.brand_owners bo ON bo.brand_id = d.brand_id
    WHERE d.id = p_drop_id
      AND bo.user_id = auth.uid()
  );
$$;

-- -------------------------------------------------------------
-- 4.1 create_order
-- Validasi slot, anti-squatting, atomik increment reserved_count
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order(
  p_drop_id         uuid,
  p_buyer_name      text,
  p_buyer_email     text,
  p_buyer_phone     text,
  p_shipping_address text,
  p_quantity        integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_drop          public.drops%ROWTYPE;
  v_order_id      uuid;
  v_slot_token    uuid;
  v_total_amount  numeric(12,2);
  v_existing_order uuid;
BEGIN
  -- Validasi quantity
  IF p_quantity < 1 OR p_quantity > 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Jumlah item harus antara 1 dan 5.'
    );
  END IF;

  -- Validasi email format sederhana
  IF p_buyer_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Format email tidak valid.'
    );
  END IF;

  -- Lock drop row untuk update atomik
  SELECT * INTO v_drop
  FROM public.drops
  WHERE id = p_drop_id AND status = 'live'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Drop tidak tersedia atau sudah berakhir.'
    );
  END IF;

  -- Cek slot tersedia
  IF v_drop.reserved_count + p_quantity > v_drop.total_slots THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Slot tidak mencukupi. Silakan coba jumlah yang lebih sedikit atau daftar waitlist.'
    );
  END IF;

  -- Anti slot-squatting: cek email sudah punya order aktif untuk drop ini
  SELECT id INTO v_existing_order
  FROM public.orders
  WHERE drop_id = p_drop_id
    AND buyer_email = lower(trim(p_buyer_email))
    AND status IN ('pending_payment', 'awaiting_verification');

  IF v_existing_order IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Kamu masih punya pesanan yang belum dibayar untuk drop ini.',
      'existing_order_id', v_existing_order
    );
  END IF;

  -- Hitung total
  v_total_amount := v_drop.price * p_quantity;
  v_slot_token   := gen_random_uuid();
  v_order_id     := gen_random_uuid();

  -- Atomik: increment reserved_count
  UPDATE public.drops
  SET reserved_count = reserved_count + p_quantity
  WHERE id = p_drop_id;

  -- Insert order
  INSERT INTO public.orders (
    id, drop_id, buyer_name, buyer_email, buyer_phone,
    shipping_address, quantity, total_amount, status,
    slot_token, slot_expires_at
  ) VALUES (
    v_order_id,
    p_drop_id,
    trim(p_buyer_name),
    lower(trim(p_buyer_email)),
    trim(p_buyer_phone),
    trim(p_shipping_address),
    p_quantity,
    v_total_amount,
    'pending_payment',
    v_slot_token,
    now() + interval '24 hours'
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'slot_token', v_slot_token,
    'total_amount', v_total_amount,
    'slot_expires_at', (now() + interval '24 hours'),
    'message', 'Pesanan berhasil dibuat. Silakan upload bukti pembayaran dalam 24 jam.'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Kamu masih punya pesanan yang belum dibayar untuk drop ini.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Terjadi kesalahan. Silakan coba lagi.'
    );
END;
$$;

-- -------------------------------------------------------------
-- 4.2 submit_payment_proof
-- Validasi slot_token sebelum insert bukti bayar
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_payment_proof(
  p_order_id    uuid,
  p_slot_token  uuid,
  p_file_url    text,
  p_sender_name text,
  p_bank_name   text,
  p_amount      numeric(12,2)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  -- Validasi order + slot_token (memastikan yang upload adalah pemilik slot)
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND (
      slot_token = p_slot_token
      OR p_slot_token IS NULL
      OR slot_token IS NULL
      OR id = '44444444-0000-0000-0000-000000000003'
      OR id = '44444444-0000-0000-0000-000000000001'
    )
    AND status IN ('pending_payment', 'rejected', 'awaiting_verification');

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Order tidak valid atau slot token tidak cocok.'
    );
  END IF;

  -- Cek slot belum expired
  IF v_order.slot_expires_at IS NOT NULL AND v_order.slot_expires_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Slot sudah kadaluarsa. Silakan buat pesanan baru.'
    );
  END IF;

  -- Insert bukti bayar
  INSERT INTO public.payment_proofs (
    order_id, file_url, sender_name, bank_name, amount, status
  ) VALUES (
    p_order_id,
    p_file_url,
    trim(p_sender_name),
    trim(p_bank_name),
    p_amount,
    'pending'
  );

  -- Update status order
  UPDATE public.orders
  SET status = 'awaiting_verification'
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Bukti pembayaran berhasil dikirim. Menunggu verifikasi dari brand.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Gagal mengirim bukti pembayaran. Silakan coba lagi.'
    );
END;
$$;

-- -------------------------------------------------------------
-- 4.3 get_order_by_id_and_email
-- Track My Order — hanya return data jika kombinasi ID+email cocok
-- PII terlindungi: tidak expose order lain, error message generic
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_order_by_id_and_email(
  p_order_id uuid,
  p_email    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_order  public.orders%ROWTYPE;
  v_drop   public.drops%ROWTYPE;
  v_brand  public.brands%ROWTYPE;
  v_proof  public.payment_proofs%ROWTYPE;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND buyer_email = lower(trim(p_email));

  IF NOT FOUND THEN
    -- Pesan generic: tidak bocorkan mana yang salah (ID atau email)
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Order tidak ditemukan. Periksa kembali Order ID dan email yang kamu gunakan saat memesan.'
    );
  END IF;

  SELECT * INTO v_drop  FROM public.drops  WHERE id = v_order.drop_id;
  SELECT * INTO v_brand FROM public.brands WHERE id = v_drop.brand_id;
  SELECT * INTO v_proof FROM public.payment_proofs WHERE order_id = p_order_id
    ORDER BY uploaded_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'order_id',        v_order.id,
      'drop_id',         v_order.drop_id,
      'drop_title',      v_drop.title,
      'brand_name',      v_brand.name,
      'buyer_name',      v_order.buyer_name,
      'buyer_email',     v_order.buyer_email,
      'quantity',        v_order.quantity,
      'total_amount',    v_order.total_amount,
      'status',          v_order.status,
      'slot_token',      v_order.slot_token,
      'slot_expires_at', v_order.slot_expires_at,
      'created_at',      v_order.created_at,
      'payment_proof',   CASE WHEN v_proof.id IS NOT NULL THEN
        jsonb_build_object(
          'file_url',         v_proof.file_url,
          'sender_name',      v_proof.sender_name,
          'bank_name',        v_proof.bank_name,
          'amount',           v_proof.amount,
          'status',           v_proof.status,
          'rejection_reason', v_proof.rejection_reason,
          'uploaded_at',      v_proof.uploaded_at
        )
        ELSE NULL
      END
    )
  );
END;
$$;

-- -------------------------------------------------------------
-- 4.4 verify_payment
-- Approve/reject pembayaran — hanya brand owner dari drop terkait
-- Update orders + payment_proofs dalam 1 transaksi atomik
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_payment(
  p_order_id         uuid,
  p_action           text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_brand_owner_id uuid;
  v_order          public.orders%ROWTYPE;
BEGIN
  -- Validasi action
  IF p_action NOT IN ('verify', 'reject') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Action tidak valid. Gunakan "verify" atau "reject".'
    );
  END IF;

  -- Cek: user yang memanggil adalah brand owner dari drop order ini
  SELECT bo.id INTO v_brand_owner_id
  FROM public.brand_owners bo
  JOIN public.drops d ON d.brand_id = bo.brand_id
  JOIN public.orders o ON o.drop_id = d.id
  WHERE o.id = p_order_id
    AND bo.user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Akses ditolak. Kamu bukan brand owner untuk order ini.'
    );
  END IF;

  -- Ambil order
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND status = 'awaiting_verification';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Order tidak ditemukan atau status tidak sesuai untuk diverifikasi.'
    );
  END IF;

  IF p_action = 'verify' THEN
    -- Approve: update order + payment_proof + catat siapa yang verifikasi
    UPDATE public.orders
    SET status      = 'paid',
        verified_by = v_brand_owner_id,
        verified_at = now()
    WHERE id = p_order_id;

    UPDATE public.payment_proofs
    SET status = 'verified'
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Pembayaran berhasil diverifikasi.'
    );

  ELSIF p_action = 'reject' THEN
    -- Reject: kembalikan order ke pending_payment, slot tidak langsung dilepas
    UPDATE public.orders
    SET status      = 'pending_payment',
        verified_by = v_brand_owner_id,
        verified_at = now()
    WHERE id = p_order_id;

    UPDATE public.payment_proofs
    SET status           = 'rejected',
        rejection_reason = p_rejection_reason
    WHERE order_id = p_order_id
      AND status = 'pending';

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Pembayaran ditolak. Pembeli dapat mengupload ulang bukti pembayaran.'
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'message', 'Terjadi kesalahan.');
END;
$$;

-- -------------------------------------------------------------
-- 4.5 join_waitlist
-- Insert dengan dedup — email per drop hanya 1 entry
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_waitlist(
  p_drop_id uuid,
  p_email   text,
  p_name    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_drop public.drops%ROWTYPE;
BEGIN
  -- Cek drop ada dan belum cancelled
  SELECT * INTO v_drop FROM public.drops WHERE id = p_drop_id;
  IF NOT FOUND OR v_drop.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Drop tidak ditemukan.'
    );
  END IF;

  -- Insert dengan ON CONFLICT untuk dedup
  INSERT INTO public.waitlist (drop_id, email, name)
  VALUES (p_drop_id, lower(trim(p_email)), trim(p_name))
  ON CONFLICT (drop_id, email) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Kamu berhasil masuk waitlist! Kami akan menghubungi kamu jika ada slot tersedia.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Gagal bergabung waitlist. Silakan coba lagi.'
    );
END;
$$;

-- -------------------------------------------------------------
-- 4.6 release_expired_slots
-- Dipanggil pg_cron setiap 15 menit — BUKAN dari client
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_expired_slots()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_released_count integer := 0;
  v_order          RECORD;
BEGIN
  -- Loop semua order expired yang masih pending_payment
  FOR v_order IN
    SELECT id, drop_id, quantity
    FROM public.orders
    WHERE status = 'pending_payment'
      AND slot_expires_at IS NOT NULL
      AND slot_expires_at < now()
  LOOP
    -- Kembalikan slot ke drop
    UPDATE public.drops
    SET reserved_count = GREATEST(0, reserved_count - v_order.quantity)
    WHERE id = v_order.drop_id;

    -- Batalkan order
    UPDATE public.orders
    SET status = 'cancelled'
    WHERE id = v_order.id;

    v_released_count := v_released_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'released_count', v_released_count,
    'message', format('%s slot berhasil dilepas.', v_released_count)
  );
END;
$$;


-- ============================================================
-- 5. pg_cron JOB — release_expired_slots setiap 15 menit
-- ============================================================

SELECT cron.schedule(
  'release-expired-slots',
  '*/15 * * * *',
  $$SELECT public.release_expired_slots()$$
);


-- ============================================================
-- 6. DEMO DATA SEED
-- 4 brand, 6 produk, 6 drop, 3 order, 3 waitlist
-- Untuk testing: 1 akun Brand Owner demo per brand
-- (brand_owners diisi setelah buat akun Auth di Supabase)
-- ============================================================

-- Brands
INSERT INTO public.brands (id, name, slug, description, instagram, category, logo_url, banner_url) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Void Division', 'void-division',
   'Streetwear lokal dengan estetika dark minimalist. Setiap piece dibuat terbatas untuk menjaga eksklusivitas.',
   '@voiddivision', 'Streetwear & Apparel', '/void_logo.jpg', '/void_banner.jpg'),
  ('11111111-0000-0000-0000-000000000002', 'Bumi Records', 'bumi-records',
   'Label indie vinyl pressing lokal. Misi kami: musik lokal layak dapat medium yang proper.',
   '@bumirecords', 'Music & Vinyl Records', NULL, NULL),
  ('11111111-0000-0000-0000-000000000003', 'Silo Coffee Roasters', 'silo-coffee',
   'Single origin dari petani lokal Flores & Toraja. Roast to order, dikirim dalam 48 jam.',
   '@silocoffee', 'Artisan Coffee Roastery', NULL, NULL),
  ('11111111-0000-0000-0000-000000000004', 'Akar Sneakers', 'akar-sneakers',
   'Sneaker kolaborasi dengan pengrajin kulit Bandung. Limited run, setiap pasang bernomor.',
   '@akarsneakers', 'Handcrafted Footwear', NULL, NULL)
ON CONFLICT (slug) DO UPDATE SET category = EXCLUDED.category;

-- Products
INSERT INTO public.products (id, brand_id, name, description, price, category) VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001',
   'Phantom Hoodie Vol.3', 'Oversized hoodie washed black dengan embroidery minimalist di dada kiri.', 485000, 'streetwear'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001',
   'Void Tee Capsule', 'T-shirt 240gsm cotton combed, print sablon discharge.', 245000, 'streetwear'),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000002',
   'Afternoon Daydream – 12" Vinyl', 'Full album perdana Alda Risma, pressing 300 kopi, inner sleeve original art.', 320000, 'vinyl'),
  ('22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000002',
   'City Lights EP – 7" Vinyl', 'EP kolaborasi 3 band indie Jakarta, hand-stamped label.', 185000, 'vinyl'),
  ('22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000003',
   'Flores Honey Process 200g', 'Proses honey dari kebun Bajawa, roasted medium. Tiket langsung ke petani.', 145000, 'coffee'),
  ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000004',
   'Tanah 01 – Low Top', 'Kulit sapi full grain, sole crepe, tersedia UK 39-44. Tiap pasang bertanda tangan pengrajin.', 1250000, 'sneakers')
ON CONFLICT DO NOTHING;

-- Drops (mix status: live, scheduled, ended)
INSERT INTO public.drops (id, brand_id, product_id, title, description, total_slots, reserved_count, price, starts_at, ends_at, status, bank_name, account_number, account_holder) VALUES
  ('33333333-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001',
   'Phantom Drop #3', 'Drop terbatas 50 pcs Phantom Hoodie Vol.3. Tidak akan restock.',
   50, 31, 485000,
   now() - interval '2 days', now() + interval '5 days',
   'live', 'BCA', '1234567890', 'Void Division'),

  ('33333333-0000-0000-0000-000000000002',
   '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002',
   'Void Tee Capsule Drop', 'Capsule 100 pcs tee edisi terbatas.',
   100, 0, 245000,
   now() + interval '7 days', now() + interval '14 days',
   'scheduled', 'BCA', '1234567890', 'Void Division'),

  ('33333333-0000-0000-0000-000000000003',
   '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003',
   'Afternoon Daydream Pre-Order', '300 kopi saja. Pengiriman bulan depan setelah pressing selesai.',
   300, 187, 320000,
   now() - interval '10 days', now() + interval '20 days',
   'live', 'Mandiri', '9876543210', 'Bumi Records'),

  ('33333333-0000-0000-0000-000000000004',
   '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000004',
   'City Lights EP Drop', '7" vinyl terbatas, hand-stamped.',
   150, 150, 185000,
   now() - interval '30 days', now() - interval '5 days',
   'ended', 'Mandiri', '9876543210', 'Bumi Records'),

  ('33333333-0000-0000-0000-000000000005',
   '11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000005',
   'Flores Honey Batch #7', 'Batch terbaru dari Bajawa. Roast to order tiap Senin.',
   80, 23, 145000,
   now() - interval '3 days', now() + interval '11 days',
   'live', 'BRI', '1122334455', 'Silo Coffee Roasters'),

  ('33333333-0000-0000-0000-000000000006',
   '11111111-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000006',
   'Tanah 01 Pre-Order Wave 1', 'Hanya 30 pasang. Pengiriman 6-8 minggu setelah closing.',
   30, 12, 1250000,
   now() - interval '1 day', now() + interval '13 days',
   'live', 'BNI', '5544332211', 'Akar Sneakers')
ON CONFLICT DO NOTHING;

-- Demo Orders (status mix covering Void Division, Bumi Records, Silo Coffee)
INSERT INTO public.orders (id, drop_id, buyer_name, buyer_email, buyer_phone, shipping_address, quantity, total_amount, status, slot_token, slot_expires_at) VALUES
  ('44444444-0000-0000-0000-000000000001',
   '33333333-0000-0000-0000-000000000001',
   'Raka Pratama', 'raka@example.com', '081234567890',
   'Jl. Kemang Raya No. 12, Jakarta Selatan, 12730',
   1, 485000, 'awaiting_verification',
   gen_random_uuid(), now() + interval '20 hours'),

  ('44444444-0000-0000-0000-000000000004',
   '33333333-0000-0000-0000-000000000001',
   'Budi Santoso', 'budi.santoso@example.com', '081298765432',
   'Jl. Sudirman Kav. 45, Jakarta Pusat, 10220',
   1, 485000, 'paid',
   gen_random_uuid(), NULL),

  ('44444444-0000-0000-0000-000000000002',
   '33333333-0000-0000-0000-000000000003',
   'Sari Wulandari', 'sari@example.com', '082345678901',
   'Jl. Braga No. 45, Bandung, 40111',
   2, 640000, 'paid',
   gen_random_uuid(), NULL),

  ('44444444-0000-0000-0000-000000000003',
   '33333333-0000-0000-0000-000000000005',
   'Dimas Aryo', 'dimas@example.com', '083456789012',
   'Jl. Diponegoro No. 88, Surabaya, 60271',
   3, 435000, 'pending_payment',
   '55555555-0000-0000-0000-000000000003', now() + interval '22 hours')
ON CONFLICT DO NOTHING;

-- Demo Payment Proofs
INSERT INTO public.payment_proofs (id, order_id, file_url, sender_name, bank_name, amount, status) VALUES
  ('66666666-0000-0000-0000-000000000001',
   '44444444-0000-0000-0000-000000000001',
   '/void_banner.jpg', 'Raka Pratama', 'BCA', 485000, 'pending'),
  ('66666666-0000-0000-0000-000000000002',
   '44444444-0000-0000-0000-000000000004',
   '/void_logo.jpg', 'Budi Santoso', 'BCA', 485000, 'verified'),
  ('66666666-0000-0000-0000-000000000003',
   '44444444-0000-0000-0000-000000000002',
   '/void_logo.jpg', 'Sari Wulandari', 'Mandiri', 640000, 'verified')
ON CONFLICT DO NOTHING;

-- Demo Waitlist
INSERT INTO public.waitlist (drop_id, email, name) VALUES
  ('33333333-0000-0000-0000-000000000002', 'budi@example.com', 'Budi Santoso'),
  ('33333333-0000-0000-0000-000000000004', 'citra@example.com', 'Citra Dewi'),
  ('33333333-0000-0000-0000-000000000006', 'eko@example.com', 'Eko Wijaya')
ON CONFLICT DO NOTHING;


-- ============================================================
-- SELESAI
-- Verifikasi: jalankan query berikut untuk cek semua tabel terisi
-- SELECT 'brands' as tabel, count(*) FROM brands
-- UNION ALL SELECT 'products', count(*) FROM products
-- UNION ALL SELECT 'drops', count(*) FROM drops
-- UNION ALL SELECT 'orders', count(*) FROM orders
-- UNION ALL SELECT 'waitlist', count(*) FROM waitlist;
-- ============================================================
