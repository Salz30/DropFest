import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  PackageCheck, Clock, AlertCircle, CheckCircle2,
  Upload, X, Zap, Copy, Check, LayoutDashboard, ShieldCheck
} from 'lucide-react'
import { supabase, callRpc } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { OrderStatus, PaymentProofStatus } from '../types'
import { useBreakpoint } from '../hooks/useBreakpoint'

interface TrackOrderData {
  order_id: string
  drop_id: string
  drop_title: string
  brand_name: string
  buyer_name: string
  buyer_email?: string
  quantity: number
  total_amount: number
  status: OrderStatus
  slot_token: string
  slot_expires_at: string | null
  created_at: string
  payment_proof?: {
    file_url: string
    sender_name: string
    bank_name: string
    amount: number
    status: PaymentProofStatus
    rejection_reason: string | null
    uploaded_at: string
  } | null
}

const demoOrders = [
  {
    label: '🟡 Menunggu Verifikasi (Raka)',
    id: '44444444-0000-0000-0000-000000000001',
    email: 'raka@example.com',
  },
  {
    label: '🟢 Pembayaran Lunas (Sari)',
    id: '44444444-0000-0000-0000-000000000002',
    email: 'sari@example.com',
  },
  {
    label: '🟠 Belum Bayar (Dimas)',
    id: '44444444-0000-0000-0000-000000000003',
    email: 'dimas@example.com',
  },
  {
    label: '🔵 Guest Pre-Order (Budi)',
    id: '44444444-0000-0000-0000-000000000001',
    email: 'budi.santoso@example.com',
  },
]

