-- ============================================================
-- DROPFEST INCREMENTAL UPDATE PATCH (Safe to re-run in Supabase SQL Editor)
-- ============================================================

-- 1. Tambahkan kolom category ke tabel brands jika belum ada
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS category text;

-- 2. Update RPC submit_payment_proof (diperbarui agar suport demo & pengiriman ulang)
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
  -- Validasi order + slot_token (fleksibel untuk pesanan demo & slot_token valid)
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

-- 3. Update RPC get_order_by_id_and_email (diperbarui dengan buyer_email)
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

-- 4. Update data demo brand kategori & slot token
UPDATE public.brands SET category = 'Streetwear & Apparel', logo_url = '/void_logo.jpg', banner_url = '/void_banner.jpg' WHERE slug = 'void-division';
UPDATE public.brands SET category = 'Music & Vinyl Records' WHERE slug = 'bumi-records';
UPDATE public.brands SET category = 'Artisan Coffee Roastery' WHERE slug = 'silo-coffee';
UPDATE public.brands SET category = 'Handcrafted Footwear' WHERE slug = 'akar-sneakers';
UPDATE public.orders SET slot_token = '55555555-0000-0000-0000-000000000003' WHERE id = '44444444-0000-0000-0000-000000000003';
