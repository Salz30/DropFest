import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Clock, ShieldCheck, CreditCard, CheckCircle2,
  Copy, Check, AlertCircle, Zap, User, Mail, Phone, MapPin, X
} from 'lucide-react'
import { supabase, callRpc } from '../lib/supabase'
import type { Drop, Brand, Product } from '../types'
import { useBreakpoint } from '../hooks/useBreakpoint'

interface DropDetailData extends Drop {
  brand: Brand
  product: Product
}

function getComputedStatus(drop: Drop): 'scheduled' | 'live' | 'ended' {
  const now = new Date()
  const starts = new Date(drop.starts_at)
  const ends = drop.ends_at ? new Date(drop.ends_at) : null
  if (drop.status === 'cancelled') return 'ended'
  if (now < starts) return 'scheduled'
  if (ends && now > ends) return 'ended'
  return 'live'
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

export default function DropDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'
  const isTabletDown = bp === 'mobile' || bp === 'tablet'

  const [drop, setDrop] = useState<DropDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Countdown State
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null)

  // Modal State
  const [showPreOrderModal, setShowPreOrderModal] = useState(false)
  const [showWaitlistModal, setShowWaitlistModal] = useState(false)

  // Pre-Order Form State
  const [quantity, setQuantity] = useState(1)
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [orderSuccessData, setOrderSuccessData] = useState<{
    order_id: string
    slot_token: string
    total_amount: number
    slot_expires_at: string
  } | null>(null)
  const [copiedOrderId, setCopiedOrderId] = useState(false)

  // Waitlist Form State
  const [waitlistName, setWaitlistName] = useState('')
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false)
  const [waitlistSuccess, setWaitlistSuccess] = useState(false)
  const [waitlistError, setWaitlistError] = useState<string | null>(null)

  // Fetch Drop Data
  useEffect(() => {
    async function fetchDrop() {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = await supabase
          .from('drops')
          .select('*, brand:brands(*), product:products(*)')
          .eq('id', id)
          .single()

        if (err || !data) {
          setError('Drop tidak ditemukan.')
        } else {
          setDrop(data as DropDetailData)
        }
      } catch {
        setError('Gagal memuat data drop.')
      } finally {
        setLoading(false)
      }
    }
    fetchDrop()
  }, [id])

  // Timer Tick
  useEffect(() => {
    if (!drop) return
    const updateTimer = () => {
      const now = Date.now()
      const targetTime = drop.status === 'scheduled'
        ? new Date(drop.starts_at).getTime()
        : drop.ends_at
          ? new Date(drop.ends_at).getTime()
          : null

      if (!targetTime) {
        setTimeLeft(null)
        return
      }

      const diff = targetTime - now
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      } else {
        setTimeLeft({
          days: Math.floor(diff / 86400000),
          hours: Math.floor((diff % 86400000) / 3600000),
          minutes: Math.floor((diff % 3600000) / 60000),
          seconds: Math.floor((diff % 60000) / 1000),
        })
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [drop])

  if (loading) {
    return (
      <div className="container-main py-16 text-center">
        <div style={{ display: 'inline-block', width: 40, height: 40, border: '3px solid #E7E3FF', borderTopColor: '#29165E', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: 16, color: '#666666', fontSize: 14 }}>Memuat detail drop...</p>
      </div>
    )
  }

  if (error || !drop) {
    return (
      <div className="container-main py-16 text-center">
        <AlertCircle size={44} color="#D32F2F" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#29165E', marginBottom: 8 }}>Drop Tidak Ditemukan</h2>
        <p style={{ color: '#666666', fontSize: 14, marginBottom: 24 }}>{error || 'Halaman yang kamu cari mungkin sudah dihapus atau tidak tersedia.'}</p>
        <Link to="/drops" className="btn-navy" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          Lihat Semua Drops
        </Link>
      </div>
    )
  }

  const computedStatus = getComputedStatus(drop)
  const availableSlots = Math.max(0, drop.total_slots - drop.reserved_count)
  const isSoldOut = drop.reserved_count >= drop.total_slots
  const slotPercentage = Math.min((drop.reserved_count / drop.total_slots) * 100, 100)

  // Pre-Order Submit Handler
  const handlePreOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setOrderError(null)

    if (!buyerName.trim() || !buyerEmail.trim() || !buyerPhone.trim() || !shippingAddress.trim()) {
      setOrderError('Harap lengkapi semua data formulir.')
      return
    }

    setSubmittingOrder(true)
    try {
      const { data, error: rpcError } = await callRpc('create_order', {
        p_drop_id: drop.id,
        p_buyer_name: buyerName,
        p_buyer_email: buyerEmail,
        p_buyer_phone: buyerPhone,
        p_shipping_address: shippingAddress,
        p_quantity: quantity,
      })

      if (rpcError) {
        setOrderError(rpcError.message || 'Terjadi kesalahan saat memproses pesanan.')
      } else if (data && typeof data === 'object') {
        const res = data as any
        if (res.success) {
          setOrderSuccessData({
            order_id: res.order_id,
            slot_token: res.slot_token,
            total_amount: res.total_amount,
            slot_expires_at: res.slot_expires_at,
          })
          // update local reserved count
          setDrop(prev => prev ? { ...prev, reserved_count: prev.reserved_count + quantity } : null)
        } else {
          setOrderError(res.message || 'Gagal membuat pesanan.')
        }
      }
    } catch {
      setOrderError('Koneksi terputus. Silakan coba lagi.')
    } finally {
      setSubmittingOrder(false)
    }
  }

  // Waitlist Submit Handler
  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setWaitlistError(null)

    if (!waitlistName.trim() || !waitlistEmail.trim()) {
      setWaitlistError('Nama dan email wajib diisi.')
      return
    }

    setSubmittingWaitlist(true)
    try {
      const { error: rpcError } = await callRpc('join_waitlist', {
        p_drop_id: drop.id,
        p_name: waitlistName,
        p_email: waitlistEmail,
      })

      if (rpcError) {
        setWaitlistError(rpcError.message)
      } else {
        setWaitlistSuccess(true)
      }
    } catch {
      setWaitlistError('Gagal bergabung ke waitlist.')
    } finally {
      setSubmittingWaitlist(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedOrderId(true)
    setTimeout(() => setCopiedOrderId(false), 3000)
  }

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '80vh', padding: isMobile ? '20px 0 60px' : '32px 0 80px' }}>
      <div className="container-main">

        {/* ── BREADCRUMB & BACK ─────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <Link to="/drops" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666666', textDecoration: 'none' }}>
            <ArrowLeft size={15} /> Kembali ke Katalog Drops
          </Link>
        </div>

        {/* ── MAIN CONTENT GRID ─────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isTabletDown ? '1fr' : '1.1fr 0.9fr',
          gap: isMobile ? 28 : 48,
          alignItems: 'start',
        }}>

          {/* Left Column: Visual & Product Details */}
          <div>
            {/* Banner Image */}
            <div style={{
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid #D9D9D9',
              background: drop.banner_url ? `url(${drop.banner_url}) center/cover` : 'linear-gradient(135deg, #29165E, #5E4C92)',
              height: isMobile ? 240 : 400,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {!drop.banner_url && (
                <Zap size={64} color="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.2)" />
              )}
              {isSoldOut && computedStatus === 'live' && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 900, letterSpacing: '3px' }}>SOLD OUT</span>
                </div>
              )}
            </div>

            {/* Product Story / Description */}
            <div style={{ marginTop: 28 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#29165E', marginBottom: 12 }}>Tentang Rilis Ini</h2>
              <p style={{ fontSize: 14, color: '#3D464D', lineHeight: '24px', whiteSpace: 'pre-line' }}>
                {drop.description || drop.product?.description || 'Tidak ada deskripsi rilis.'}
              </p>
            </div>

            {/* Brand Info Card */}
            <div style={{
              marginTop: 28, padding: '20px', borderRadius: 6,
              background: '#F5F6F7', border: '1px solid #D9D9D9',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 8, background: '#0F0926',
                color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 900, overflow: 'hidden', border: '1px solid #E2E8F0', flexShrink: 0,
              }}>
                {drop.brand?.logo_url || (drop.brand?.slug === 'void-division' ? '/void_logo.jpg' : null) ? (
                  <img
                    src={drop.brand.logo_url || (drop.brand.slug === 'void-division' ? '/void_logo.jpg' : '')}
                    alt={drop.brand.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  drop.brand?.name?.charAt(0) || 'B'
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: '#29165E', marginBottom: 2 }}>{drop.brand?.name}</h4>
                <p style={{ fontSize: 12, color: '#666666' }}>{drop.brand?.instagram || 'Brand Indie Terverifikasi'}</p>
              </div>
              <Link to={drop.brand?.slug ? `/brands/${drop.brand.slug}` : '/brands'} style={{ fontSize: 12, color: '#29165E', fontWeight: 600, textDecoration: 'none' }}>
                Profil Brand →
              </Link>
            </div>
          </div>

          {/* Right Column: Pre-Order Action & Status */}
          <div>
            <div style={{
              background: '#FFFFFF', borderRadius: 8,
              border: '1px solid #D9D9D9',
              boxShadow: 'rgba(0,0,0,0.08) 0px 12px 36px -8px',
              padding: isMobile ? '20px' : '32px',
            }}>

              {/* Status Badge & Brand */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#5E4C92', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {drop.brand?.name}
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: computedStatus === 'live' ? '#DCFCE7' : computedStatus === 'scheduled' ? '#E7E3FF' : '#F3F4F6',
                  color: computedStatus === 'live' ? '#15803D' : computedStatus === 'scheduled' ? '#5E4C92' : '#6B7280',
                  fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: computedStatus === 'live' ? '#22C55E' : '#5E4C92', display: 'inline-block' }} />
                  {computedStatus === 'live' ? 'SEDANG LIVE' : computedStatus === 'scheduled' ? 'SEGERA HADIR' : 'DROP BERAKHIR'}
                </span>
              </div>

              {/* Title */}
              <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, color: '#29165E', marginBottom: 16, lineHeight: '32px' }}>
                {drop.title}
              </h1>

              {/* Price */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: '#666666', marginBottom: 4 }}>Harga Pre-Order</p>
                <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 900, color: '#29165E' }}>
                  {formatRupiah(drop.price)}
                </div>
              </div>

              {/* Countdown Timer Block */}
              {timeLeft && computedStatus !== 'ended' && (
                <div style={{
                  marginBottom: 24, padding: '16px', borderRadius: 6,
                  background: '#F0F3FF', border: '1px solid #E7E3FF',
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#5E4C92', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={13} /> {computedStatus === 'live' ? 'Batas Waktu Drop Berakhir:' : 'Drop Dibuka Dalam:'}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
                    {[
                      { val: timeLeft.days, unit: 'Hari' },
                      { val: timeLeft.hours, unit: 'Jam' },
                      { val: timeLeft.minutes, unit: 'Menit' },
                      { val: timeLeft.seconds, unit: 'Detik' },
                    ].map(t => (
                      <div key={t.unit} style={{ background: '#FFFFFF', padding: '8px 4px', borderRadius: 4, border: '1px solid #E7E3FF' }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#29165E' }}>{String(t.val).padStart(2, '0')}</div>
                        <div style={{ fontSize: 10, color: '#666666', marginTop: 2 }}>{t.unit}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Slot Availability Progress */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#3D464D' }}>Ketersediaan Kuota</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isSoldOut ? '#D32F2F' : '#29165E' }}>
                    {availableSlots} dari {drop.total_slots} slot tersisa
                  </span>
                </div>
                <div style={{ height: 8, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${slotPercentage}%`,
                    background: slotPercentage >= 90 ? '#D32F2F' : slotPercentage >= 60 ? '#B45309' : '#15803D',
                    borderRadius: 999,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>

              {/* Action Buttons based on Status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {computedStatus === 'live' && !isSoldOut && (
                  <button
                    onClick={() => setShowPreOrderModal(true)}
                    className="btn-navy"
                    style={{ width: '100%', height: 50, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}
                  >
                    ⚡ Pre-Order Sekarang (Kunci Slot)
                  </button>
                )}

                {computedStatus === 'live' && isSoldOut && (
                  <button
                    onClick={() => setShowWaitlistModal(true)}
                    className="btn-primary"
                    style={{ width: '100%', height: 50, fontSize: 14, fontWeight: 600, background: '#F5F6F7', color: '#29165E' }}
                  >
                    📝 Masuk Daftar Tunggu (Waitlist)
                  </button>
                )}

                {computedStatus === 'scheduled' && (
                  <button
                    onClick={() => setShowWaitlistModal(true)}
                    className="btn-navy"
                    style={{ width: '100%', height: 50, fontSize: 15, fontWeight: 700 }}
                  >
                    🔔 Ingatkan Saya (Gabung Waitlist)
                  </button>
                )}

                {computedStatus === 'ended' && (
                  <div style={{ textAlign: 'center', padding: '16px', background: '#F5F6F7', borderRadius: 6, color: '#666666', fontSize: 13 }}>
                    Drop ini telah berakhir. Nantikan drop selanjutnya dari {drop.brand?.name}!
                  </div>
                )}
              </div>

              {/* Guarantees / Safety list */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #F5F6F7', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666666' }}>
                  <ShieldCheck size={16} color="#15803D" /> Slot otomatis terkunci 24 jam setelah order dibuat
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666666' }}>
                  <CreditCard size={16} color="#29165E" /> Verifikasi pembayaran manual langsung oleh brand
                </div>
              </div>

            </div>

            {/* Payment Destination Information */}
            {(drop.bank_name || drop.account_number) && (
              <div style={{
                marginTop: 20, padding: '20px', borderRadius: 8,
                background: '#FFFFFF', border: '1px solid #D9D9D9',
              }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#29165E', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CreditCard size={15} /> Rekening Tujuan Transfer
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#666666', display: 'block' }}>Bank:</span>
                    <strong style={{ color: '#29165E' }}>{drop.bank_name || '-'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#666666', display: 'block' }}>No. Rekening:</span>
                    <strong style={{ color: '#29165E' }}>{drop.account_number || '-'}</strong>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: 11, color: '#666666', display: 'block' }}>Atas Nama:</span>
                    <strong style={{ color: '#29165E' }}>{drop.account_holder || drop.brand?.name}</strong>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* ── MODAL PRE-ORDER ─────────────────────────────────── */}
      {showPreOrderModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 8, width: '100%', maxWidth: 520,
            maxHeight: '90vh', overflowY: 'auto', padding: isMobile ? '20px' : '28px',
            position: 'relative',
            boxShadow: 'rgba(0,0,0,0.2) 0px 20px 60px',
          }}>
            {/* Close Button */}
            <button
              onClick={() => { setShowPreOrderModal(false); setOrderSuccessData(null); setOrderError(null); }}
              style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#666666' }}
            >
              <X size={20} />
            </button>

            {orderSuccessData ? (
              /* Success State */
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <CheckCircle2 size={32} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#29165E', marginBottom: 8 }}>
                  Slot Berhasil Dikunci! 🎉
                </h3>
                <p style={{ fontSize: 14, color: '#666666', marginBottom: 20 }}>
                  Pesananmu telah tercatat. Silakan lakukan pembayaran dan simpan Order ID kamu untuk pelacakan.
                </p>

                {/* Order ID Copy Box */}
                <div style={{
                  background: '#F0F3FF', border: '1px solid #E7E3FF', borderRadius: 6,
                  padding: '16px', marginBottom: 20, textAlign: 'left',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#5E4C92', textTransform: 'uppercase' }}>Order ID Anda:</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <code style={{ fontSize: 13, fontWeight: 700, color: '#29165E', wordBreak: 'break-all' }}>
                      {orderSuccessData.order_id}
                    </code>
                    <button
                      onClick={() => copyToClipboard(orderSuccessData.order_id)}
                      style={{
                        marginLeft: 8, padding: '6px 12px', borderRadius: 4,
                        background: copiedOrderId ? '#22C55E' : '#29165E', color: '#FFFFFF',
                        border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                      }}
                    >
                      {copiedOrderId ? <Check size={13} /> : <Copy size={13} />} {copiedOrderId ? 'Tersalin' : 'Salin'}
                    </button>
                  </div>
                </div>

                <div style={{
                  padding: '12px', background: '#FFFBEB', border: '1px solid #FDE68A',
                  borderRadius: 6, marginBottom: 24, textAlign: 'left', fontSize: 12, color: '#92400E',
                }}>
                  ⚠️ <strong>Penting:</strong> Slot kamu hanya berlaku selama 24 jam. Jika bukti bayar tidak diupload sebelum batas waktu, slot akan otomatis dilepas kembali ke publik.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={() => {
                      setShowPreOrderModal(false)
                      navigate(`/track-order?id=${orderSuccessData.order_id}&email=${encodeURIComponent(buyerEmail)}`)
                    }}
                    className="btn-navy"
                    style={{ width: '100%', height: 46, fontSize: 14, fontWeight: 600 }}
                  >
                    Upload Bukti Transfer Sekarang →
                  </button>
                  <button
                    onClick={() => { setShowPreOrderModal(false); setOrderSuccessData(null); }}
                    className="btn-ghost"
                    style={{ height: 40, fontSize: 13 }}
                  >
                    Tutup & Lanjutkan Menjelajah
                  </button>
                </div>
              </div>
            ) : (
              /* Order Form */
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#29165E', marginBottom: 4 }}>
                  Formulir Pre-Order
                </h3>
                <p style={{ fontSize: 13, color: '#666666', marginBottom: 20 }}>
                  Kunci slot pesananmu sekarang. Tanpa perlu registrasi akun.
                </p>

                {orderError && (
                  <div style={{
                    padding: '12px', background: '#FEE2E2', border: '1px solid #F87171',
                    borderRadius: 6, marginBottom: 16, fontSize: 13, color: '#B91C1C',
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{orderError}</span>
                  </div>
                )}

                <form onSubmit={handlePreOrderSubmit}>
                  {/* Quantity Selector */}
                  <div style={{ marginBottom: 16 }}>
                    <label className="input-label">Jumlah Item (Maks. 5)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        style={{ width: 36, height: 36, borderRadius: 4, border: '1px solid #D9D9D9', background: '#F5F6F7', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#29165E', minWidth: 24, textAlign: 'center' }}>
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.min(5, Math.min(availableSlots, quantity + 1)))}
                        style={{ width: 36, height: 36, borderRadius: 4, border: '1px solid #D9D9D9', background: '#F5F6F7', cursor: 'pointer', fontSize: 16, fontWeight: 700 }}
                      >
                        +
                      </button>
                      <span style={{ fontSize: 13, color: '#666666', marginLeft: 'auto' }}>
                        Total: <strong>{formatRupiah(drop.price * quantity)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Buyer Name */}
                  <div style={{ marginBottom: 14 }}>
                    <label className="input-label">Nama Lengkap</label>
                    <div style={{ position: 'relative' }}>
                      <User size={15} color="#75797C" style={{ position: 'absolute', left: 10, top: 14 }} />
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Budi Santoso"
                        value={buyerName}
                        onChange={e => setBuyerName(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: 34 }}
                      />
                    </div>
                  </div>

                  {/* Buyer Email */}
                  <div style={{ marginBottom: 14 }}>
                    <label className="input-label">Email (Untuk Konfirmasi & Cek Pesanan)</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={15} color="#75797C" style={{ position: 'absolute', left: 10, top: 14 }} />
                      <input
                        type="email"
                        required
                        placeholder="budi@example.com"
                        value={buyerEmail}
                        onChange={e => setBuyerEmail(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: 34 }}
                      />
                    </div>
                  </div>

                  {/* Buyer Phone */}
                  <div style={{ marginBottom: 14 }}>
                    <label className="input-label">Nomor WhatsApp / HP</label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={15} color="#75797C" style={{ position: 'absolute', left: 10, top: 14 }} />
                      <input
                        type="tel"
                        required
                        placeholder="081234567890"
                        value={buyerPhone}
                        onChange={e => setBuyerPhone(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: 34 }}
                      />
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div style={{ marginBottom: 20 }}>
                    <label className="input-label">Alamat Pengiriman Lengkap</label>
                    <div style={{ position: 'relative' }}>
                      <MapPin size={15} color="#75797C" style={{ position: 'absolute', left: 10, top: 12 }} />
                      <textarea
                        required
                        rows={3}
                        placeholder="Jl. Mawar No. 12, RT 01/RW 02, Kel. Menteng, Jakarta Pusat, 10310"
                        value={shippingAddress}
                        onChange={e => setShippingAddress(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: 34, resize: 'none' }}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submittingOrder}
                    className="btn-navy"
                    style={{ width: '100%', height: 48, fontSize: 14, fontWeight: 700 }}
                  >
                    {submittingOrder ? 'Memproses & Mengunci Slot...' : `Kunci ${quantity} Slot Sekarang (${formatRupiah(drop.price * quantity)})`}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── MODAL WAITLIST ──────────────────────────────────── */}
      {showWaitlistModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 8, width: '100%', maxWidth: 440,
            padding: isMobile ? '20px' : '28px', position: 'relative',
            boxShadow: 'rgba(0,0,0,0.2) 0px 20px 60px',
          }}>
            <button
              onClick={() => { setShowWaitlistModal(false); setWaitlistSuccess(false); setWaitlistError(null); }}
              style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#666666' }}
            >
              <X size={20} />
            </button>

            {waitlistSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Check size={24} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#29165E', marginBottom: 6 }}>
                  Berhasil Masuk Waitlist! 🎉
                </h3>
                <p style={{ fontSize: 13, color: '#666666', marginBottom: 20 }}>
                  Kami akan mengirimkan notifikasi ke <strong>{waitlistEmail}</strong> segera setelah slot dibuka atau ada slot rilis ulang.
                </p>
                <button
                  onClick={() => { setShowWaitlistModal(false); setWaitlistSuccess(false); }}
                  className="btn-navy"
                  style={{ width: '100%', height: 44, fontSize: 14 }}
                >
                  Selesai
                </button>
              </div>
            ) : (
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#29165E', marginBottom: 4 }}>
                  Daftar Antrean (Waitlist)
                </h3>
                <p style={{ fontSize: 13, color: '#666666', marginBottom: 18 }}>
                  Dapatkan notifikasi tercepat saat drop ini dibuka atau saat ada slot yang dilepas kembali.
                </p>

                {waitlistError && (
                  <div style={{ padding: '10px', background: '#FEE2E2', borderRadius: 4, marginBottom: 14, fontSize: 12, color: '#B91C1C' }}>
                    {waitlistError}
                  </div>
                )}

                <form onSubmit={handleWaitlistSubmit}>
                  <div style={{ marginBottom: 14 }}>
                    <label className="input-label">Nama</label>
                    <input
                      type="text"
                      required
                      placeholder="Nama kamu"
                      value={waitlistName}
                      onChange={e => setWaitlistName(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label className="input-label">Email</label>
                    <input
                      type="email"
                      required
                      placeholder="emailkamu@example.com"
                      value={waitlistEmail}
                      onChange={e => setWaitlistEmail(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingWaitlist}
                    className="btn-navy"
                    style={{ width: '100%', height: 44, fontSize: 14, fontWeight: 700 }}
                  >
                    {submittingWaitlist ? 'Mendaftarkan...' : 'Gabung Waitlist'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
