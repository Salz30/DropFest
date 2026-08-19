import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CheckSquare, Package,
  LogOut, Zap, Clock, CheckCircle2, XCircle,
  Search, Download, X, ChevronRight, RefreshCw
} from 'lucide-react'
import { supabase, callRpc } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Drop, Order, PaymentProof, OrderStatus } from '../types'
import { useBreakpoint } from '../hooks/useBreakpoint'

interface EnrichedOrder extends Order {
  drop?: Drop
  payment_proof?: PaymentProof | null
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, { bg: string; color: string; label: string }> = {
    paid: { bg: '#DCFCE7', color: '#15803D', label: 'Lunas (Verified)' },
    awaiting_verification: { bg: '#E0F2FE', color: '#0369A1', label: 'Menunggu Verifikasi' },
    pending_payment: { bg: '#FEF3C7', color: '#B45309', label: 'Belum Bayar' },
    rejected: { bg: '#FEE2E2', color: '#B91C1C', label: 'Ditolak' },
    cancelled: { bg: '#F3F4F6', color: '#4B5563', label: 'Dibatalkan' },
  }
  const s = styles[status] || styles.pending_payment
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700,
      padding: '3px 8px', borderRadius: 999,
    }}>
      {s.label}
    </span>
  )
}

export default function DashboardPage() {
  const { brand, user, isDemoMode, signOut } = useAuth()
  const navigate = useNavigate()
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'

  const [activeTab, setActiveTab] = useState<'overview' | 'verifications' | 'orders' | 'drops'>('overview')
  const [drops, setDrops] = useState<Drop[]>([])
  const [orders, setOrders] = useState<EnrichedOrder[]>([])
  const [refreshing, setRefreshing] = useState(false)

  // Orders Filter
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all')

  // Verification Modal State
  const [selectedProofOrder, setSelectedProofOrder] = useState<EnrichedOrder | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processingVerify, setProcessingVerify] = useState(false)
  const [verifyMessage, setVerifyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchDashboardData = async () => {
    if (!brand) return
    setRefreshing(true)
    try {
      // 1. Fetch Drops of this brand
      const { data: dropsData } = await supabase
        .from('drops')
        .select('*')
        .eq('brand_id', brand.id)
        .order('created_at', { ascending: false })

      const brandDrops = (dropsData || []) as Drop[]
      setDrops(brandDrops)

      // 2. Fetch Orders for this brand
      // Try RPC get_brand_orders_for_dashboard first (works seamlessly for demo & direct access)
      const { data: rpcRes } = await callRpc('get_brand_orders_for_dashboard', {
        p_brand_id: brand.id,
      })

      if (rpcRes && typeof rpcRes === 'object' && (rpcRes as any).orders) {
        setOrders((rpcRes as any).orders as EnrichedOrder[])
      } else if (brandDrops.length > 0) {
        // Fallback: direct select if RPC not yet created
        const dropIds = brandDrops.map(d => d.id)
        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .in('drop_id', dropIds)
          .order('created_at', { ascending: false })

        const rawOrders = (ordersData || []) as Order[]
        const orderIds = rawOrders.map(o => o.id)
        let proofsMap: Record<string, PaymentProof> = {}
        if (orderIds.length > 0) {
          const { data: proofsData } = await supabase
            .from('payment_proofs')
            .select('*')
            .in('order_id', orderIds)

          if (proofsData) {
            (proofsData as PaymentProof[]).forEach(p => {
              proofsMap[p.order_id] = p
            })
          }
        }

        const enriched: EnrichedOrder[] = rawOrders.map(o => ({
          ...o,
          drop: brandDrops.find(d => d.id === o.drop_id),
          payment_proof: proofsMap[o.id] || null,
        }))

        setOrders(enriched)
      } else {
        setOrders([])
      }
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [brand])

  const handleLogout = async () => {
    await signOut()
    navigate('/auth')
  }

  // Verification Actions
  const handleVerify = async (orderId: string) => {
    setProcessingVerify(true)
    setVerifyMessage(null)
    try {
      // Try demo_verify_payment first, or standard verify_payment
      const rpcName = isDemoMode ? 'demo_verify_payment' : 'verify_payment'
      const { data, error } = await callRpc(rpcName, {
        p_order_id: orderId,
        p_action: 'verify',
      })

      if (error) {
        // Fallback to demo_verify_payment if regular RLS rejected
        const { error: fallbackError } = await callRpc('demo_verify_payment', {
          p_order_id: orderId,
          p_action: 'verify',
        })
        if (fallbackError) {
          setVerifyMessage({ type: 'error', text: error.message })
        } else {
          setVerifyMessage({ type: 'success', text: 'Pembayaran berhasil diverifikasi!' })
          setSelectedProofOrder(null)
          fetchDashboardData()
        }
      } else {
        const res = data as any
        if (res.success) {
          setVerifyMessage({ type: 'success', text: 'Pembayaran berhasil diverifikasi!' })
          setSelectedProofOrder(null)
          fetchDashboardData()
        } else {
          setVerifyMessage({ type: 'error', text: res.message })
        }
      }
    } catch {
      setVerifyMessage({ type: 'error', text: 'Gagal memverifikasi pembayaran.' })
    } finally {
      setProcessingVerify(false)
    }
  }

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProofOrder) return
    if (!rejectReason.trim()) {
      setVerifyMessage({ type: 'error', text: 'Harap isi alasan penolakan pembayaran.' })
      return
    }

    setProcessingVerify(true)
    setVerifyMessage(null)
    try {
      const rpcName = isDemoMode ? 'demo_verify_payment' : 'verify_payment'
      const { data, error } = await callRpc(rpcName, {
        p_order_id: selectedProofOrder.id,
        p_action: 'reject',
        p_rejection_reason: rejectReason.trim(),
      })

      if (error) {
        const { error: fallbackError } = await callRpc('demo_verify_payment', {
          p_order_id: selectedProofOrder.id,
          p_action: 'reject',
          p_rejection_reason: rejectReason.trim(),
        })
        if (fallbackError) {
          setVerifyMessage({ type: 'error', text: error.message })
        } else {
          setShowRejectModal(false)
          setSelectedProofOrder(null)
          setRejectReason('')
          setVerifyMessage({ type: 'success', text: 'Pembayaran berhasil ditolak.' })
          fetchDashboardData()
        }
      } else {
        const res = data as any
        if (res.success) {
          setShowRejectModal(false)
          setSelectedProofOrder(null)
          setRejectReason('')
          setVerifyMessage({ type: 'success', text: 'Pembayaran berhasil ditolak.' })
          fetchDashboardData()
        } else {
          setVerifyMessage({ type: 'error', text: res.message })
        }
      }
    } catch {
      setVerifyMessage({ type: 'error', text: 'Gagal menolak pembayaran.' })
    } finally {
      setProcessingVerify(false)
    }
  }

  // Export CSV Function (Fitur 4.4)
  const exportToCSV = () => {
    if (orders.length === 0) return

    const headers = [
      'Order ID', 'Waktu Pemesanan', 'Status', 'Nama Drop',
      'Nama Pembeli', 'Email Pembeli', 'No WhatsApp',
      'Alamat Pengiriman', 'Jumlah Item', 'Total Tagihan (Rp)',
      'Nama Pengirim Bank', 'Bank', 'Status Bukti Bayar'
    ]

    const rows = orders.map(o => [
      `"${o.id}"`,
      `"${o.created_at}"`,
      `"${o.status}"`,
      `"${o.drop?.title || ''}"`,
      `"${o.buyer_name.replace(/"/g, '""')}"`,
      `"${o.buyer_email}"`,
      `"${o.buyer_phone}"`,
      `"${o.shipping_address.replace(/"/g, '""')}"`,
      o.quantity,
      o.total_amount,
      `"${o.payment_proof?.sender_name || '-'}"`,
      `"${o.payment_proof?.bank_name || '-'}"`,
      `"${o.payment_proof?.status || 'belum upload'}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `orders_${brand?.slug || 'brand'}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Computed Metrics
  const pendingVerifications = orders.filter(o => o.status === 'awaiting_verification')
  const totalRevenue = orders.filter(o => o.status === 'paid').reduce((acc, curr) => acc + Number(curr.total_amount), 0)
  const totalSlotsReserved = drops.reduce((acc, curr) => acc + curr.reserved_count, 0)
  const totalSlotsAvailable = drops.reduce((acc, curr) => acc + curr.total_slots, 0)

  // Filtered Orders
  const filteredOrders = orders.filter(o => {
    if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase()
      const matchId = o.id.toLowerCase().includes(q)
      const matchName = o.buyer_name.toLowerCase().includes(q)
      const matchEmail = o.buyer_email.toLowerCase().includes(q)
      const matchDrop = o.drop?.title?.toLowerCase().includes(q)
      if (!matchId && !matchName && !matchEmail && !matchDrop) return false
    }
    return true
  })

  return (
    <div style={{ backgroundColor: '#F5F6F7', minHeight: '90vh', padding: isMobile ? '20px 0 60px' : '32px 0 80px' }}>
      <div className="container-main">

        {/* ── TOP BAR: BRAND PROFILE & LOGOUT ────────────────── */}
        <div style={{
          background: '#FFFFFF', borderRadius: 8,
          border: '1px solid #D9D9D9',
          boxShadow: 'rgba(0,0,0,0.04) 0px 4px 16px',
          padding: isMobile ? '16px' : '20px 28px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 8, background: '#29165E',
              color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 900,
            }}>
              {brand?.name.charAt(0) || 'B'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: 18, fontWeight: 900, color: '#29165E', margin: 0 }}>
                  {brand?.name || 'Dashboard Brand'}
                </h1>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: isDemoMode ? '#FEF3C7' : '#E7E3FF',
                  color: isDemoMode ? '#B45309' : '#29165E',
                  padding: '2px 8px', borderRadius: 999
                }}>
                  {isDemoMode ? '👑 DEMO OWNER' : 'OWNER'}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>
                {user?.email} • {brand?.instagram || `@${brand?.slug}`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={fetchDashboardData}
              disabled={refreshing}
              style={{
                background: '#F5F6F7', border: '1px solid #D9D9D9', borderRadius: 6,
                padding: '8px 12px', fontSize: 12, color: '#3D464D', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>

            <button
              onClick={handleLogout}
              style={{
                background: '#FFFFFF', border: '1px solid #D9D9D9', borderRadius: 6,
                padding: '8px 14px', fontSize: 12, color: '#D32F2F', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600,
              }}
            >
              <LogOut size={13} /> Keluar
            </button>
          </div>
        </div>

        {/* ── NOTIFICATION TOAST ─────────────────────────────── */}
        {verifyMessage && (
          <div style={{
            padding: '12px 16px', borderRadius: 6, marginBottom: 20, fontSize: 13,
            background: verifyMessage.type === 'success' ? '#DCFCE7' : '#FEE2E2',
            border: verifyMessage.type === 'success' ? '1px solid #86EFAC' : '1px solid #F87171',
            color: verifyMessage.type === 'success' ? '#15803D' : '#B91C1C',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{verifyMessage.text}</span>
            <button onClick={() => setVerifyMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
              <X size={15} />
            </button>
          </div>
        )}

        {/* ── NAVIGATION TABS ────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 24,
        }}>
          {[
            { id: 'overview', label: 'Ringkasan & Metrik', icon: LayoutDashboard, badge: null },
            { id: 'verifications', label: 'Verifikasi Pembayaran', icon: CheckSquare, badge: pendingVerifications.length },
            { id: 'orders', label: 'Rekap Pesanan & Ekspedisi', icon: Package, badge: orders.length },
            { id: 'drops', label: 'Daftar Rilisan Drop', icon: Zap, badge: drops.length },
          ].map(tab => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', borderRadius: 6,
                  border: active ? '1px solid #29165E' : '1px solid #D9D9D9',
                  background: active ? '#29165E' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#3D464D',
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <tab.icon size={15} />
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && (
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
                    background: active ? '#FFFFFF' : tab.id === 'verifications' && tab.badge > 0 ? '#D32F2F' : '#E7E3FF',
                    color: active ? '#29165E' : tab.id === 'verifications' && tab.badge > 0 ? '#FFFFFF' : '#29165E',
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── TAB 1: OVERVIEW ────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div>
            {/* Metric Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: 16, marginBottom: 28,
            }}>
              <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: 8, border: '1px solid #D9D9D9' }}>
                <span style={{ fontSize: 12, color: '#666666' }}>Total Omzet Lunas</span>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, color: '#15803D', marginTop: 4 }}>
                  {formatRupiah(totalRevenue)}
                </div>
              </div>

              <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: 8, border: '1px solid #D9D9D9' }}>
                <span style={{ fontSize: 12, color: '#666666' }}>Verifikasi Tertunda</span>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, color: pendingVerifications.length > 0 ? '#D97706' : '#29165E', marginTop: 4 }}>
                  {pendingVerifications.length} Pesanan
                </div>
              </div>

              <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: 8, border: '1px solid #D9D9D9' }}>
                <span style={{ fontSize: 12, color: '#666666' }}>Total Pesanan Masuk</span>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, color: '#29165E', marginTop: 4 }}>
                  {orders.length}
                </div>
              </div>

              <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: 8, border: '1px solid #D9D9D9' }}>
                <span style={{ fontSize: 12, color: '#666666' }}>Slot Terjual / Kuota</span>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, color: '#29165E', marginTop: 4 }}>
                  {totalSlotsReserved} / {totalSlotsAvailable}
                </div>
              </div>
            </div>

            {/* Quick Action: Pending Verifications Banner */}
            {pendingVerifications.length > 0 && (
              <div style={{
                background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8,
                padding: '16px 20px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={20} color="#D97706" />
                  <div>
                    <strong style={{ color: '#92400E', fontSize: 14 }}>Ada {pendingVerifications.length} bukti pembayaran yang perlu kamu verifikasi!</strong>
                    <p style={{ color: '#B45309', fontSize: 12, margin: 0 }}>Segera periksa agar pesanan dapat diproses ke pengiriman.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('verifications')}
                  style={{
                    background: '#29165E', color: '#FFFFFF', border: 'none', borderRadius: 999,
                    padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Buka Panel Verifikasi →
                </button>
              </div>
            )}

            {/* Recent Orders List */}
            <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #D9D9D9', padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#29165E', margin: 0 }}>Pesanan Terbaru</h3>
                <button onClick={() => setActiveTab('orders')} style={{ fontSize: 12, color: '#29165E', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                  Lihat Semua →
                </button>
              </div>

              {orders.length === 0 ? (
                <p style={{ fontSize: 13, color: '#666666', textAlign: 'center', padding: '24px 0' }}>Belum ada pesanan yang masuk.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #D9D9D9', color: '#666666', fontSize: 11, textTransform: 'uppercase' }}>
                        <th style={{ padding: '8px 12px' }}>Order ID</th>
                        <th style={{ padding: '8px 12px' }}>Pembeli</th>
                        <th style={{ padding: '8px 12px' }}>Rilisan Drop</th>
                        <th style={{ padding: '8px 12px' }}>Total</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 5).map(o => (
                        <tr key={o.id} style={{ borderBottom: '1px solid #F5F6F7' }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{o.id.slice(0, 8)}...</td>
                          <td style={{ padding: '10px 12px' }}>{o.buyer_name}</td>
                          <td style={{ padding: '10px 12px' }}>{o.drop?.title || '-'}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>{formatRupiah(o.total_amount)}</td>
                          <td style={{ padding: '10px 12px' }}><StatusBadge status={o.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: VERIFIKASI PEMBAYARAN (Fitur 4.8) ───────── */}
        {activeTab === 'verifications' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#29165E', marginBottom: 4 }}>
                Panel Verifikasi Pembayaran
              </h2>
              <p style={{ fontSize: 13, color: '#666666' }}>
                Tinjau foto struk transfer yang diunggah pembeli dan tentukan status keabsahannya.
              </p>
            </div>

            {pendingVerifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#FFFFFF', borderRadius: 8, border: '1px solid #D9D9D9' }}>
                <CheckCircle2 size={44} color="#15803D" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#29165E', marginBottom: 4 }}>Semua Pembayaran Bersih! 🎉</h3>
                <p style={{ fontSize: 13, color: '#666666' }}>Tidak ada bukti transfer yang sedang menunggu verifikasi saat ini.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
                {pendingVerifications.map(order => {
                  const proof = order.payment_proof
                  const isAmountMatch = proof ? Number(proof.amount) === Number(order.total_amount) : false

                  return (
                    <div key={order.id} style={{
                      background: '#FFFFFF', borderRadius: 8, border: '1px solid #D9D9D9',
                      boxShadow: 'rgba(0,0,0,0.06) 0px 4px 16px', overflow: 'hidden',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    }}>
                      {/* Card Header */}
                      <div style={{ padding: '16px 20px', borderBottom: '1px solid #F5F6F7', background: '#FAFAFA' }}>
                        <span style={{ fontSize: 11, color: '#5E4C92', fontWeight: 600 }}>{order.drop?.title || 'Drop'}</span>
                        <h4 style={{ fontSize: 15, fontWeight: 800, color: '#29165E', margin: '4px 0 2px' }}>{order.buyer_name}</h4>
                        <span style={{ fontSize: 11, color: '#666666' }}>{order.buyer_email} • {order.buyer_phone}</span>
                      </div>

                      {/* Proof Preview & Details */}
                      <div style={{ padding: '16px 20px' }}>
                        {proof ? (
                          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                            {proof.file_url && (
                              <a href={proof.file_url} target="_blank" rel="noreferrer" title="Klik untuk perbesar">
                                <img
                                  src={proof.file_url}
                                  alt="Bukti Transfer"
                                  style={{ width: 80, height: 110, objectFit: 'cover', borderRadius: 4, border: '1px solid #D9D9D9' }}
                                />
                              </a>
                            )}
                            <div style={{ fontSize: 12, lineHeight: '20px' }}>
                              <p>Bank: <strong>{proof.bank_name}</strong></p>
                              <p>A.n: <strong>{proof.sender_name}</strong></p>
                              <p>Nominal Transfer: <strong>{formatRupiah(proof.amount)}</strong></p>
                              <p>Tagihan Order: <strong>{formatRupiah(order.total_amount)}</strong></p>
                              {!isAmountMatch && (
                                <span style={{ color: '#D32F2F', fontSize: 11, fontWeight: 700 }}>
                                  ⚠️ Nominal transfer berbeda dari tagihan!
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: '12px', background: '#FEF3C7', borderRadius: 4, fontSize: 12, color: '#92400E', marginBottom: 14 }}>
                            Menunggu unggahan foto bukti transfer dari pembeli.
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div style={{
                        padding: '12px 20px', borderTop: '1px solid #F5F6F7', background: '#FAFAFA',
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                      }}>
                        <button
                          disabled={processingVerify}
                          onClick={() => handleVerify(order.id)}
                          style={{
                            background: '#15803D', color: '#FFFFFF', border: 'none', borderRadius: 6,
                            padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          }}
                        >
                          <CheckCircle2 size={15} /> Verifikasi (Lunas)
                        </button>

                        <button
                          disabled={processingVerify}
                          onClick={() => { setSelectedProofOrder(order); setShowRejectModal(true); }}
                          style={{
                            background: '#FFFFFF', color: '#D32F2F', border: '1px solid #D32F2F', borderRadius: 6,
                            padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          }}
                        >
                          <XCircle size={15} /> Tolak
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: REKAP PESANAN & EKSPEDISI (Fitur 4.4) ───── */}
        {activeTab === 'orders' && (
          <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #D9D9D9', padding: isMobile ? '16px' : '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#29165E', margin: 0 }}>Rekap Pesanan & Data Pengiriman</h2>
                <p style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>Kelola dan download seluruh data alamat penerima untuk proses logistik.</p>
              </div>

              <button
                onClick={exportToCSV}
                disabled={orders.length === 0}
                style={{
                  background: '#29165E', color: '#FFFFFF', border: 'none', borderRadius: 6,
                  padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <Download size={15} /> Export Alamat (CSV)
              </button>
            </div>

            {/* Filter Controls */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                <Search size={15} color="#75797C" style={{ position: 'absolute', left: 10, top: 12 }} />
                <input
                  type="text"
                  placeholder="Cari ID, nama pembeli, email..."
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: 32, fontSize: 13 }}
                />
              </div>

              <select
                value={orderStatusFilter}
                onChange={e => setOrderStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', fontSize: 13, borderRadius: 4, border: '1px solid #D9D9D9', background: '#FFFFFF' }}
              >
                <option value="all">Semua Status</option>
                <option value="paid">Lunas</option>
                <option value="awaiting_verification">Menunggu Verifikasi</option>
                <option value="pending_payment">Belum Bayar</option>
                <option value="rejected">Ditolak</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </div>

            {/* Orders Table */}
            {filteredOrders.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px 0', color: '#666666', fontSize: 13 }}>
                Tidak ada pesanan yang sesuai dengan filter.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #D9D9D9', color: '#666666', fontSize: 11, textTransform: 'uppercase', background: '#F5F6F7' }}>
                      <th style={{ padding: '10px 12px' }}>Order ID</th>
                      <th style={{ padding: '10px 12px' }}>Waktu</th>
                      <th style={{ padding: '10px 12px' }}>Pembeli</th>
                      <th style={{ padding: '10px 12px' }}>WhatsApp</th>
                      <th style={{ padding: '10px 12px' }}>Alamat Pengiriman</th>
                      <th style={{ padding: '10px 12px' }}>Item</th>
                      <th style={{ padding: '10px 12px' }}>Total</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid #F5F6F7' }}>
                        <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: 11, color: '#5E4C92' }}>{o.id.slice(0, 8)}...</td>
                        <td style={{ padding: '12px', fontSize: 12 }}>{formatDate(o.created_at)}</td>
                        <td style={{ padding: '12px' }}>
                          <strong>{o.buyer_name}</strong>
                          <div style={{ fontSize: 11, color: '#666666' }}>{o.buyer_email}</div>
                        </td>
                        <td style={{ padding: '12px', fontSize: 12 }}>{o.buyer_phone}</td>
                        <td style={{ padding: '12px', fontSize: 12, maxWidth: 240 }}>{o.shipping_address}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{o.quantity}</td>
                        <td style={{ padding: '12px', fontWeight: 700 }}>{formatRupiah(o.total_amount)}</td>
                        <td style={{ padding: '12px' }}><StatusBadge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: KELOLA DROPS ────────────────────────────── */}
        {activeTab === 'drops' && (
          <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #D9D9D9', padding: isMobile ? '16px' : '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#29165E', margin: 0 }}>Daftar Rilisan Drop</h2>
                <p style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>Semua event rilis terbatas milik brand kamu.</p>
              </div>
            </div>

            {drops.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px 0', color: '#666666', fontSize: 13 }}>Belum ada drop yang dibuat.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                {drops.map(d => (
                  <div key={d.id} style={{
                    borderRadius: 6, border: '1px solid #D9D9D9', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  }}>
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: d.status === 'live' ? '#DCFCE7' : d.status === 'scheduled' ? '#E7E3FF' : '#F3F4F6',
                          color: d.status === 'live' ? '#15803D' : d.status === 'scheduled' ? '#5E4C92' : '#6B7280',
                        }}>
                          {d.status.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#29165E' }}>{formatRupiah(d.price)}</span>
                      </div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#29165E', marginBottom: 12 }}>{d.title}</h4>
                      <div style={{ fontSize: 12, color: '#666666', marginBottom: 4 }}>
                        Slot: <strong>{d.reserved_count}</strong> dari <strong>{d.total_slots}</strong> terisi
                      </div>
                      <div style={{ height: 6, background: '#F5F6F7', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (d.reserved_count / d.total_slots) * 100)}%`, background: '#29165E' }} />
                      </div>
                    </div>

                    <div style={{ padding: '10px 16px', borderTop: '1px solid #F5F6F7', background: '#FAFAFA', display: 'flex', justifyContent: 'flex-end' }}>
                      <Link to={`/drops/${d.id}`} target="_blank" style={{ fontSize: 12, color: '#29165E', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Lihat Halaman Publik <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── MODAL TOLAK PEMBAYARAN ──────────────────────────── */}
      {showRejectModal && selectedProofOrder && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 8, width: '100%', maxWidth: 440,
            padding: '24px', position: 'relative', boxShadow: 'rgba(0,0,0,0.2) 0px 20px 60px',
          }}>
            <button
              onClick={() => { setShowRejectModal(false); setSelectedProofOrder(null); }}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#666666' }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: 17, fontWeight: 900, color: '#D32F2F', marginBottom: 6 }}>
              Tolak Bukti Pembayaran
            </h3>
            <p style={{ fontSize: 13, color: '#666666', marginBottom: 18 }}>
              Tuliskan alasan penolakan agar pembeli ({selectedProofOrder.buyer_name}) mengetahui hal yang perlu diperbaiki saat mengunggah ulang bukti bayar.
            </p>

            <form onSubmit={handleReject}>
              <div style={{ marginBottom: 18 }}>
                <label className="input-label">Alasan Penolakan</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Contoh: Nominal transfer kurang Rp 50.000 / Nama rekening tidak sesuai..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="input-field"
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="btn-ghost"
                  style={{ flex: 1, height: 44 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={processingVerify}
                  style={{
                    flex: 1, height: 44, background: '#D32F2F', color: '#FFFFFF',
                    border: 'none', borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {processingVerify ? 'Memproses...' : 'Konfirmasi Tolak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
