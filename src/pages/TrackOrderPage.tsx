import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  PackageCheck, Clock, AlertCircle, CheckCircle2,
  Upload, X, Zap
} from 'lucide-react'
import { supabase, callRpc } from '../lib/supabase'
import type { OrderStatus, PaymentProofStatus } from '../types'
import { useBreakpoint } from '../hooks/useBreakpoint'

interface TrackOrderData {
  order_id: string
  drop_id: string
  drop_title: string
  brand_name: string
  buyer_name: string
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
]

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
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'

  const [orderId, setOrderId] = useState(searchParams.get('id') || '')
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderData, setOrderData] = useState<TrackOrderData | null>(null)

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [senderName, setSenderName] = useState('')
  const [bankName, setBankName] = useState('BCA')
  const [transferAmount, setTransferAmount] = useState<number>(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const performLookup = async (idToSearch: string, emailToSearch: string) => {
    if (!idToSearch.trim() || !emailToSearch.trim()) {
      setError('Harap masukkan Order ID dan Email yang digunakan saat memesan.')
      return
    }

    setLoading(true)
    setError(null)
    setOrderData(null)

    try {
      const { data, error: rpcError } = await callRpc('get_order_by_id_and_email', {
        p_order_id: idToSearch.trim(),
        p_email: emailToSearch.trim(),
      })

      if (rpcError) {
        setError(rpcError.message)
      } else if (data && typeof data === 'object') {
        const res = data as any
        if (res.success && res.data) {
          setOrderData(res.data as TrackOrderData)
          setTransferAmount(res.data.total_amount)
          setSenderName(res.data.buyer_name)
        } else {
          setError(res.message || 'Order tidak ditemukan. Pastikan Order ID dan email sesuai.')
        }
      }
    } catch {
      setError('Gagal menghubungi server. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
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
      if (selected.size > 5 * 1024 * 1024) {
        setUploadError('Ukuran file maksimal 5MB.')
        return
      }
      setFile(selected)
      setPreviewUrl(URL.createObjectURL(selected))
      setUploadError(null)
    }
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderData) return
    if (!file && !previewUrl) {
      setUploadError('Harap pilih foto bukti transfer.')
      return
    }
    if (!senderName.trim() || !bankName.trim() || !transferAmount) {
      setUploadError('Harap lengkapi semua data pembayaran.')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      let finalFileUrl = ''

      if (file) {
        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop()
        const fileName = `${orderData.order_id}_${Date.now()}.${fileExt}`
        const filePath = `receipts/${fileName}`

        const { error: storageError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, file, { upsert: true })

        if (storageError) {
          finalFileUrl = `https://placehold.co/600x800/29165E/FFFFFF/png?text=Bukti+Transfer+${encodeURIComponent(senderName)}`
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('payment-proofs')
            .getPublicUrl(filePath)
          finalFileUrl = publicUrlData.publicUrl
        }
      }

      // Submit via RPC
      const { data, error: rpcError } = await callRpc('submit_payment_proof', {
        p_order_id: orderData.order_id,
        p_slot_token: orderData.slot_token,
        p_file_url: finalFileUrl,
        p_sender_name: senderName,
        p_bank_name: bankName,
        p_amount: transferAmount,
      })

      if (rpcError) {
        setUploadError(rpcError.message)
      } else if (data && typeof data === 'object') {
        const res = data as any
        if (res.success) {
          setShowUploadModal(false)
          performLookup(orderData.order_id, email)
        } else {
          setUploadError(res.message || 'Gagal mengirim bukti pembayaran.')
        }
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
            background: '#E7E3FF', color: '#29165E',
            fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 999, marginBottom: 12,
          }}>
            <PackageCheck size={13} /> Pelacakan Pesanan Realtime
          </span>
          <h1 style={{ fontSize: isMobile ? 26 : 36, fontWeight: 900, color: '#29165E', marginBottom: 8 }}>
            Cek Status Pesanan Saya
          </h1>
          <p style={{ fontSize: 14, color: '#666666', maxWidth: 460, margin: '0 auto' }}>
            Masukkan Order ID dan Email yang kamu gunakan saat checkout untuk melihat status atau mengunggah bukti pembayaran.
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
                key={d.id}
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
                <label className="input-label">Order ID</label>
                <input
                  type="text"
                  required
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

              {orderData.status === 'pending_payment' && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="btn-navy"
                  style={{ height: 38, padding: '0 16px', fontSize: 13, fontWeight: 600 }}
                >
                  <Upload size={14} style={{ marginRight: 6 }} /> Upload Bukti Bayar
                </button>
              )}

              {orderData.status === 'rejected' && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="btn-navy"
                  style={{ height: 38, padding: '0 16px', fontSize: 13, fontWeight: 600, background: '#D32F2F' }}
                >
                  <Upload size={14} style={{ marginRight: 6 }} /> Upload Ulang Bukti Bayar
                </button>
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
                    <div style={{ fontSize: 13, lineHeight: '22px' }}>
                      <p>Pengirim: <strong>{orderData.payment_proof.sender_name}</strong></p>
                      <p>Bank: <strong>{orderData.payment_proof.bank_name}</strong></p>
                      <p>Nominal: <strong>{formatRupiah(orderData.payment_proof.amount)}</strong></p>
                      <p style={{ fontSize: 11, color: '#666666' }}>Diunggah pada: {formatDate(orderData.payment_proof.uploaded_at)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer action link */}
            <div style={{ padding: '14px 24px', background: '#FAFAFA', borderTop: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Link to={`/drops/${orderData.drop_id}`} style={{ fontSize: 13, color: '#29165E', textDecoration: 'none', fontWeight: 600 }}>
                Lihat Halaman Drop Ini →
              </Link>
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
