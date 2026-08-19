-- ============================================================
-- DropFest — Demo Mode Helper Functions
-- Jalankan di Supabase SQL Editor untuk mengaktifkan 1-Click Demo Mode
-- ============================================================

-- 1. Fungsi mengambil data pesanan & bukti transfer untuk dashboard brand demo
CREATE OR REPLACE FUNCTION public.get_brand_orders_for_dashboard(p_brand_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orders jsonb;
BEGIN
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
      'created_at', o.created_at,
      'drop', jsonb_build_object(
        'id', d.id,
        'title', d.title,
        'price', d.price,
        'status', d.status,
        'reserved_count', d.reserved_count,
        'total_slots', d.total_slots
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
  ), '[]'::jsonb)
  INTO v_orders
  FROM public.orders o
  JOIN public.drops d ON d.id = o.drop_id
  WHERE d.brand_id = p_brand_id
  ORDER BY o.created_at DESC;

  RETURN jsonb_build_object('success', true, 'orders', v_orders);
END;
$$;

-- 2. Fungsi verifikasi pembayaran demo
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
BEGIN
  IF p_action NOT IN ('verify', 'reject') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Action tidak valid. Gunakan verify atau reject.');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order tidak ditemukan.');
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
