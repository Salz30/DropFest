-- ============================================================
-- DropFest — Order, Slot, Schedule, and Product Lifecycle Fixes
-- Run once in Supabase SQL Editor AFTER schema.sql and security_fixes.sql.
-- Safe to re-run: functions are replaced and the cron job is recreated.
-- ============================================================

-- Required for the frontend's immediate slot/status updates. Supabase creates
-- this publication by default; duplicate registration is intentionally ignored.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.drops;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- Retire the unsafe email-only order lookup. The current frontend uses an
-- Order ID + email, or only device-local order history. A true recovery flow
-- must send a one-time link/code from an Edge Function.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_latest_order_by_email'
      AND pg_get_function_identity_arguments(p.oid) = 'p_email text'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.get_latest_order_by_email(text) FROM PUBLIC;
  END IF;
END;
$$;

-- A Drop may not end before (or exactly when) it starts.
ALTER TABLE public.drops
  DROP CONSTRAINT IF EXISTS drops_ends_after_starts;

ALTER TABLE public.drops
  ADD CONSTRAINT drops_ends_after_starts
  CHECK (ends_at IS NULL OR ends_at > starts_at) NOT VALID;

-- Validate separately so a legacy invalid row produces a clear error instead
-- of silently preventing deployment. Run this after correcting such rows:
-- ALTER TABLE public.drops VALIDATE CONSTRAINT drops_ends_after_starts;

-- Keep persisted status aligned with the server clock, even when no visitor
-- has the Drop page open. The order RPC below also validates the timestamps,
-- so this job is not the only protection.
CREATE OR REPLACE FUNCTION public.sync_drop_statuses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_live_count integer;
  v_ended_count integer;
BEGIN
  UPDATE public.drops
  SET status = 'live'
  WHERE status = 'scheduled'
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now());
  GET DIAGNOSTICS v_live_count = ROW_COUNT;

  UPDATE public.drops
  SET status = 'ended'
  WHERE status IN ('scheduled', 'live')
    AND ends_at IS NOT NULL
    AND ends_at <= now();
  GET DIAGNOSTICS v_ended_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'live_count', v_live_count,
    'ended_count', v_ended_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_drop_statuses() FROM PUBLIC;

-- Recreate the job by name so the migration remains repeatable.
DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid FROM cron.job WHERE jobname = 'sync-drop-statuses'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'sync-drop-statuses',
    '* * * * *',
    'SELECT public.sync_drop_statuses()'
  );
END;
$$;

