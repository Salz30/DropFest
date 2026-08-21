import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Instagram, Zap, Package, Tag, ChevronDown, ChevronUp,
  AlertCircle, Edit3, X, Sparkles
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ImageUpload from '../components/ImageUpload'
import type { Brand, Drop, Product } from '../types'
import { useBreakpoint } from '../hooks/useBreakpoint'

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
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

export default function BrandProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'
  const isTabletDown = bp === 'mobile' || bp === 'tablet'

  const { user, brand: authBrand, refreshBrandData } = useAuth()

  const [brand, setBrand] = useState<Brand | null>(null)
  const [drops, setDrops] = useState<Drop[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPastDrops, setShowPastDrops] = useState(false)

  // Edit Brand Modal State
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    instagram: '',
    category: '',
    logo_url: '',
    banner_url: '',
  })
  const [savingBrand, setSavingBrand] = useState(false)
  const [editMessage, setEditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const isOwnerOfThisBrand = Boolean(
    user && authBrand && brand && (authBrand.id === brand.id || authBrand.slug === brand.slug)
  )

  const fetchBrandProfile = async () => {
    if (!slug) return
    setLoading(true)
    setError(null)
    try {
      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .eq('slug', slug)
        .single()

      if (brandError || !brandData) {
        setError('Brand tidak ditemukan.')
        return
      }

      const b = brandData as Brand
      setBrand(b)
      setEditForm({
        name: b.name || '',
        description: b.description || '',
        instagram: b.instagram || '',
        category: b.category || '',
        logo_url: b.logo_url || (b.slug === 'void-division' ? '/void_logo.jpg' : ''),
        banner_url: b.banner_url || (b.slug === 'void-division' ? '/void_banner.jpg' : ''),
      })

      const [dropsResponse, productsResponse] = await Promise.all([
        supabase.from('drops').select('*').eq('brand_id', b.id).order('starts_at', { ascending: false }),
        supabase.from('products').select('*').eq('brand_id', b.id).order('created_at', { ascending: false })
      ])

      if (!dropsResponse.error && dropsResponse.data) {
        setDrops(dropsResponse.data as Drop[])
      }
      if (!productsResponse.error && productsResponse.data) {
        setProducts(productsResponse.data as Product[])
      }
    } catch {
      setError('Gagal memuat profil brand.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBrandProfile()
  }, [slug])

  const handleSaveBrandProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!brand) return
    setSavingBrand(true)
    setEditMessage(null)

    const payload = {
      name: editForm.name.trim(),
      description: editForm.description?.trim() || null,
      instagram: editForm.instagram?.trim() || null,
      category: editForm.category?.trim() || null,
      logo_url: editForm.logo_url || null,
      banner_url: editForm.banner_url || null,
    }

    try {
      const { error: updateError } = await supabase
        .from('brands')
        .update(payload)
        .eq('id', brand.id)

      if (updateError) throw updateError

      setBrand(prev => prev ? ({ ...prev, ...payload }) : null)
      setEditMessage({ type: 'success', text: 'Profil brand berhasil diperbarui!' })
      await refreshBrandData()
      await fetchBrandProfile()

      setTimeout(() => {
        setShowEditModal(false)
        setEditMessage(null)
      }, 800)
    } catch (err: any) {
      setEditMessage({ type: 'error', text: err.message || 'Gagal memperbarui profil brand.' })
    } finally {
      setSavingBrand(false)
    }
  }

  if (loading) {
    return (
      <div className="container-main" style={{ padding: '60px 0', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #E7E3FF', borderTopColor: '#29165E', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: 12, color: '#666666', fontSize: 13 }}>Memuat profil brand...</p>
      </div>
    )
  }

  if (error || !brand) {
    return (
      <div className="container-main" style={{ padding: '60px 0', textAlign: 'center' }}>
        <AlertCircle size={44} color="#D32F2F" style={{ margin: '0 auto 14px' }} />
        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#29165E', marginBottom: 6 }}>Brand Tidak Ditemukan</h2>
        <p style={{ color: '#666666', fontSize: 13, marginBottom: 20 }}>{error || 'Halaman brand yang kamu cari tidak tersedia.'}</p>
        <Link to="/brands" className="btn-navy" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          Lihat Semua Brand
        </Link>
      </div>
    )
  }

  const liveUpcomingDrops = drops.filter(d => getComputedStatus(d) !== 'ended')
  const pastDrops = drops.filter(d => getComputedStatus(d) === 'ended')
  
  const totalDrops = drops.length
  const liveDropsCount = liveUpcomingDrops.filter(d => getComputedStatus(d) === 'live').length
  const totalProducts = products.length

  const gridCols = isMobile ? '1fr' : isTabletDown ? '1fr 1fr' : 'repeat(3, 1fr)'
  const productGridCols = isMobile ? '1fr 1fr' : isTabletDown ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)'

  const bannerImg = brand.banner_url || (brand.slug === 'void-division' ? '/void_banner.jpg' : null)
  const logoImg = brand.logo_url || (brand.slug === 'void-division' ? '/void_logo.jpg' : null)

  return (
    <div style={{ backgroundColor: '#F8FAFC', minHeight: '85vh', paddingBottom: 60 }}>

      {/* ── HERO BANNER (Compact & Clean) ───────────────────────────── */}
      <div style={{ position: 'relative', width: '100%', background: '#0F0926' }}>
        <div style={{
          height: isMobile ? 120 : 160,
          width: '100%',
          backgroundImage: bannerImg ? `url(${bannerImg})` : 'linear-gradient(135deg, #1A0F3D 0%, #3D228A 100%)',
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          position: 'relative',
        }}>
          {/* If Owner: Quick Edit button on top banner */}
          {isOwnerOfThisBrand && (
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              style={{
                position: 'absolute',
                top: 10,
                right: 12,
                background: 'rgba(255,255,255,0.94)',
                backdropFilter: 'blur(6px)',
                border: 'none',
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 700,
                color: '#29165E',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                zIndex: 10,
              }}
            >
              <Edit3 size={12} /> Edit Banner & Logo
            </button>
          )}
        </div>
      </div>

      {/* ── BRAND INFO CARD (ZERO OVERLAP BUG, PERFECTLY COMPACT) ───── */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: isMobile ? '0 0 16px' : '0 0 18px', marginBottom: 24 }}>
        <div className="container-main">

          {/* Row with Avatar & Main Header Info */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'center' : 'center',
            justifyContent: 'space-between',
            gap: isMobile ? 10 : 16,
            textAlign: isMobile ? 'center' : 'left',
          }}>

            {/* Left: Avatar (pulls up into banner) + Title + IG */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'center' : 'center',
              gap: isMobile ? 8 : 16,
            }}>
              {/* Logo Avatar - ONLY this element has negative marginTop to overlap banner nicely */}
              <div
                onClick={() => { if (isOwnerOfThisBrand) setShowEditModal(true) }}
                style={{
                  marginTop: isMobile ? -36 : -44,
                  width: isMobile ? 72 : 88,
                  height: isMobile ? 72 : 88,
                  borderRadius: '50%',
                  background: '#0F0926',
                  border: '3px solid #FFFFFF',
                  overflow: 'hidden',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: isMobile ? 26 : 34,
                  fontWeight: 900,
                  boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
                  position: 'relative',
                  cursor: isOwnerOfThisBrand ? 'pointer' : 'default',
                  zIndex: 2,
                }}
                title={isOwnerOfThisBrand ? 'Klik untuk ganti logo brand' : brand.name}
              >
                {logoImg ? (
                  <img src={logoImg} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  brand.name.charAt(0)
                )}
                {isOwnerOfThisBrand && (
                  <div
                    style={{
                      position: 'absolute', inset: 0, background: 'rgba(41,22,94,0.45)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                  >
                    <Edit3 size={18} color="#FFFFFF" />
                  </div>
                )}
              </div>

              {/* Title & IG (Rendered safely below banner on crisp white background!) */}
              <div style={{ paddingTop: isMobile ? 0 : 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                  <h1 style={{
                    fontSize: isMobile ? 20 : 24,
                    fontWeight: 900,
                    color: '#29165E',
                    lineHeight: '1.2',
                    margin: 0,
                  }}>
                    {brand.name}
                  </h1>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    background: '#DCFCE7', color: '#15803D',
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                  }}>
                    <Sparkles size={10} /> Official
                  </span>
                  {brand.category && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      background: '#F1F5F9', color: '#475569',
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    }}>
                      {brand.category}
                    </span>
                  )}
                </div>

                {brand.instagram && (
                  <a
                    href={`https://instagram.com/${brand.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 12, color: '#5E4C92', fontWeight: 600,
                      marginTop: 3, textDecoration: 'none',
                    }}
                  >
                    <Instagram size={12} /> {brand.instagram}
                  </a>
                )}
              </div>
            </div>

            {/* Right: Stats Counter Chips + Owner Edit Button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 8 : 12,
              flexWrap: 'wrap',
              justifyContent: isMobile ? 'center' : 'flex-end',
              paddingTop: isMobile ? 0 : 8,
            }}>
              <div style={{
                display: 'flex', gap: 10,
                background: '#F8FAFC', border: '1px solid #E2E8F0',
                padding: '6px 14px', borderRadius: 999,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#29165E', display: 'block', lineHeight: 1 }}>{totalDrops}</span>
                  <span style={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Drops</span>
                </div>
                <div style={{ width: 1, background: '#CBD5E1' }} />
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#15803D', display: 'block', lineHeight: 1 }}>{liveDropsCount}</span>
                  <span style={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Live</span>
                </div>
                <div style={{ width: 1, background: '#CBD5E1' }} />
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#29165E', display: 'block', lineHeight: 1 }}>{totalProducts}</span>
                  <span style={{ fontSize: 9, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>Produk</span>
                </div>
              </div>

              {isOwnerOfThisBrand && (
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="btn-navy"
                  style={{
                    height: 32, padding: '0 12px', fontSize: 11, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Edit3 size={12} /> Edit Profil
                </button>
              )}
            </div>

          </div>

          {/* Brand Bio Description */}
          {brand.description && (
            <p style={{
              margin: '10px 0 0',
              fontSize: 13,
              color: '#475569',
              lineHeight: '20px',
              maxWidth: 760,
              textAlign: isMobile ? 'center' : 'left',
            }}>
              {brand.description}
            </p>
          )}

        </div>
      </div>

      {/* ── MAIN CONTENT CONTAINER ─────────────────────────────────── */}
      <div className="container-main">

        {/* ── 1. LIVE & UPCOMING DROPS SECTION ─────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={15} color="#D97706" fill="#D97706" />
              </div>
              <h2 style={{ fontSize: isMobile ? 17 : 19, fontWeight: 900, color: '#29165E', margin: 0 }}>
                Rilisan Drop Eksklusif
              </h2>
            </div>
            {isOwnerOfThisBrand && (
              <Link to="/dashboard" style={{ fontSize: 12, color: '#29165E', fontWeight: 700, textDecoration: 'none' }}>
                + Buat Drop di Dashboard →
              </Link>
            )}
          </div>

          {liveUpcomingDrops.length === 0 ? (
            <div style={{
              background: '#FFFFFF', padding: '32px 20px', borderRadius: 8,
              border: '1px solid #E2E8F0', textAlign: 'center',
            }}>
              <Zap size={28} color="#94A3B8" style={{ margin: '0 auto 6px' }} />
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#29165E', margin: '0 0 2px' }}>Belum Ada Drop yang Sedang Berjalan</h4>
              <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Nantikan jadwal perilisan edisi terbatas berikutnya dari brand ini.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 16 }}>
              {liveUpcomingDrops.map(drop => {
                const status = getComputedStatus(drop)
                const slotPercentage = Math.min((drop.reserved_count / drop.total_slots) * 100, 100)
                const isSoldOut = drop.reserved_count >= drop.total_slots
                return (
                  <Link key={drop.id} to={`/drops/${drop.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div
                      style={{
                        background: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0',
                        overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-3px)'
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
                      }}
                    >
                      {/* Card Banner */}
                      <div style={{
                        height: isMobile ? 130 : 150,
                        background: drop.banner_url ? `url(${drop.banner_url}) center/cover` : 'linear-gradient(135deg, #29165E, #5E4C92)',
                        position: 'relative',
                      }}>
                        <div style={{
                          position: 'absolute', top: 10, right: 10,
                          background: status === 'live' ? '#DCFCE7' : '#E7E3FF',
                          color: status === 'live' ? '#15803D' : '#5E4C92',
                          padding: '3px 8px', borderRadius: 999,
                          fontSize: 10, fontWeight: 800,
                          display: 'flex', alignItems: 'center', gap: 4,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'live' ? '#22C55E' : '#5E4C92' }} />
                          {status === 'live' ? 'LIVE' : 'UPCOMING'}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div style={{ padding: '12px 14px' }}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: '#29165E', marginBottom: 4, lineHeight: '18px' }}>
                          {drop.title}
                        </h3>
                        <div style={{ fontSize: 14, fontWeight: 900, color: '#29165E', marginBottom: 10 }}>
                          {formatRupiah(drop.price)}
                        </div>

                        {/* Slot Bar */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: '#64748B' }}>
                            <span>Slot Terpesan</span>
                            <span style={{ fontWeight: 700, color: isSoldOut ? '#D32F2F' : '#29165E' }}>
                              {drop.reserved_count} / {drop.total_slots}
                            </span>
                          </div>
                          <div style={{ height: 5, background: '#F1F5F9', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${slotPercentage}%`,
                              background: slotPercentage >= 90 ? '#D32F2F' : '#29165E',
                              borderRadius: 999,
                            }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* ── 2. PAST DROPS (Collapsible Accordion) ─────────────────── */}
        {pastDrops.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div
              onClick={() => setShowPastDrops(!showPastDrops)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', padding: '12px 16px', background: '#FFFFFF',
                borderRadius: 8, border: '1px solid #E2E8F0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={16} color="#64748B" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: 0 }}>
                  Rilisan Terdahulu / Selesai ({pastDrops.length})
                </h3>
              </div>
              {showPastDrops ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
            </div>

            {showPastDrops && (
              <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, marginTop: 12 }}>
                {pastDrops.map(drop => (
                  <Link key={drop.id} to={`/drops/${drop.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{
                      background: '#FFFFFF', borderRadius: 6, border: '1px solid #E2E8F0',
                      display: 'flex', alignItems: 'center', padding: 10, gap: 12,
                    }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 4,
                        background: drop.banner_url ? `url(${drop.banner_url}) center/cover` : '#E2E8F0',
                        flexShrink: 0,
                      }} />
                      <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#29165E', margin: '0 0 2px' }}>{drop.title}</h4>
                        <span style={{ fontSize: 10, background: '#F1F5F9', color: '#64748B', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          ENDED
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 3. PRODUCTS CATALOG GRID ──────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: '#E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Tag size={15} color="#3730A3" />
              </div>
              <h2 style={{ fontSize: isMobile ? 17 : 19, fontWeight: 900, color: '#29165E', margin: 0 }}>
                Koleksi Produk Brand
              </h2>
            </div>
            {isOwnerOfThisBrand && (
              <Link to="/dashboard" style={{ fontSize: 12, color: '#29165E', fontWeight: 700, textDecoration: 'none' }}>
                + Tambah Produk di Dashboard →
              </Link>
            )}
          </div>

          {products.length === 0 ? (
            <div style={{
              background: '#FFFFFF', padding: '32px 20px', borderRadius: 8,
              border: '1px solid #E2E8F0', textAlign: 'center',
            }}>
              <Package size={28} color="#94A3B8" style={{ margin: '0 auto 6px' }} />
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#29165E', margin: '0 0 2px' }}>Belum Ada Produk Terdaftar</h4>
              <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Katalog produk resmi dari brand ini belum ditambahkan.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: productGridCols, gap: 12 }}>
              {products.map(product => (
                <div key={product.id} style={{
                  background: '#FFFFFF', borderRadius: 8, border: '1px solid #E2E8F0',
                  overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                }}>
                  <div style={{
                    height: isMobile ? 120 : 150,
                    background: product.image_url ? `url(${product.image_url}) center/cover` : '#F1F5F9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {!product.image_url && <Package size={26} color="#CBD5E1" />}
                  </div>

                  <div style={{ padding: '10px 12px' }}>
                    {product.category && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: '#5E4C92',
                        textTransform: 'uppercase', marginBottom: 3, display: 'block',
                      }}>
                        {product.category}
                      </span>
                    )}
                    <h4 style={{
                      fontSize: 13, fontWeight: 700, color: '#1E293B',
                      marginBottom: 4, lineHeight: '16px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {product.name}
                    </h4>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#29165E' }}>
                      {formatRupiah(product.price)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── MODAL EDIT PROFIL & ASSETS BRAND ─────────────────────────── */}
      {showEditModal && (
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
              onClick={() => { setShowEditModal(false); setEditMessage(null); }}
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

            {editMessage && (
              <div style={{
                padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13,
                background: editMessage.type === 'success' ? '#DCFCE7' : '#FEE2E2',
                color: editMessage.type === 'success' ? '#15803D' : '#B91C1C',
                border: `1px solid ${editMessage.type === 'success' ? '#86EFAC' : '#F87171'}`,
              }}>
                {editMessage.text}
              </div>
            )}

            <form onSubmit={handleSaveBrandProfile}>
              {/* Logo Upload */}
              <div style={{ marginBottom: 18 }}>
                <ImageUpload
                  bucket="brand-assets"
                  folder="logos"
                  currentUrl={editForm.logo_url}
                  onUpload={(url) => setEditForm(prev => ({ ...prev, logo_url: url }))}
                  label="Logo Brand (Avatar Lingkaran)"
                  aspectHint="1:1 (Persegi)"
                />
              </div>

              {/* Banner Upload */}
              <div style={{ marginBottom: 18 }}>
                <ImageUpload
                  bucket="brand-assets"
                  folder="banners"
                  currentUrl={editForm.banner_url}
                  onUpload={(url) => setEditForm(prev => ({ ...prev, banner_url: url }))}
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
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              {/* Instagram */}
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Instagram Handle</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="@brandkamu"
                  value={editForm.instagram}
                  onChange={e => setEditForm({ ...editForm, instagram: e.target.value })}
                />
              </div>

              {/* Category / Niche */}
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Kategori / Niche Brand</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Contoh: Streetwear & Apparel, Vinyl Records, Artisan Coffee"
                  value={editForm.category}
                  onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                />
              </div>

              {/* Description / Bio */}
              <div style={{ marginBottom: 24 }}>
                <label className="input-label">Deskripsi / Bio Brand</label>
                <textarea
                  rows={3}
                  className="input-field"
                  placeholder="Ceritakan tentang filosofi brand dan produk unik kamu..."
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-ghost"
                  style={{ flex: 1, height: 44 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingBrand}
                  className="btn-navy"
                  style={{ flex: 2, height: 44, fontSize: 13, fontWeight: 700 }}
                >
                  {savingBrand ? 'Menyimpan Perubahan...' : 'Simpan Profil Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
