-- ============================================================
-- DropFest — Demo Mode & CRUD Helper Functions
-- Jalankan di Supabase Dashboard → SQL Editor
-- 
-- Mendukung manajemen Produk, Drop, Pesanan, dan Verifikasi
-- untuk Brand Demo maupun Akun Brand Terautentikasi.
-- ============================================================

-- Daftar UUID Brand Demo:
-- Void Division:    11111111-0000-0000-0000-000000000001
-- Bumi Records:     11111111-0000-0000-0000-000000000002
-- Silo Coffee:      11111111-0000-0000-0000-000000000003

-- -------------------------------------------------------------
-- 1. get_brand_orders_for_dashboard
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_brand_orders_for_dashboard(p_brand_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_orders jsonb;
  v_allowed_ids uuid[] := ARRAY[
    '11111111-0000-0000-0000-000000000001'::uuid,
    '11111111-0000-0000-0000-000000000002'::uuid,
    '11111111-0000-0000-0000-000000000003'::uuid
  ];
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.brand_owners
      WHERE user_id = auth.uid() AND brand_id = p_brand_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Akses ditolak.');
    END IF;
  ELSE
    IF NOT (p_brand_id = ANY(v_allowed_ids)) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Akses ditolak. Hanya brand demo yang diperbolehkan.');
    END IF;
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'drop_id', o.drop_id,
      'buyer_name', o.buyer_name,
      'buyer_email', o.buyer_email,
      'buyer_phone', o.buyer_phone,
      'shipping_address', o.shipping_address,
      'quantity', o.quantity,
      'total_amount', o.total_amount,
      'status', o.status,
      'slot_token', o.slot_token,
      'slot_expires_at', o.slot_expires_at,
      'verified_by', o.verified_by,
      'verified_at', o.verified_at,
      'created_at', o.created_at,
      'drop', jsonb_build_object(
        'id', d.id,
        'title', d.title,
        'price', d.price,
        'status', d.status,
        'reserved_count', d.reserved_count,
        'total_slots', d.total_slots,
        'brand_id', d.brand_id,
        'product_id', d.product_id,
        'description', d.description,
        'banner_url', d.banner_url,
        'starts_at', d.starts_at,
        'ends_at', d.ends_at,
        'bank_name', d.bank_name,
        'account_number', d.account_number,
        'account_holder', d.account_holder,
        'created_at', d.created_at
      ),
      'payment_proof', (
        SELECT jsonb_build_object(
          'id', pp.id,
          'order_id', pp.order_id,
          'file_url', pp.file_url,
          'sender_name', pp.sender_name,
          'bank_name', pp.bank_name,
          'amount', pp.amount,
          'status', pp.status,
          'rejection_reason', pp.rejection_reason,
          'uploaded_at', pp.uploaded_at
        )
        FROM public.payment_proofs pp
        WHERE pp.order_id = o.id
        ORDER BY pp.uploaded_at DESC
        LIMIT 1
      )
    )
    ORDER BY o.created_at DESC
  ), '[]'::jsonb)
  INTO v_orders
  FROM public.orders o
  JOIN public.drops d ON d.id = o.drop_id
  WHERE d.brand_id = p_brand_id;

  RETURN jsonb_build_object('success', true, 'orders', v_orders);
END;
$$;


-- -------------------------------------------------------------
-- 2. demo_verify_payment
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demo_verify_payment(
  p_order_id uuid,
  p_action text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_drop_brand_id uuid;
  v_allowed_ids uuid[] := ARRAY[
    '11111111-0000-0000-0000-000000000001'::uuid,
    '11111111-0000-0000-0000-000000000002'::uuid,
    '11111111-0000-0000-0000-000000000003'::uuid
  ];
BEGIN
  IF p_action NOT IN ('verify', 'reject') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Action tidak valid.');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order tidak ditemukan.');
  END IF;

  SELECT d.brand_id INTO v_drop_brand_id
  FROM public.drops d WHERE d.id = v_order.drop_id;

  IF NOT (v_drop_brand_id = ANY(v_allowed_ids)) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Akses ditolak.');
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.brand_owners
      WHERE user_id = auth.uid() AND brand_id = v_drop_brand_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Akses ditolak.');
    END IF;
  END IF;

  IF p_action = 'verify' THEN
    UPDATE public.orders
    SET status = 'paid', verified_at = now()
    WHERE id = p_order_id;

    UPDATE public.payment_proofs
    SET status = 'verified'
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Pembayaran berhasil diverifikasi.');
  ELSE
    UPDATE public.orders
    SET status = 'pending_payment'
    WHERE id = p_order_id;

    UPDATE public.payment_proofs
    SET status = 'rejected', rejection_reason = p_rejection_reason
    WHERE order_id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Pembayaran berhasil ditolak.');
  END IF;
END;
$$;