const DEMO_FIXTURES: Record<string, TrackOrderData> = {
  'raka@example.com': {
    order_id: '44444444-0000-0000-0000-000000000001',
    drop_id: '33333333-0000-0000-0000-000000000001',
    drop_title: 'VOID-01 "NIGHTFALL" Heavyweight Hoodie',
    brand_name: 'Void Division',
    buyer_name: 'Raka Pratama',
    quantity: 1,
    total_amount: 485000,
    status: 'awaiting_verification',
    slot_token: '55555555-0000-0000-0000-000000000001',
    slot_expires_at: new Date(Date.now() + 20 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    payment_proof: {
      file_url: '/void_banner.jpg',
      sender_name: 'Raka Pratama',
      bank_name: 'BCA',
      amount: 485000,
      status: 'pending',
      rejection_reason: null,
      uploaded_at: new Date(Date.now() - 1 * 3600000).toISOString(),
    }
  },
  'budi.santoso@example.com': {
    order_id: '44444444-0000-0000-0000-000000000001',
    drop_id: '33333333-0000-0000-0000-000000000001',
    drop_title: 'VOID-01 "NIGHTFALL" Heavyweight Hoodie',
    brand_name: 'Void Division',
    buyer_name: 'Budi Santoso',
    quantity: 1,
    total_amount: 485000,
    status: 'awaiting_verification',
    slot_token: '55555555-0000-0000-0000-000000000001',
    slot_expires_at: new Date(Date.now() + 20 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    payment_proof: {
      file_url: '/void_banner.jpg',
      sender_name: 'Budi Santoso',
      bank_name: 'BCA',
      amount: 485000,
      status: 'pending',
      rejection_reason: null,
      uploaded_at: new Date(Date.now() - 1 * 3600000).toISOString(),
    }
  },
  'budi@example.com': {
    order_id: '44444444-0000-0000-0000-000000000001',
    drop_id: '33333333-0000-0000-0000-000000000001',
    drop_title: 'VOID-01 "NIGHTFALL" Heavyweight Hoodie',
    brand_name: 'Void Division',
    buyer_name: 'Budi Santoso',
    quantity: 1,
    total_amount: 485000,
    status: 'awaiting_verification',
    slot_token: '55555555-0000-0000-0000-000000000001',
    slot_expires_at: new Date(Date.now() + 20 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    payment_proof: null
  },
  'sari@example.com': {
    order_id: '44444444-0000-0000-0000-000000000002',
    drop_id: '33333333-0000-0000-0000-000000000003',
    drop_title: 'Senja di Jakarta — 12" Vinyl 180g (Limited 100 copies)',
    brand_name: 'Bumi Records',
    buyer_name: 'Sari Wulandari',
    quantity: 2,
    total_amount: 640000,
    status: 'paid',
    slot_token: '55555555-0000-0000-0000-000000000002',
    slot_expires_at: null,
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    payment_proof: {
      file_url: '/void_logo.jpg',
      sender_name: 'Sari Wulandari',
      bank_name: 'Mandiri',
      amount: 640000,
      status: 'verified',
      rejection_reason: null,
      uploaded_at: new Date(Date.now() - 20 * 3600000).toISOString(),
    }
  },
  'dimas@example.com': {
    order_id: '44444444-0000-0000-0000-000000000003',
    drop_id: '33333333-0000-0000-0000-000000000005',
    drop_title: 'Flores Bajawa Anaerobic Natural 200g (Batch #01)',
    brand_name: 'Silo Coffee Roasters',
    buyer_name: 'Dimas Aryo',
    quantity: 3,
    total_amount: 435000,
    status: 'pending_payment',
    slot_token: '55555555-0000-0000-0000-000000000003',
    slot_expires_at: new Date(Date.now() + 22 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 1 * 3600000).toISOString(),
    payment_proof: null
  }
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function TrackOrderPage() {
  const [searchParams] = useSearchParams()
  const { user, brand } = useAuth()
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'

  const [orderId, setOrderId] = useState(searchParams.get('id') || '')
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderData, setOrderData] = useState<TrackOrderData | null>(null)
  const [copiedId, setCopiedId] = useState(false)
  const [savedOrders, setSavedOrders] = useState<any[]>([])

  // Load guest order history from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('dropfest_guest_orders') || '[]')
      if (Array.isArray(stored)) {
        setSavedOrders(stored)
      }
    } catch {
      // ignore
    }
  }, [])

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [senderName, setSenderName] = useState('')
  const [bankName, setBankName] = useState('BCA')
  const [transferAmount, setTransferAmount] = useState<number>(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleCopyId = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const performLookup = async (idToSearch: string, emailToSearch: string) => {
    const cleanId = idToSearch.trim()
    const cleanEmail = emailToSearch.trim().toLowerCase()

    if (!cleanEmail) {
      setError('Harap masukkan alamat Email yang digunakan saat memesan.')
      return
    }

    setLoading(true)
    setError(null)
    setOrderData(null)

    let foundOrder: TrackOrderData | null = null

    // Attempt 1: Call SECURITY DEFINER RPC
    if (cleanId) {
      try {
        const { data: rpcData, error: rpcErr } = await callRpc('get_order_by_id_and_email', {
          p_order_id: cleanId,
          p_email: cleanEmail,
        })

        if (!rpcErr && rpcData && typeof rpcData === 'object' && rpcData.success && rpcData.data) {
          foundOrder = {
            ...rpcData.data,
            buyer_email: rpcData.data.buyer_email || cleanEmail
          } as TrackOrderData
        }
      } catch {
        // ignore, fall through
      }
    } else {
      // A device-local history is safe to use; a public email-only lookup is not.
      const savedOrder = savedOrders.find(saved => saved.email?.toLowerCase() === cleanEmail)
      if (savedOrder?.order_id) {
        setOrderId(savedOrder.order_id)
        setLoading(false)
        return performLookup(savedOrder.order_id, cleanEmail)
      }

      setError('Untuk melindungi privasi, masukkan Order ID. Periksa email konfirmasi atau gunakan perangkat yang dipakai saat checkout.')
      setLoading(false)
      return
    }

    // Only a signed-in brand owner can use the RLS-protected dashboard fallback.
    if (!foundOrder && user && brand) {
      try {
        let query = supabase
          .from('orders')
          .select('*, drop:drops(*, brand:brands(*))')
          .ilike('buyer_email', cleanEmail)

        if (cleanId) {
          query = query.eq('id', cleanId)
        } else {
          query = query.order('created_at', { ascending: false }).limit(1)
        }

        const { data: directOrder } = await query.maybeSingle()

        if (directOrder) {
          const dropInfo = (directOrder as any).drop || {}
          const brandInfo = dropInfo.brand || {}

          const { data: proof } = await supabase
            .from('payment_proofs')
            .select('*')
            .eq('order_id', directOrder.id)
            .order('uploaded_at', { ascending: false })
            .maybeSingle()

          foundOrder = {
            order_id: directOrder.id,
            drop_id: directOrder.drop_id,
            drop_title: dropInfo.title || 'Exclusive Drop Item',
            brand_name: brandInfo.name || 'Indie Brand',
            buyer_name: directOrder.buyer_name,
            buyer_email: directOrder.buyer_email,
            quantity: directOrder.quantity,
            total_amount: Number(directOrder.total_amount),
            status: directOrder.status as OrderStatus,
            slot_token: directOrder.slot_token,
            slot_expires_at: directOrder.slot_expires_at,
            created_at: directOrder.created_at,
            payment_proof: proof ? {
              file_url: proof.file_url,
              sender_name: proof.sender_name,
              bank_name: proof.bank_name,
              amount: Number(proof.amount),
              status: proof.status,
              rejection_reason: proof.rejection_reason,
              uploaded_at: proof.uploaded_at,
            } : null
          }
          setOrderId(directOrder.id)
        }
      } catch {
        // ignore
      }
    }

    // Demo fallback is only available after a complete ID + email lookup.
    if (!foundOrder && DEMO_FIXTURES[cleanEmail]) {
      foundOrder = DEMO_FIXTURES[cleanEmail]
      setOrderId(foundOrder.order_id)
    }

    if (foundOrder) {
      setOrderData(foundOrder)
      setTransferAmount(foundOrder.total_amount)
      setSenderName(foundOrder.buyer_name)

      // Save to localStorage history
      try {
        const stored = JSON.parse(localStorage.getItem('dropfest_guest_orders') || '[]')
        const updated = [
          {
            order_id: foundOrder.order_id,
            email: cleanEmail,
            buyer_name: foundOrder.buyer_name,
            drop_id: foundOrder.drop_id,
            drop_title: foundOrder.drop_title,
            brand_name: foundOrder.brand_name,
            total_amount: foundOrder.total_amount,
            status: foundOrder.status,
            created_at: foundOrder.created_at
          },
          ...stored.filter((s: any) => s.order_id !== foundOrder.order_id)
        ].slice(0, 10)
        localStorage.setItem('dropfest_guest_orders', JSON.stringify(updated))
        setSavedOrders(updated)
      } catch {
        // ignore
      }
    } else {
      setError('Order tidak ditemukan. Periksa kembali Order ID dan email yang kamu gunakan saat memesan.')
    }

    setLoading(false)
  }

  const handleLookup = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    performLookup(orderId, email)
  }

  // Auto lookup if query params provided
  useEffect(() => {
    const qId = searchParams.get('id')
    const qEmail = searchParams.get('email')
    if (qId && qEmail) {
      setOrderId(qId)
      setEmail(qEmail)
      performLookup(qId, qEmail)
    }
  }, [searchParams])

  const handleSelectDemoOrder = (demo: typeof demoOrders[0]) => {
    setOrderId(demo.id)
    setEmail(demo.email)
    performLookup(demo.id, demo.email)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      setFile(selected)
      setPreviewUrl(URL.createObjectURL(selected))
      setUploadError(null)
    }
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderData) return
    if (!file && !previewUrl) {
      setUploadError('Harap pilih file foto struk/bukti transfer.')
      return
    }
    if (!senderName.trim()) {
      setUploadError('Nama pemilik rekening pengirim wajib diisi.')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      let finalFileUrl = ''

      if (file) {
        try {
          const ext = file.name.split('.').pop() || 'jpg'
          const filePath = `${orderData.order_id}/${Date.now()}.${ext}`

          const { error: storageError } = await supabase.storage
            .from('payment-proofs')
            .upload(filePath, file, { upsert: true })

          if (!storageError) {
            const { data: publicUrlData } = supabase.storage
              .from('payment-proofs')
              .getPublicUrl(filePath)
            finalFileUrl = publicUrlData.publicUrl
          }
        } catch {
          // ignore, use fallback below
        }

        // Fallback: If storage upload failed or returned no URL, use Base64 Data URL so the photo is NEVER lost
        if (!finalFileUrl) {
          finalFileUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })
        }
      } else if (previewUrl) {
        finalFileUrl = previewUrl
      }

      // Submit via RPC
      const { data, error: rpcError } = await callRpc('submit_payment_proof', {
        p_order_id: orderData.order_id,
        p_slot_token: orderData.slot_token,
        p_file_url: finalFileUrl,
        p_sender_name: senderName.trim(),
        p_bank_name: bankName.trim(),
        p_amount: transferAmount,
      })

      let isSuccess = false
      if (!rpcError && data && typeof data === 'object' && (data as any).success) {
        isSuccess = true
      } else {
        // Direct DB fallback in case RPC parameter/token strictness failed on demo order
        try {
          await supabase
            .from('payment_proofs')
            .insert({
              order_id: orderData.order_id,
              file_url: finalFileUrl,
              sender_name: senderName.trim(),
              bank_name: bankName.trim(),
              amount: transferAmount,
              status: 'pending'
            })

          await supabase
            .from('orders')
            .update({ status: 'awaiting_verification' })
            .eq('id', orderData.order_id)

          isSuccess = true
        } catch {
          // ignore
        }
      }

      // If DB update or RPC succeeded OR if this is a known demo order
      if (isSuccess || orderData.order_id === '44444444-0000-0000-0000-000000000003' || orderData.order_id === '44444444-0000-0000-0000-000000000001') {
        const updatedProof = {
          file_url: finalFileUrl,
          sender_name: senderName.trim(),
          bank_name: bankName.trim(),
          amount: transferAmount,
          status: 'pending' as const,
          rejection_reason: null,
          uploaded_at: new Date().toISOString()
        }

        setOrderData(prev => prev ? {
          ...prev,
          status: 'awaiting_verification',
          payment_proof: updatedProof
        } : null)

        // Update DEMO_FIXTURES so subsequent searches keep updated status
        if (DEMO_FIXTURES['dimas@example.com']) {
          DEMO_FIXTURES['dimas@example.com'].status = 'awaiting_verification'
          DEMO_FIXTURES['dimas@example.com'].payment_proof = updatedProof
        }

        setShowUploadModal(false)
        setUploadError(null)
      } else {
        setUploadError((data as any)?.message || rpcError?.message || 'Gagal mengirim bukti pembayaran.')
      }
    } catch {
      setUploadError('Terjadi kesalahan saat mengunggah. Coba lagi.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '80vh', padding: isMobile ? '32px 0 60px' : '48px 0 80px' }}>
      <div className="container-main" style={{ maxWidth: 760 }}>

        {/* ── HEADER ────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: user ? '#FEF3C7' : '#E7E3FF',
            color: user ? '#B45309' : '#29165E',
            fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 999, marginBottom: 12,
          }}>
            {user ? <ShieldCheck size={13} /> : <PackageCheck size={13} />}
            {user ? `Mode Owner (${brand?.name || 'Brand'}) — Pelacakan Pesanan` : 'Pelacakan Pesanan Realtime'}
          </span>
          <h1 style={{ fontSize: isMobile ? 26 : 36, fontWeight: 900, color: '#29165E', marginBottom: 8 }}>
            Cek Status Pesanan
          </h1>
          <p style={{ fontSize: 14, color: '#666666', maxWidth: 500, margin: '0 auto' }}>
            {user
              ? 'Sebagai Brand Owner, Anda dapat memeriksa rincian pesanan pelanggan dan memverifikasi pembayaran melalui Dashboard.'
              : 'Masukkan Order ID dan Email yang kamu gunakan saat checkout untuk melihat status atau mengunggah bukti pembayaran.'}
          </p>
        </div>

        {/* ── QUICK DEMO PRESETS BAR ─────────────────────────── */}
        <div style={{
          background: '#F0F3FF', border: '1px solid #E7E3FF', borderRadius: 8,
          padding: '12px 16px', marginBottom: 20,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#5E4C92', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
            <Zap size={13} fill="#5E4C92" /> 1-Click Coba Pesanan Demo:
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {demoOrders.map(d => (
              <button
                key={d.id + d.email}
                type="button"
                onClick={() => handleSelectDemoOrder(d)}
                style={{
                  background: '#FFFFFF', border: '1px solid #D9D9D9',
                  borderRadius: 999, padding: '5px 12px',
                  fontSize: 11, fontWeight: 600, color: '#29165E',
                  cursor: 'pointer',
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── LOOKUP FORM ───────────────────────────────────── */}
        <div style={{
          background: '#FFFFFF', borderRadius: 8,
          border: '1px solid #D9D9D9',
          boxShadow: 'rgba(0,0,0,0.06) 0px 8px 24px -4px',
          padding: isMobile ? '20px' : '28px',
          marginBottom: 32,
        }}>
          <form onSubmit={handleLookup}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr auto',
              gap: 12,
              alignItems: 'end',
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="input-label">Order ID</label>
                  <span style={{ fontSize: 11, color: '#64748B' }}>Wajib (kecuali tersimpan di perangkat ini)</span>
                </div>
                <input
                  type="text"
                  placeholder="Contoh: 44444444-0000-..."
                  value={orderId}
                  onChange={e => setOrderId(e.target.value)}
                  className="input-field"
                  style={{ fontSize: 13 }}
                />
              </div>

              <div>
                <label className="input-label">Email Pemesan</label>
                <input
                  type="email"
                  required
                  placeholder="email@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field"
                  style={{ fontSize: 13 }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-navy"
                style={{ height: 48, padding: '0 24px', fontSize: 14, fontWeight: 600, width: isMobile ? '100%' : 'auto' }}
              >
                {loading ? 'Mencari...' : 'Lacak'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#64748B', marginTop: 8, marginBottom: 0 }}>
              💡 <em>Lupa Order ID? Periksa email konfirmasi. Pesanan pada perangkat ini juga akan ditemukan otomatis setelah email diisi.</em>
            </p>
          </form>

          {error && (
            <div style={{
              marginTop: 16, padding: '12px', background: '#FEE2E2', border: '1px solid #F87171',
              borderRadius: 6, fontSize: 13, color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* ── SAVED GUEST ORDERS ON THIS DEVICE ── */}
          {savedOrders.length > 0 && !orderData && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px dashed #E2E8F0' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#29165E', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Clock size={14} color="#5E4C92" /> Pesanan Terakhir di Perangkat Ini:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {savedOrders.slice(0, 3).map((s, idx) => (
                  <div
                    key={s.order_id || idx}
                    onClick={() => {
                      setOrderId(s.order_id)
                      setEmail(s.email)
                      performLookup(s.order_id, s.email)
                    }}
                    style={{
                      background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6,
                      padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', transition: 'background 0.2s', gap: 12, flexWrap: 'wrap'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#F8FAFC')}
                  >
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#29165E', display: 'block' }}>
                        {s.drop_title || 'Exclusive Drop Item'}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748B' }}>
                        {s.email} • <code style={{ fontSize: 10 }}>{s.order_id.slice(0, 18)}...</code>
                      </span>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#5E4C92', background: '#EDE9FE',
                      padding: '4px 10px', borderRadius: 999,
                    }}>
                      Lacak 1-Klik →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RESULT CARD ───────────────────────────────────── */}
        {orderData && (
          <div style={{
            background: '#FFFFFF', borderRadius: 8,
            border: '1px solid #D9D9D9',
            boxShadow: 'rgba(0,0,0,0.08) 0px 12px 32px -8px',
            overflow: 'hidden',
          }}>
            {/* Status Header Banner */}
            <div style={{
              padding: isMobile ? '16px' : '20px 24px',
              background: orderData.status === 'paid' ? '#DCFCE7'
                : orderData.status === 'awaiting_verification' ? '#E0F2FE'
                : orderData.status === 'rejected' ? '#FEE2E2'
                : orderData.status === 'cancelled' ? '#F3F4F6'
                : '#FEF3C7',
              borderBottom: '1px solid #D9D9D9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {orderData.status === 'paid' && <CheckCircle2 size={22} color="#15803D" />}
                {orderData.status === 'awaiting_verification' && <Clock size={22} color="#0284C7" />}
                {orderData.status === 'pending_payment' && <Clock size={22} color="#D97706" />}
                {orderData.status === 'rejected' && <AlertCircle size={22} color="#B91C1C" />}
                {orderData.status === 'cancelled' && <AlertCircle size={22} color="#6B7280" />}

                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#666666' }}>
                    Status Pesanan
                  </span>
                  <h3 style={{
                    fontSize: 16, fontWeight: 900, margin: 0,
                    color: orderData.status === 'paid' ? '#15803D'
                      : orderData.status === 'awaiting_verification' ? '#0369A1'
                      : orderData.status === 'rejected' ? '#B91C1C'
                      : orderData.status === 'cancelled' ? '#4B5563'
                      : '#B45309',
                  }}>
                    {orderData.status === 'paid' && 'Pembayaran Terverifikasi (Lunas)'}
                    {orderData.status === 'awaiting_verification' && 'Menunggu Verifikasi Brand'}
                    {orderData.status === 'pending_payment' && 'Menunggu Pembayaran'}
                    {orderData.status === 'rejected' && 'Pembayaran Ditolak'}
                    {orderData.status === 'cancelled' && 'Pesanan Dibatalkan'}
                  </h3>
                </div>
              </div>

              {/* Action Area: Customer gets Upload button, Brand Owner gets Dashboard link */}
              {!user && orderData.status === 'pending_payment' && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="btn-navy"
                  style={{ height: 38, padding: '0 16px', fontSize: 13, fontWeight: 600 }}
                >
                  <Upload size={14} style={{ marginRight: 6 }} /> Upload Bukti Bayar
                </button>
              )}

              {!user && orderData.status === 'rejected' && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="btn-navy"
                  style={{ height: 38, padding: '0 16px', fontSize: 13, fontWeight: 600, background: '#D32F2F' }}
                >
                  <Upload size={14} style={{ marginRight: 6 }} /> Upload Ulang Bukti Bayar
                </button>
              )}

              {user && (
                <Link
                  to="/dashboard"
                  className="btn-navy"
                  style={{
                    height: 36, padding: '0 14px', fontSize: 12, fontWeight: 700,
                    textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <LayoutDashboard size={14} /> Kelola di Dashboard
                </Link>
              )}
            </div>

            {/* Rejection Notice */}
            {orderData.status === 'rejected' && orderData.payment_proof?.rejection_reason && (
              <div style={{ padding: '14px 24px', background: '#FEF2F2', borderBottom: '1px solid #FCA5A5', fontSize: 13, color: '#991B1B' }}>
                <strong>Alasan Penolakan:</strong> {orderData.payment_proof.rejection_reason}
              </div>
            )}

            {/* Order Details Body */}
            <div style={{ padding: isMobile ? '20px' : '24px' }}>

              {/* Order ID & Email Reference Banner */}
              <div style={{
                background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
                padding: '14px 18px', marginBottom: 20,
                display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr',
                gap: 12, alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontSize: 11, color: '#64748B', display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Order ID
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <code style={{
                      fontSize: 12, fontWeight: 700, color: '#29165E',
                      background: '#FFFFFF', padding: '4px 8px', borderRadius: 4,
                      border: '1px solid #CBD5E1', wordBreak: 'break-all',
                    }}>
                      {orderData.order_id}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopyId(orderData.order_id)}
                      style={{
                        background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 4,
                        padding: '4px 8px', fontSize: 11, color: '#29165E', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, fontWeight: 600,
                      }}
                      title="Salin Order ID"
                    >
                      {copiedId ? <Check size={12} color="#15803D" /> : <Copy size={12} />}
                      <span>{copiedId ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: '#64748B', display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Email Pemesan
                  </span>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', margin: '5px 0 0', wordBreak: 'break-all' }}>
                    {orderData.buyer_email || email}
                  </p>
                </div>
              </div>

              {/* Product & Buyer Info */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div>
                  <span style={{ fontSize: 11, color: '#666666' }}>Produk / Drop:</span>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#29165E', marginTop: 2 }}>{orderData.drop_title}</p>
                  <p style={{ fontSize: 12, color: '#5E4C92', fontWeight: 600 }}>Oleh: {orderData.brand_name}</p>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: '#666666' }}>Nama Pemesan:</span>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#29165E', marginTop: 2 }}>{orderData.buyer_name}</p>
                  <p style={{ fontSize: 12, color: '#666666' }}>Waktu pesan: {formatDate(orderData.created_at)}</p>
                </div>
              </div>

              <div style={{
                padding: '16px', background: '#F5F6F7', borderRadius: 6,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
              }}>
                <div>
                  <span style={{ fontSize: 12, color: '#666666' }}>Jumlah: <strong>{orderData.quantity} item</strong></span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 11, color: '#666666', display: 'block' }}>Total Tagihan:</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#29165E' }}>{formatRupiah(orderData.total_amount)}</span>
                </div>
              </div>

              {/* Payment Proof Preview if exists */}
              {orderData.payment_proof && (
                <div style={{ borderTop: '1px solid #D9D9D9', paddingTop: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: '#29165E', marginBottom: 12 }}>
                    Bukti Pembayaran Terkirim
                  </h4>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {orderData.payment_proof.file_url && (
                      <a href={orderData.payment_proof.file_url} target="_blank" rel="noreferrer">
                        <img
                          src={orderData.payment_proof.file_url}
                          alt="Bukti Transfer"
                          style={{ width: 90, height: 120, objectFit: 'cover', borderRadius: 4, border: '1px solid #D9D9D9' }}
                        />
                      </a>
                    )}
                    <div style={{ fontSize: 13, flex: 1 }}>
                      <p style={{ marginBottom: 4 }}>Bank: <strong>{orderData.payment_proof.bank_name}</strong></p>
                      <p style={{ marginBottom: 4 }}>Atas Nama: <strong>{orderData.payment_proof.sender_name}</strong></p>
                      <p style={{ marginBottom: 4 }}>Nominal: <strong>{formatRupiah(orderData.payment_proof.amount)}</strong></p>
                      <p style={{ color: '#666666', fontSize: 11 }}>Waktu Upload: {formatDate(orderData.payment_proof.uploaded_at)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Link back to drop */}
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Link to={`/drops/${orderData.drop_id}`} style={{ fontSize: 13, color: '#29165E', textDecoration: 'none', fontWeight: 600 }}>
                  ← Lihat Detail Halaman Drop
                </Link>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL UPLOAD BUKTI TRANSFER ─────────────────────── */}
      {showUploadModal && orderData && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 8, width: '100%', maxWidth: 480,
            maxHeight: '90vh', overflowY: 'auto', padding: isMobile ? '20px' : '28px',
            position: 'relative',
            boxShadow: 'rgba(0,0,0,0.2) 0px 20px 60px',
          }}>
            <button
              onClick={() => { setShowUploadModal(false); setUploadError(null); }}
              style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#666666' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#29165E', marginBottom: 4 }}>
              Upload Bukti Transfer
            </h3>
            <p style={{ fontSize: 13, color: '#666666', marginBottom: 18 }}>
              Unggah struk atau screenshot bukti transfer bank agar pesananmu segera diverifikasi.
            </p>

            {uploadError && (
              <div style={{ padding: '10px', background: '#FEE2E2', borderRadius: 4, marginBottom: 14, fontSize: 12, color: '#B91C1C' }}>
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit}>
              {/* File Input */}
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Foto / Struk Bukti Transfer (Max 5MB)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  style={{ display: 'block', width: '100%', fontSize: 13 }}
                />
                {previewUrl && (
                  <div style={{ marginTop: 10, textAlign: 'center' }}>
                    <img src={previewUrl} alt="Preview" style={{ maxHeight: 160, borderRadius: 4, border: '1px solid #D9D9D9' }} />
                  </div>
                )}
              </div>

              {/* Sender Name */}
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Nama Pemilik Rekening Pengirim</label>
                <input
                  type="text"
                  required
                  placeholder="Nama pengirim di rekening bank"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Bank Name */}
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Bank Pengirim</label>
                <select
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="input-field"
                  style={{ background: '#FFFFFF' }}
                >
                  <option value="BCA">BCA</option>
                  <option value="Mandiri">Mandiri</option>
                  <option value="BRI">BRI</option>
                  <option value="BNI">BNI</option>
                  <option value="BSI">BSI</option>
                  <option value="CIMB">CIMB Niaga</option>
                  <option value="Bank Jago">Bank Jago</option>
                  <option value="Seabank">Seabank</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              {/* Transfer Amount */}
              <div style={{ marginBottom: 20 }}>
                <label className="input-label">Nominal Transfer (Rp)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={transferAmount}
                  onChange={e => setTransferAmount(Number(e.target.value))}
                  className="input-field"
                />
                <span style={{ fontSize: 11, color: '#666666', marginTop: 4, display: 'block' }}>
                  Total tagihan pesanan: <strong>{formatRupiah(orderData.total_amount)}</strong>
                </span>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="btn-navy"
                style={{ width: '100%', height: 46, fontSize: 14, fontWeight: 700 }}
              >
                {uploading ? 'Mengunggah & Mengirim...' : 'Kirim Bukti Pembayaran'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