-- The database is the authority for availability. A browser clock and a
-- stale page can never create an order before start time or after end time.
CREATE OR REPLACE FUNCTION public.create_order(
  p_drop_id          uuid,
  p_buyer_name       text,
  p_buyer_email      text,
  p_buyer_phone      text,
  p_shipping_address text,
  p_quantity         integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_drop           public.drops%ROWTYPE;
  v_order_id       uuid;
  v_slot_token     uuid;
  v_total_amount   numeric(12, 2);
  v_existing_order uuid;
BEGIN
  IF p_quantity < 1 OR p_quantity > 5 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Jumlah item harus antara 1 dan 5.');
  END IF;

  IF p_buyer_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Format email tidak valid.');
  END IF;

  SELECT * INTO v_drop
  FROM public.drops
  WHERE id = p_drop_id
    AND status IN ('scheduled', 'live')
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Drop belum dibuka atau sudah berakhir.');
  END IF;

  -- Persist the automatic transition even if the cron job has not run yet.
  IF v_drop.status = 'scheduled' THEN
    UPDATE public.drops SET status = 'live' WHERE id = v_drop.id;
    v_drop.status := 'live';
  END IF;

  IF v_drop.reserved_count + p_quantity > v_drop.total_slots THEN
    RETURN jsonb_build_object('success', false, 'message', 'Slot tidak mencukupi. Silakan daftar waitlist.');
  END IF;

  SELECT id INTO v_existing_order
  FROM public.orders
  WHERE drop_id = p_drop_id
    AND buyer_email = lower(trim(p_buyer_email))
    AND status IN ('pending_payment', 'awaiting_verification');

  IF v_existing_order IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Kamu masih memiliki pesanan aktif untuk drop ini.',
      'existing_order_id', v_existing_order
    );
  END IF;

  v_order_id := gen_random_uuid();
  v_slot_token := gen_random_uuid();
  v_total_amount := v_drop.price * p_quantity;

  UPDATE public.drops
  SET reserved_count = reserved_count + p_quantity
  WHERE id = v_drop.id;

  INSERT INTO public.orders (
    id, drop_id, buyer_name, buyer_email, buyer_phone, shipping_address,
    quantity, total_amount, status, slot_token, slot_expires_at
  ) VALUES (
    v_order_id, v_drop.id, trim(p_buyer_name), lower(trim(p_buyer_email)),
    trim(p_buyer_phone), trim(p_shipping_address), p_quantity, v_total_amount,
    'pending_payment', v_slot_token, now() + interval '24 hours'
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'slot_token', v_slot_token,
    'total_amount', v_total_amount,
    'slot_expires_at', now() + interval '24 hours',
    'message', 'Pesanan berhasil dibuat. Silakan upload bukti pembayaran dalam 24 jam.'
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kamu masih memiliki pesanan aktif untuk drop ini.');
END;
$$;

-- Guest cancellation is intentionally constrained to the Order ID + the
-- checkout email, and only before a payment proof is awaiting verification.
-- The order status and reserved_count change under row locks in one RPC.
CREATE OR REPLACE FUNCTION public.cancel_pending_order(
  p_order_id uuid,
  p_email    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND buyer_email = lower(trim(p_email))
    AND status = 'pending_payment'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pesanan tidak dapat dibatalkan.');
  END IF;

  -- Lock the Drop row before changing its counter.
  PERFORM 1 FROM public.drops WHERE id = v_order.drop_id FOR UPDATE;

  UPDATE public.orders SET status = 'cancelled' WHERE id = v_order.id;
  UPDATE public.drops
  SET reserved_count = GREATEST(0, reserved_count - v_order.quantity)
  WHERE id = v_order.drop_id;

  RETURN jsonb_build_object('success', true, 'message', 'Pesanan berhasil dibatalkan.');
END;
$$;

-- Product deletion is allowed only for an authenticated owner. The three
-- seeded demo brands are the sole exception so the explicit Demo Owner mode
-- can exercise CRUD without a real Supabase Auth session.
CREATE OR REPLACE FUNCTION public.delete_product(
  p_product_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand_id uuid;
  v_deleted_count integer;
BEGIN
  SELECT brand_id INTO v_brand_id FROM public.products WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Produk tidak ditemukan.');
  END IF;

  IF auth.uid() IS NULL THEN
    IF v_brand_id NOT IN (
      '11111111-0000-0000-0000-000000000001'::uuid,
      '11111111-0000-0000-0000-000000000002'::uuid,
      '11111111-0000-0000-0000-000000000003'::uuid
    ) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Silakan login terlebih dahulu.');
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.brand_owners
    WHERE user_id = auth.uid() AND brand_id = v_brand_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Akses ditolak.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.drops WHERE product_id = p_product_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Produk tidak dapat dihapus karena masih digunakan oleh Drop. Arsipkan produk atau hapus Drop tanpa order terlebih dahulu.');
  END IF;

  DELETE FROM public.products WHERE id = p_product_id AND brand_id = v_brand_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('success', v_deleted_count = 1, 'message', CASE WHEN v_deleted_count = 1 THEN 'Produk berhasil dihapus.' ELSE 'Produk gagal dihapus.' END);
END;
$$;

-- Compatibility RPC used by the current Dashboard. The unauthenticated path
-- is restricted to the exact seeded demo brand IDs only.
CREATE OR REPLACE FUNCTION public.manage_product(
  p_action      text,
  p_brand_id    uuid,
  p_product_id  uuid DEFAULT NULL,
  p_name        text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_price       numeric DEFAULT NULL,
  p_category    text DEFAULT NULL,
  p_image_url   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
  v_updated_count integer;
BEGIN
  IF auth.uid() IS NULL AND p_brand_id NOT IN (
    '11111111-0000-0000-0000-000000000001'::uuid,
    '11111111-0000-0000-0000-000000000002'::uuid,
    '11111111-0000-0000-0000-000000000003'::uuid
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Silakan login terlebih dahulu.');
  ELSIF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.brand_owners
    WHERE user_id = auth.uid() AND brand_id = p_brand_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Akses ditolak.');
  END IF;

  IF p_action = 'insert' THEN
    IF nullif(trim(p_name), '') IS NULL OR p_price IS NULL OR p_price < 0 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Nama dan harga produk wajib valid.');
    END IF;

    INSERT INTO public.products (brand_id, name, description, price, category, image_url)
    VALUES (
      p_brand_id, trim(p_name), nullif(trim(p_description), ''), p_price,
      nullif(trim(p_category), ''), nullif(trim(p_image_url), '')
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_object('success', true, 'id', v_new_id, 'message', 'Produk berhasil ditambahkan.');
  END IF;

  IF p_action = 'update' THEN
    IF p_product_id IS NULL OR nullif(trim(p_name), '') IS NULL OR p_price IS NULL OR p_price < 0 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Data produk tidak valid.');
    END IF;

    UPDATE public.products
    SET name = trim(p_name),
        description = nullif(trim(p_description), ''),
        price = p_price,
        category = nullif(trim(p_category), ''),
        image_url = nullif(trim(p_image_url), '')
    WHERE id = p_product_id AND brand_id = p_brand_id;
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN jsonb_build_object('success', v_updated_count = 1, 'message', CASE WHEN v_updated_count = 1 THEN 'Produk berhasil diperbarui.' ELSE 'Produk tidak ditemukan.' END);
  END IF;

  IF p_action = 'delete' THEN
    IF p_product_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'ID produk wajib diisi.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.drops WHERE product_id = p_product_id AND brand_id = p_brand_id) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Produk tidak dapat dihapus karena masih digunakan oleh Drop. Arsipkan produk atau hapus Drop tanpa order terlebih dahulu.');
    END IF;

    DELETE FROM public.products WHERE id = p_product_id AND brand_id = p_brand_id;
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN jsonb_build_object('success', v_updated_count = 1, 'message', CASE WHEN v_updated_count = 1 THEN 'Produk berhasil dihapus.' ELSE 'Produk tidak ditemukan.' END);
  END IF;

  RETURN jsonb_build_object('success', false, 'message', 'Action tidak valid.');
END;
$$;

-- A Drop may be removed only when it has no orders. Demo Owner is limited to
-- seeded demo brands; never cascade-delete a Drop with transactions.
CREATE OR REPLACE FUNCTION public.delete_drop(
  p_drop_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand_id uuid;
  v_deleted_count integer;
BEGIN
  SELECT brand_id INTO v_brand_id FROM public.drops WHERE id = p_drop_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Drop tidak ditemukan.');
  END IF;

  IF auth.uid() IS NULL THEN
    IF v_brand_id NOT IN (
      '11111111-0000-0000-0000-000000000001'::uuid,
      '11111111-0000-0000-0000-000000000002'::uuid,
      '11111111-0000-0000-0000-000000000003'::uuid
    ) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Silakan login terlebih dahulu.');
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.brand_owners
    WHERE user_id = auth.uid() AND brand_id = v_brand_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Akses ditolak.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.orders WHERE drop_id = p_drop_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Drop dengan pesanan tidak dapat dihapus agar riwayat transaksi tetap aman.');
  END IF;

  DELETE FROM public.drops WHERE id = p_drop_id AND brand_id = v_brand_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('success', v_deleted_count = 1, 'message', CASE WHEN v_deleted_count = 1 THEN 'Drop berhasil dihapus.' ELSE 'Drop gagal dihapus.' END);
END;
$$;

-- Customer-facing functions; owner-only functions still enforce auth.uid()
-- internally, regardless of these grants.
GRANT EXECUTE ON FUNCTION public.create_order(uuid, text, text, text, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pending_order(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_product(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_drop(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_product(text, uuid, uuid, text, text, numeric, text, text) TO anon, authenticated;

-- IMPORTANT: Do not expose an order merely from an email address. Email-only
-- recovery must be implemented by an Edge Function that emails a one-time,
-- short-lived recovery link/code. That delivery step cannot be safely done by
-- PostgreSQL alone.