-- -------------------------------------------------------------
-- 3. manage_product (CRUD Produk Aman)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manage_product(
  p_action text,
  p_brand_id uuid,
  p_product_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_image_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_allowed_ids uuid[] := ARRAY[
    '11111111-0000-0000-0000-000000000001'::uuid,
    '11111111-0000-0000-0000-000000000002'::uuid,
    '11111111-0000-0000-0000-000000000003'::uuid
  ];
  v_new_id uuid;
BEGIN
  -- Permission check
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.brand_owners WHERE user_id = auth.uid() AND brand_id = p_brand_id) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Akses ditolak: Kamu bukan pemilik brand ini.');
    END IF;
  ELSE
    IF NOT (p_brand_id = ANY(v_allowed_ids)) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Akses ditolak: Sesi demo tidak sah.');
    END IF;
  END IF;

  IF p_action = 'insert' THEN
    INSERT INTO public.products (brand_id, name, description, price, category, image_url)
    VALUES (p_brand_id, trim(p_name), nullif(trim(p_description), ''), p_price, nullif(trim(p_category), ''), nullif(trim(p_image_url), ''))
    RETURNING id INTO v_new_id;
    RETURN jsonb_build_object('success', true, 'id', v_new_id, 'message', 'Produk berhasil ditambahkan!');

  ELSIF p_action = 'update' THEN
    UPDATE public.products
    SET name = trim(p_name),
        description = nullif(trim(p_description), ''),
        price = p_price,
        category = nullif(trim(p_category), ''),
        image_url = nullif(trim(p_image_url), '')
    WHERE id = p_product_id AND brand_id = p_brand_id;
    RETURN jsonb_build_object('success', true, 'message', 'Produk berhasil diperbarui!');

  ELSIF p_action = 'delete' THEN
    DELETE FROM public.products WHERE id = p_product_id AND brand_id = p_brand_id;
    RETURN jsonb_build_object('success', true, 'message', 'Produk berhasil dihapus!');
  END IF;

  RETURN jsonb_build_object('success', false, 'message', 'Action tidak valid.');
END;
$$;


-- -------------------------------------------------------------
-- 4. manage_drop (CRUD Drop Aman)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manage_drop(
  p_action text,
  p_brand_id uuid,
  p_drop_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_banner_url text DEFAULT NULL,
  p_total_slots integer DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_starts_at timestamptz DEFAULT NULL,
  p_ends_at timestamptz DEFAULT NULL,
  p_status text DEFAULT 'scheduled',
  p_bank_name text DEFAULT NULL,
  p_account_number text DEFAULT NULL,
  p_account_holder text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_allowed_ids uuid[] := ARRAY[
    '11111111-0000-0000-0000-000000000001'::uuid,
    '11111111-0000-0000-0000-000000000002'::uuid,
    '11111111-0000-0000-0000-000000000003'::uuid
  ];
  v_new_id uuid;
BEGIN
  -- Permission check
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.brand_owners WHERE user_id = auth.uid() AND brand_id = p_brand_id) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Akses ditolak: Kamu bukan pemilik brand ini.');
    END IF;
  ELSE
    IF NOT (p_brand_id = ANY(v_allowed_ids)) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Akses ditolak: Sesi demo tidak sah.');
    END IF;
  END IF;

  IF p_action = 'insert' THEN
    INSERT INTO public.drops (
      brand_id, product_id, title, description, banner_url, total_slots, price,
      starts_at, ends_at, status, bank_name, account_number, account_holder
    )
    VALUES (
      p_brand_id, p_product_id, trim(p_title), nullif(trim(p_description), ''),
      nullif(trim(p_banner_url), ''), p_total_slots, p_price,
      p_starts_at, p_ends_at, p_status,
      nullif(trim(p_bank_name), ''), nullif(trim(p_account_number), ''), nullif(trim(p_account_holder), '')
    )
    RETURNING id INTO v_new_id;
    RETURN jsonb_build_object('success', true, 'id', v_new_id, 'message', 'Drop berhasil dibuat!');

  ELSIF p_action = 'update' THEN
    UPDATE public.drops
    SET product_id = p_product_id,
        title = trim(p_title),
        description = nullif(trim(p_description), ''),
        banner_url = nullif(trim(p_banner_url), ''),
        total_slots = p_total_slots,
        price = p_price,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        status = p_status,
        bank_name = nullif(trim(p_bank_name), ''),
        account_number = nullif(trim(p_account_number), ''),
        account_holder = nullif(trim(p_account_holder), '')
    WHERE id = p_drop_id AND brand_id = p_brand_id;
    RETURN jsonb_build_object('success', true, 'message', 'Drop berhasil diperbarui!');

  ELSIF p_action = 'delete' THEN
    DELETE FROM public.drops WHERE id = p_drop_id AND brand_id = p_brand_id;
    RETURN jsonb_build_object('success', true, 'message', 'Drop berhasil dihapus!');
  END IF;

  RETURN jsonb_build_object('success', false, 'message', 'Action tidak valid.');
END;
$$;
