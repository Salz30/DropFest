import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CheckSquare, Package,
  LogOut, Zap, Clock, CheckCircle2, XCircle,
  Search, Download, X, ChevronRight, RefreshCw,
  Plus, Edit2, Trash2, Maximize2, ExternalLink,
  Edit3, Globe
} from 'lucide-react'
import { supabase, callRpc } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ImageUpload from '../components/ImageUpload'
import type { Drop, Order, PaymentProof, OrderStatus, Product, DropStatus } from '../types'
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

function toDatetimeLocal(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
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
  const { brand, user, isDemoMode, signOut, refreshBrandData } = useAuth()
  const navigate = useNavigate()
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'

  const [activeTab, setActiveTab] = useState<'overview' | 'verifications' | 'orders' | 'drops' | 'products'>('overview')
  const [drops, setDrops] = useState<Drop[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<EnrichedOrder[]>([])
  const [refreshing, setRefreshing] = useState(false)

  // Orders Filter
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all')

  // Verification Modal State
  const [selectedProofOrder, setSelectedProofOrder] = useState<EnrichedOrder | null>(null)
  const [zoomProof, setZoomProof] = useState<EnrichedOrder | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processingVerify, setProcessingVerify] = useState(false)
  const [verifyMessage, setVerifyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Brand Edit State
  const [showBrandEditModal, setShowBrandEditModal] = useState(false)
  const [brandEditForm, setBrandEditForm] = useState({
    name: '',
    description: '',
    instagram: '',
    category: '',
    logo_url: '',
    banner_url: '',
  })
  const [savingBrandProfile, setSavingBrandProfile] = useState(false)
  const [brandEditMessage, setBrandEditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Product CRUD State
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productForm, setProductForm] = useState({ name: '', description: '', price: 1000, category: '', image_url: '' })
  const [productMessage, setProductMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false)

  // Drop CRUD State
  const [showDropModal, setShowDropModal] = useState(false)
  const [editingDrop, setEditingDrop] = useState<Drop | null>(null)
  const [dropForm, setDropForm] = useState({
    product_id: '', title: '', description: '', price: 0, total_slots: 1, 
    starts_at: '', ends_at: '', status: 'scheduled' as DropStatus, banner_url: '',
    bank_name: '', account_number: '', account_holder: ''
  })
  const [dropMessage, setDropMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isSubmittingDrop, setIsSubmittingDrop] = useState(false)

  const handleSaveBrandProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!brand) return
    setSavingBrandProfile(true)
    setBrandEditMessage(null)

    const payload = {
      name: brandEditForm.name.trim(),
      description: brandEditForm.description?.trim() || null,
      instagram: brandEditForm.instagram?.trim() || null,
      category: brandEditForm.category?.trim() || null,
      logo_url: brandEditForm.logo_url || null,
      banner_url: brandEditForm.banner_url || null,
    }

    try {
      const { error: updateError } = await supabase
        .from('brands')
        .update(payload)
        .eq('id', brand.id)

      if (updateError) throw updateError

      setBrandEditMessage({ type: 'success', text: 'Profil brand berhasil diperbarui!' })
      await refreshBrandData()
      fetchDashboardData()

      setTimeout(() => {
        setShowBrandEditModal(false)
        setBrandEditMessage(null)
      }, 800)
    } catch (err: any) {
      setBrandEditMessage({ type: 'error', text: err.message || 'Gagal memperbarui profil brand.' })
    } finally {
      setSavingBrandProfile(false)
    }
  }

  const fetchDashboardData = async () => {
    if (!brand) return
    setRefreshing(true)
    try {
      // 1. Fetch Products
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('brand_id', brand.id)
        .order('created_at', { ascending: false })
      
      setProducts(productsData || [])

      // 2. Fetch Drops
      const { data: dropsData } = await supabase
        .from('drops')
        .select('*')
        .eq('brand_id', brand.id)
        .order('created_at', { ascending: false })

      const brandDrops = (dropsData || []) as Drop[]
      setDrops(brandDrops)

      // 3. Fetch Orders
      const { data: rpcRes } = await callRpc('get_brand_orders_for_dashboard', {
        p_brand_id: brand.id,
      })

      if (rpcRes && typeof rpcRes === 'object' && (rpcRes as any).orders) {
        setOrders((rpcRes as any).orders as EnrichedOrder[])
      } else if (brandDrops.length > 0) {
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
      const rpcName = isDemoMode ? 'demo_verify_payment' : 'verify_payment'
      const { data, error } = await callRpc(rpcName, {
        p_order_id: orderId,
        p_action: 'verify',
      })

      if (error) {
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

  // Export CSV Function
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

  // --- CRUD Products ---
  const openAddProduct = () => {
    setEditingProduct(null)
    setProductForm({ name: '', description: '', price: 1000, category: '', image_url: '' })
    setProductMessage(null)
    setShowProductModal(true)
  }

  const openEditProduct = (p: Product) => {
    setEditingProduct(p)
    setProductForm({
      name: p.name, description: p.description || '', price: p.price,
      category: p.category || '', image_url: p.image_url || ''
    })
    setProductMessage(null)
    setShowProductModal(true)
  }

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!brand) return
    setIsSubmittingProduct(true)
    setProductMessage(null)

    const payload = {
      p_action: editingProduct ? 'update' : 'insert',
      p_brand_id: brand.id,
      p_product_id: editingProduct ? editingProduct.id : null,
      p_name: productForm.name,
      p_description: productForm.description || null,
      p_price: productForm.price,
      p_category: productForm.category || null,
      p_image_url: productForm.image_url || null,
    }

    try {
      // First try via RPC manage_product (works for both Demo and Auth)
      const { data: rpcRes, error: rpcErr } = await callRpc('manage_product', payload)

      if (!rpcErr && rpcRes && typeof rpcRes === 'object' && (rpcRes as any).success) {
        setProductMessage({ type: 'success', text: (rpcRes as any).message || (editingProduct ? 'Produk berhasil diperbarui!' : 'Produk berhasil ditambahkan!') })
      } else {
        // Fallback to direct supabase query
        const directPayload = {
          brand_id: brand.id,
          name: productForm.name,
          description: productForm.description || null,
          price: productForm.price,
          category: productForm.category || null,
          image_url: productForm.image_url || null,
        }
        if (editingProduct) {
          const { error } = await supabase.from('products').update(directPayload).eq('id', editingProduct.id)
          if (error) throw error
          setProductMessage({ type: 'success', text: 'Produk berhasil diperbarui!' })
        } else {
          const { error } = await supabase.from('products').insert(directPayload)
          if (error) throw error
          setProductMessage({ type: 'success', text: 'Produk berhasil ditambahkan!' })
        }
      }

      setTimeout(() => {
        setShowProductModal(false)
        fetchDashboardData()
      }, 800)
    } catch (err: any) {
      setProductMessage({ type: 'error', text: err.message || 'Gagal menyimpan produk.' })
    } finally {
      setIsSubmittingProduct(false)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!brand) return
    if (!window.confirm('Yakin ingin menghapus produk ini?')) return
    try {
      const { data: rpcRes, error: rpcErr } = await callRpc('manage_product', {
        p_action: 'delete',
        p_brand_id: brand.id,
        p_product_id: id,
      })

      if (rpcErr || (rpcRes && !(rpcRes as any).success)) {
        const { error } = await supabase.from('products').delete().eq('id', id)
        if (error) throw error
      }
      fetchDashboardData()
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus produk')
    }
  }

  // --- CRUD Drops ---
  const openAddDrop = () => {
    setEditingDrop(null)
    setDropForm({
      product_id: '', title: '', description: '', price: 0, total_slots: 1, 
      starts_at: '', ends_at: '', status: 'scheduled', banner_url: '',
      bank_name: '', account_number: '', account_holder: ''
    })
    setDropMessage(null)
    setShowDropModal(true)
  }

  const openEditDrop = (d: Drop) => {
    setEditingDrop(d)
    setDropForm({
      product_id: d.product_id,
      title: d.title,
      description: d.description || '',
      price: d.price,
      total_slots: d.total_slots,
      starts_at: toDatetimeLocal(d.starts_at),
      ends_at: d.ends_at ? toDatetimeLocal(d.ends_at) : '',
      status: d.status,
      banner_url: d.banner_url || '',
      bank_name: d.bank_name || '',
      account_number: d.account_number || '',
      account_holder: d.account_holder || ''
    })
    setDropMessage(null)
    setShowDropModal(true)
  }

  const handleDropSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!brand) return
    setIsSubmittingDrop(true)
    setDropMessage(null)

    const rpcPayload = {
      p_action: editingDrop ? 'update' : 'insert',
      p_brand_id: brand.id,
      p_drop_id: editingDrop ? editingDrop.id : null,
      p_product_id: dropForm.product_id,
      p_title: dropForm.title,
      p_description: dropForm.description || null,
      p_banner_url: dropForm.banner_url || null,
      p_total_slots: dropForm.total_slots,
      p_price: dropForm.price,
      p_starts_at: new Date(dropForm.starts_at).toISOString(),
      p_ends_at: dropForm.ends_at ? new Date(dropForm.ends_at).toISOString() : null,
      p_status: dropForm.status,
      p_bank_name: dropForm.bank_name || null,
      p_account_number: dropForm.account_number || null,
      p_account_holder: dropForm.account_holder || null,
    }

    try {
      // First try via RPC manage_drop (works for both Demo and Auth)
      const { data: rpcRes, error: rpcErr } = await callRpc('manage_drop', rpcPayload)

      if (!rpcErr && rpcRes && typeof rpcRes === 'object' && (rpcRes as any).success) {
        setDropMessage({ type: 'success', text: (rpcRes as any).message || (editingDrop ? 'Drop berhasil diperbarui!' : 'Drop berhasil dibuat!') })
      } else {
        // Fallback to direct supabase query
        const directPayload = {
          brand_id: brand.id,
          product_id: dropForm.product_id,
          title: dropForm.title,
          description: dropForm.description || null,
          banner_url: dropForm.banner_url || null,
          total_slots: dropForm.total_slots,
          price: dropForm.price,
          starts_at: new Date(dropForm.starts_at).toISOString(),
          ends_at: dropForm.ends_at ? new Date(dropForm.ends_at).toISOString() : null,
          status: dropForm.status,
          bank_name: dropForm.bank_name || null,
          account_number: dropForm.account_number || null,
          account_holder: dropForm.account_holder || null,
        }

        if (editingDrop) {
          const { error } = await supabase.from('drops').update(directPayload).eq('id', editingDrop.id)
          if (error) throw error
          setDropMessage({ type: 'success', text: 'Drop berhasil diperbarui!' })
        } else {
          const { error } = await supabase.from('drops').insert(directPayload)
          if (error) throw error
          setDropMessage({ type: 'success', text: 'Drop berhasil dibuat!' })
        }
      }

      setTimeout(() => {
        setShowDropModal(false)
        fetchDashboardData()
      }, 800)
    } catch (err: any) {
      setDropMessage({ type: 'error', text: err.message || 'Gagal menyimpan drop.' })
    } finally {
      setIsSubmittingDrop(false)
    }
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
              width: 48, height: 48, borderRadius: 8, background: '#29165E',
              color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 900, overflow: 'hidden', border: '1px solid #E2E8F0', flexShrink: 0,
            }}>
              {brand?.logo_url ? (
                <img src={brand.logo_url} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                brand?.name.charAt(0) || 'B'
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {brand?.slug && (
              <Link
                to={`/brands/${brand.slug}`}
                style={{
                  background: '#FFFFFF', border: '1px solid #D9D9D9', borderRadius: 6,
                  padding: '8px 12px', fontSize: 12, color: '#29165E', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600,
                }}
              >
                <Globe size={13} /> Profil Publik
              </Link>
            )}

            <button
              onClick={() => {
                setBrandEditForm({
                  name: brand?.name || '',
                  description: brand?.description || '',
                  instagram: brand?.instagram || '',
                  category: brand?.category || '',
                  logo_url: brand?.logo_url || '',
                  banner_url: brand?.banner_url || '',
                })
                setShowBrandEditModal(true)
              }}
              style={{
                background: '#F0F3FF', border: '1px solid #E0E7FF', borderRadius: 6,
                padding: '8px 12px', fontSize: 12, color: '#29165E', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600,
              }}
            >
              <Edit3 size={13} /> Edit Profil & Foto
            </button>

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
                background: '#FFFFFF', border: '1px solid #FECDD3', borderRadius: 6,
                padding: '8px 14px', fontSize: 12, color: '#E11D48', cursor: 'pointer',
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
            { id: 'drops', label: 'Kelola Drop', icon: Zap, badge: drops.length },
            { id: 'products', label: 'Kelola Produk', icon: Package, badge: products.length },
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

        {/* ── TAB 2: VERIFIKASI PEMBAYARAN ───────── */}
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
                            {proof.file_url ? (
                              <div
                                onClick={() => setZoomProof(order)}
                                style={{
                                  position: 'relative',
                                  width: 84,
                                  height: 115,
                                  cursor: 'pointer',
                                  borderRadius: 6,
                                  overflow: 'hidden',
                                  border: '2px solid #29165E',
                                  flexShrink: 0,
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                }}
                                title="Klik untuk memperbesar bukti transfer"
                              >
                                <img
                                  src={proof.file_url}
                                  alt="Bukti Transfer"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <div
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(41,22,94,0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#FFFFFF',
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                                >
                                  <Maximize2 size={18} />
                                </div>
                              </div>
                            ) : null}
                            <div style={{ fontSize: 12, lineHeight: '20px', flex: 1 }}>
                              <p>Bank: <strong>{proof.bank_name}</strong></p>
                              <p>A.n: <strong>{proof.sender_name}</strong></p>
                              <p>Nominal Transfer: <strong>{formatRupiah(proof.amount)}</strong></p>
                              <p>Tagihan Order: <strong>{formatRupiah(order.total_amount)}</strong></p>
                              {!isAmountMatch && (
                                <span style={{ color: '#D32F2F', fontSize: 11, fontWeight: 700, display: 'block', marginTop: 4 }}>
                                  ⚠️ Nominal transfer berbeda dari tagihan!
                                </span>
                              )}
                              {proof.file_url && (
                                <button
                                  type="button"
                                  onClick={() => setZoomProof(order)}
                                  style={{
                                    marginTop: 6,
                                    background: '#F0F3FF',
                                    border: '1px solid #E7E3FF',
                                    borderRadius: 4,
                                    padding: '3px 8px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#29165E',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <Maximize2 size={11} /> Perbesar Foto Struk
                                </button>
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
                          <CheckCircle2 size={15} /> Verifikasi
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

        {/* ── TAB 3: REKAP PESANAN ───── */}
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
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#29165E', margin: 0 }}>Kelola Drop</h2>
                <p style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>Semua event rilis terbatas milik brand kamu.</p>
              </div>
              <button 
                onClick={openAddDrop}
                className="btn-navy" 
                style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Buat Drop Baru
              </button>
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

                    <div style={{ padding: '10px 16px', borderTop: '1px solid #F5F6F7', background: '#FAFAFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button onClick={() => openEditDrop(d)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px', color: '#0369A1', fontWeight: 600 }}>
                        <Edit2 size={13} /> Edit
                      </button>
                      <Link to={`/drops/${d.id}`} target="_blank" style={{ fontSize: 12, color: '#29165E', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Halaman Publik <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 5: KELOLA PRODUK ────────────────────────────── */}
        {activeTab === 'products' && (
          <div style={{ background: '#FFFFFF', borderRadius: 8, border: '1px solid #D9D9D9', padding: isMobile ? '16px' : '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#29165E', margin: 0 }}>Kelola Produk</h2>
                <p style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>Daftar produk yang bisa dipilih untuk Drop.</p>
              </div>
              <button 
                onClick={openAddProduct}
                className="btn-navy" 
                style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Tambah Produk
              </button>
            </div>

            {products.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px 0', color: '#666666', fontSize: 13 }}>Belum ada produk. Silakan tambah produk baru.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
                {products.map(p => (
                  <div key={p.id} style={{
                    borderRadius: 6, border: '1px solid #D9D9D9', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  }}>
                    {p.image_url ? (
                      <div style={{ width: '100%', height: 160, background: '#F5F6F7', borderBottom: '1px solid #D9D9D9' }}>
                        <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{ width: '100%', height: 160, background: '#F5F6F7', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #D9D9D9', color: '#75797C', fontSize: 12 }}>
                        Tanpa Gambar
                      </div>
                    )}
                    <div style={{ padding: '16px' }}>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#29165E', margin: '0 0 8px' }}>{p.name}</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#15803D' }}>{formatRupiah(p.price)}</span>
                        {p.category && (
                          <span style={{ fontSize: 10, fontWeight: 600, background: '#F5F6F7', padding: '2px 6px', borderRadius: 4, color: '#666666' }}>
                            {p.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ padding: '10px 16px', borderTop: '1px solid #F5F6F7', background: '#FAFAFA', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button onClick={() => openEditProduct(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#0369A1', fontWeight: 600 }}>
                        <Edit2 size={13} /> Edit
                      </button>
                      <button onClick={() => handleDeleteProduct(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#D32F2F', fontWeight: 600 }}>
                        <Trash2 size={13} /> Hapus
                      </button>
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
              <div style={{ marginBottom: 20 }}>
                <label className="input-label">Alasan Penolakan</label>
                <textarea
                  className="input-field"
                  rows={4}
                  placeholder="Misal: Foto struk buram, nominal transfer kurang, atau bukti editan."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  disabled={processingVerify}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={processingVerify}
                style={{
                  width: '100%', background: '#D32F2F', color: '#FFFFFF',
                  border: 'none', borderRadius: 6, padding: '12px', fontSize: 14,
                  fontWeight: 700, cursor: 'pointer'
                }}
              >
                {processingVerify ? 'Memproses...' : 'Konfirmasi Tolak Pembayaran'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CRUD PRODUK ──────────────────────────── */}
      {showProductModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 8, width: '100%', maxWidth: 500,
            padding: '24px', position: 'relative', boxShadow: 'rgba(0,0,0,0.2) 0px 20px 60px',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <button
              onClick={() => setShowProductModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#666666' }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#29165E', marginBottom: 16 }}>
              {editingProduct ? 'Edit Produk' : 'Tambah Produk'}
            </h3>

            {productMessage && (
              <div style={{
                padding: '12px', borderRadius: 6, marginBottom: 16, fontSize: 13,
                background: productMessage.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                color: productMessage.type === 'success' ? '#15803D' : '#B91C1C',
                border: `1px solid ${productMessage.type === 'success' ? '#86EFAC' : '#F87171'}`
              }}>
                {productMessage.text}
              </div>
            )}

            <form onSubmit={handleProductSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Nama Produk *</label>
                <input
                  type="text"
                  className="input-field"
                  required
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Deskripsi</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="input-label">Harga (Rp) *</label>
                  <input
                    type="number"
                    className="input-field"
                    required
                    min={1000}
                    value={productForm.price}
                    onChange={e => setProductForm({ ...productForm, price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="input-label">Kategori</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. streetwear"
                    value={productForm.category}
                    onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <ImageUpload
                  bucket="product-images"
                  folder="products"
                  currentUrl={productForm.image_url}
                  onUpload={(url) => setProductForm(prev => ({ ...prev, image_url: url }))}
                  label="Foto Produk"
                  aspectHint="1:1 (Persegi)"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingProduct}
                className="btn-navy"
                style={{ width: '100%', padding: '12px', fontSize: 14 }}
              >
                {isSubmittingProduct ? 'Menyimpan...' : 'Simpan Produk'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CRUD DROP ──────────────────────────── */}
      {showDropModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 8, width: '100%', maxWidth: 600,
            padding: '24px', position: 'relative', boxShadow: 'rgba(0,0,0,0.2) 0px 20px 60px',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <button
              onClick={() => setShowDropModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#666666' }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#29165E', marginBottom: 16 }}>
              {editingDrop ? 'Edit Drop' : 'Buat Drop Baru'}
            </h3>

            {dropMessage && (
              <div style={{
                padding: '12px', borderRadius: 6, marginBottom: 16, fontSize: 13,
                background: dropMessage.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                color: dropMessage.type === 'success' ? '#15803D' : '#B91C1C',
                border: `1px solid ${dropMessage.type === 'success' ? '#86EFAC' : '#F87171'}`
              }}>
                {dropMessage.text}
              </div>
            )}

            <form onSubmit={handleDropSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Pilih Produk *</label>
                <select
                  className="input-field"
                  required
                  value={dropForm.product_id}
                  onChange={e => {
                    const pid = e.target.value;
                    const prod = products.find(p => p.id === pid);
                    setDropForm({ ...dropForm, product_id: pid, price: prod ? prod.price : dropForm.price });
                  }}
                >
                  <option value="" disabled>-- Pilih Produk --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - {formatRupiah(p.price)}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Judul Drop *</label>
                <input
                  type="text"
                  className="input-field"
                  required
                  value={dropForm.title}
                  onChange={e => setDropForm({ ...dropForm, title: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Deskripsi</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={dropForm.description}
                  onChange={e => setDropForm({ ...dropForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="input-label">Harga (Rp) *</label>
                  <input
                    type="number"
                    className="input-field"
                    required
                    min={0}
                    value={dropForm.price}
                    onChange={e => setDropForm({ ...dropForm, price: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="input-label">Total Slot *</label>
                  <input
                    type="number"
                    className="input-field"
                    required
                    min={1}
                    value={dropForm.total_slots}
                    onChange={e => setDropForm({ ...dropForm, total_slots: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="input-label">Tanggal Mulai *</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    required
                    value={dropForm.starts_at}
                    onChange={e => setDropForm({ ...dropForm, starts_at: e.target.value })}
                  />
                </div>
                <div>
                  <label className="input-label">Tanggal Berakhir</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={dropForm.ends_at}
                    onChange={e => setDropForm({ ...dropForm, ends_at: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Status</label>
                <select
                  className="input-field"
                  value={dropForm.status}
                  onChange={e => setDropForm({ ...dropForm, status: e.target.value as DropStatus })}
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="live">Live</option>
                  <option value="ended">Ended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <ImageUpload
                  bucket="drop-banners"
                  folder="banners"
                  currentUrl={dropForm.banner_url}
                  onUpload={(url) => setDropForm(prev => ({ ...prev, banner_url: url }))}
                  label="Banner Rilisan Drop"
                  aspectHint="16:9 (Landscape)"
                />
              </div>

              <div style={{ margin: '24px 0 16px', borderTop: '1px solid #D9D9D9', paddingTop: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#29165E', marginBottom: 12 }}>--- Info Pembayaran ---</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label className="input-label">Nama Bank *</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Misal: BCA"
                      required
                      value={dropForm.bank_name}
                      onChange={e => setDropForm({ ...dropForm, bank_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="input-label">Nomor Rekening *</label>
                    <input
                      type="text"
                      className="input-field"
                      required
                      value={dropForm.account_number}
                      onChange={e => setDropForm({ ...dropForm, account_number: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label className="input-label">Nama Pemegang Rekening *</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    value={dropForm.account_holder}
                    onChange={e => setDropForm({ ...dropForm, account_holder: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingDrop}
                className="btn-navy"
                style={{ width: '100%', padding: '12px', fontSize: 14 }}
              >
                {isSubmittingDrop ? 'Menyimpan...' : 'Simpan Drop'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL LIGHTBOX BUKTI TRANSFER ─────────────────── */}
      {zoomProof && zoomProof.payment_proof && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 640,
            maxHeight: '92vh', overflowY: 'auto', position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#29165E', margin: 0 }}>
                  Foto Bukti Transfer Pelanggan
                </h3>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  {zoomProof.buyer_name} ({zoomProof.buyer_email})
                </span>
              </div>
              <button
                onClick={() => setZoomProof(null)}
                style={{
                  background: '#F1F5F9', border: 'none', borderRadius: 999,
                  width: 32, height: 32, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: '#475569',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Image display */}
            <div style={{
              padding: '16px', background: '#0F172A', textAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 300,
            }}>
              {zoomProof.payment_proof.file_url ? (
                <img
                  src={zoomProof.payment_proof.file_url}
                  alt="Bukti Transfer Penuh"
                  style={{
                    maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain',
                    borderRadius: 6, boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  }}
                />
              ) : (
                <p style={{ color: '#94A3B8', fontSize: 14 }}>Gambar bukti bayar tidak tersedia.</p>
              )}
            </div>

            {/* Details & Actions Footer */}
            <div style={{ padding: '16px 20px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
                fontSize: 12, marginBottom: 16, background: '#FFFFFF', padding: 12,
                borderRadius: 8, border: '1px solid #E2E8F0',
              }}>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: 11 }}>Bank & Pengirim:</span>
                  <strong>{zoomProof.payment_proof.bank_name} - {zoomProof.payment_proof.sender_name}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: 11 }}>Nominal Transfer:</span>
                  <strong style={{ color: '#15803D' }}>{formatRupiah(zoomProof.payment_proof.amount)}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: 11 }}>Tagihan Pesanan:</span>
                  <strong style={{ color: '#29165E' }}>{formatRupiah(zoomProof.total_amount)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                {zoomProof.payment_proof.file_url && (
                  <a
                    href={zoomProof.payment_proof.file_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 12, color: '#29165E', fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      textDecoration: 'none',
                    }}
                  >
                    <ExternalLink size={13} /> Buka Tab Baru / Simpan Gambar
                  </a>
                )}

                {zoomProof.status === 'awaiting_verification' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => {
                        const targetId = zoomProof.id
                        setZoomProof(null)
                        handleVerify(targetId)
                      }}
                      style={{
                        background: '#15803D', color: '#FFFFFF', border: 'none',
                        borderRadius: 6, padding: '8px 16px', fontSize: 13,
                        fontWeight: 700, cursor: 'pointer', display: 'flex',
                        alignItems: 'center', gap: 6,
                      }}
                    >
                      <CheckCircle2 size={14} /> Verifikasi (Lunas)
                    </button>
                    <button
                      onClick={() => {
                        const target = zoomProof
                        setZoomProof(null)
                        setSelectedProofOrder(target)
                        setShowRejectModal(true)
                      }}
                      style={{
                        background: '#FFFFFF', color: '#D32F2F', border: '1px solid #D32F2F',
                        borderRadius: 6, padding: '8px 16px', fontSize: 13,
                        fontWeight: 700, cursor: 'pointer', display: 'flex',
                        alignItems: 'center', gap: 6,
                      }}
                    >
                      <XCircle size={14} /> Tolak
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDIT PROFIL BRAND ─────────────────────────── */}
      {showBrandEditModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 12, width: '100%', maxWidth: 540,
            maxHeight: '90vh', overflowY: 'auto', padding: isMobile ? '20px' : '28px',
            position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
          }}>
            <button
              type="button"
              onClick={() => { setShowBrandEditModal(false); setBrandEditMessage(null); }}
              style={{
                position: 'absolute', top: 18, right: 18,
                background: '#F1F5F9', border: 'none', borderRadius: 999,
                width: 32, height: 32, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: '#475569',
              }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#29165E', marginBottom: 4 }}>
              Edit Profil & Visual Brand
            </h3>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 20 }}>
              Perbarui logo, banner cover, dan informasi etalase publik brand Anda.
            </p>

            {brandEditMessage && (
              <div style={{
                padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13,
                background: brandEditMessage.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                color: brandEditMessage.type === 'success' ? '#15803D' : '#B91C1C',
                border: `1px solid ${brandEditMessage.type === 'success' ? '#86EFAC' : '#F87171'}`,
              }}>
                {brandEditMessage.text}
              </div>
            )}

            <form onSubmit={handleSaveBrandProfile}>
              {/* Logo Upload */}
              <div style={{ marginBottom: 18 }}>
                <ImageUpload
                  bucket="brand-assets"
                  folder="logos"
                  currentUrl={brandEditForm.logo_url}
                  onUpload={(url) => setBrandEditForm(prev => ({ ...prev, logo_url: url }))}
                  label="Logo Brand (Avatar Lingkaran)"
                  aspectHint="1:1 (Persegi)"
                />
              </div>

              {/* Banner Upload */}
              <div style={{ marginBottom: 18 }}>
                <ImageUpload
                  bucket="brand-assets"
                  folder="banners"
                  currentUrl={brandEditForm.banner_url}
                  onUpload={(url) => setBrandEditForm(prev => ({ ...prev, banner_url: url }))}
                  label="Banner Cover Brand (Header)"
                  aspectHint="16:9 / Landscape"
                />
              </div>

              {/* Brand Name */}
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Nama Brand *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={brandEditForm.name}
                  onChange={e => setBrandEditForm({ ...brandEditForm, name: e.target.value })}
                />
              </div>

              {/* Instagram */}
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Instagram Handle</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="@brandkamu"
                  value={brandEditForm.instagram}
                  onChange={e => setBrandEditForm({ ...brandEditForm, instagram: e.target.value })}
                />
              </div>

              {/* Category / Niche */}
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Kategori / Niche Brand</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Contoh: Streetwear & Apparel, Vinyl Records, Artisan Coffee"
                  value={brandEditForm.category}
                  onChange={e => setBrandEditForm({ ...brandEditForm, category: e.target.value })}
                />
              </div>

              {/* Description / Bio */}
              <div style={{ marginBottom: 24 }}>
                <label className="input-label">Deskripsi / Bio Brand</label>
                <textarea
                  rows={3}
                  className="input-field"
                  placeholder="Ceritakan tentang filosofi brand dan produk unik kamu..."
                  value={brandEditForm.description}
                  onChange={e => setBrandEditForm({ ...brandEditForm, description: e.target.value })}
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowBrandEditModal(false)}
                  className="btn-ghost"
                  style={{ flex: 1, height: 44 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingBrandProfile}
                  className="btn-navy"
                  style={{ flex: 2, height: 44, fontSize: 13, fontWeight: 700 }}
                >
                  {savingBrandProfile ? 'Menyimpan Perubahan...' : 'Simpan Profil Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
