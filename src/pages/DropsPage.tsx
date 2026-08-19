import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Clock, Zap, ArrowUpDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Drop, Brand } from '../types'
import { useBreakpoint } from '../hooks/useBreakpoint'

interface DropWithBrand extends Drop {
  brand: Brand
}

type FilterStatus = 'all' | 'live' | 'scheduled' | 'ended'

function getComputedStatus(drop: Drop): 'scheduled' | 'live' | 'ended' {
  const now = new Date()
  const starts = new Date(drop.starts_at)
  const ends = drop.ends_at ? new Date(drop.ends_at) : null
  if (drop.status === 'cancelled') return 'ended'
  if (now < starts) return 'scheduled'
  if (ends && now > ends) return 'ended'
  return 'live'
}

function formatTimeLeft(endsAt: string | null): string {
  if (!endsAt) return 'Tanpa batas'
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'Berakhir'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}h ${hours}j lagi`
  const mins = Math.floor((diff % 3600000) / 60000)
  return `${hours}j ${mins}m lagi`
}

function formatCountdown(startsAt: string): string {
  const diff = new Date(startsAt).getTime() - Date.now()
  if (diff <= 0) return 'Segera rilis'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}h ${hours}j lagi`
  return `${hours}j lagi`
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function StatusBadge({ status }: { status: string }) {
  const s: Record<string, { bg: string; color: string; dot: string; label: string }> = {
    live: { bg: '#DCFCE7', color: '#15803D', dot: '#22C55E', label: 'LIVE' },
    scheduled: { bg: '#E7E3FF', color: '#5E4C92', dot: '#5E4C92', label: 'SEGERA' },
    ended: { bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF', label: 'SELESAI' },
  }
  const style = s[status] || s.ended
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: style.bg, color: style.color,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
      padding: '3px 8px', borderRadius: 999,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: style.dot, display: 'inline-block' }} />
      {style.label}
    </span>
  )
}

function SlotBar({ reserved, total }: { reserved: number; total: number }) {
  const pct = Math.min((reserved / total) * 100, 100)
  const left = total - reserved
  const color = pct >= 90 ? '#D32F2F' : pct >= 60 ? '#B45309' : '#15803D'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#666666' }}>{left} slot tersisa</span>
        <span style={{ fontSize: 11, color: '#666666' }}>{reserved}/{total}</span>
      </div>
      <div style={{ height: 4, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

export default function DropsPage() {
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'
  const isTabletDown = bp === 'mobile' || bp === 'tablet'

  const [searchParams, setSearchParams] = useSearchParams()
  const initialStatus = (searchParams.get('status') as FilterStatus) || 'all'

  const [drops, setDrops] = useState<DropWithBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>(initialStatus)
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high'>('newest')

  useEffect(() => {
    async function fetchDrops() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('drops')
          .select('*, brand:brands(*)')
          .order('starts_at', { ascending: false })

        if (!error && data) {
          setDrops(data as DropWithBrand[])
        }
      } finally {
        setLoading(false)
      }
    }
    fetchDrops()
  }, [])

  const handleStatusChange = (status: FilterStatus) => {
    setStatusFilter(status)
    if (status === 'all') {
      searchParams.delete('status')
    } else {
      searchParams.set('status', status)
    }
    setSearchParams(searchParams)
  }

  // Filter & Sort Logic
  const filteredDrops = drops.filter(drop => {
    const computedStatus = getComputedStatus(drop)
    if (statusFilter !== 'all' && computedStatus !== statusFilter) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchTitle = drop.title.toLowerCase().includes(q)
      const matchBrand = drop.brand?.name?.toLowerCase().includes(q)
      const matchDesc = drop.description?.toLowerCase().includes(q)
      if (!matchTitle && !matchBrand && !matchDesc) return false
    }

    return true
  }).sort((a, b) => {
    if (sortBy === 'price_low') return a.price - b.price
    if (sortBy === 'price_high') return b.price - a.price
    return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
  })

  const gridCols = isMobile ? '1fr' : isTabletDown ? '1fr 1fr' : 'repeat(3, 1fr)'

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '80vh', padding: isMobile ? '32px 0 64px' : '48px 0 80px' }}>
      <div className="container-main">

        {/* ── HEADER ────────────────────────────────────────── */}
        <div style={{ marginBottom: isMobile ? 24 : 36 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#5E4C92', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
            Katalog Rilis
          </p>
          <h1 style={{ fontSize: isMobile ? 28 : 40, fontWeight: 900, color: '#29165E', marginBottom: 10 }}>
            Semua Drop Produk
          </h1>
          <p style={{ fontSize: 15, color: '#666666', maxWidth: 520 }}>
            Koleksi eksklusif dengan kuota terbatas dari berbagai brand indie lokal pilihan.
          </p>
        </div>

        {/* ── SEARCH & FILTER CONTROLS ──────────────────────── */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 16,
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          marginBottom: 32,
          padding: isMobile ? '16px' : '20px',
          background: '#F5F6F7',
          borderRadius: 8,
          border: '1px solid #D9D9D9',
        }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1', maxWidth: isMobile ? '100%' : 380 }}>
            <Search size={16} color="#75797C" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Cari judul drop atau nama brand..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: 38, background: '#FFFFFF' }}
            />
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: isMobile ? 4 : 0 }}>
            {[
              { id: 'all', label: 'Semua' },
              { id: 'live', label: 'Sedang Live' },
              { id: 'scheduled', label: 'Segera Hadir' },
              { id: 'ended', label: 'Selesai' },
            ].map(tab => {
              const active = statusFilter === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleStatusChange(tab.id as FilterStatus)}
                  style={{
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    borderRadius: 999,
                    border: active ? '1px solid #29165E' : '1px solid #D9D9D9',
                    background: active ? '#29165E' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#3D464D',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowUpDown size={15} color="#666666" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              style={{
                padding: '8px 12px',
                fontSize: 13,
                color: '#3D464D',
                background: '#FFFFFF',
                border: '1px solid #D9D9D9',
                borderRadius: 4,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="newest">Terbaru</option>
              <option value="price_low">Harga: Terendah</option>
              <option value="price_high">Harga: Tertinggi</option>
            </select>
          </div>
        </div>

        {/* ── DROPS GRID ────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: isMobile ? 16 : 24 }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ background: '#FFFFFF', borderRadius: 5, border: '1px solid #D9D9D9', overflow: 'hidden' }}>
                <div style={{ height: 180, background: 'linear-gradient(90deg, #F5F6F7 25%, #EBEBEB 50%, #F5F6F7 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                <div style={{ padding: '16px 20px 20px' }}>
                  <div style={{ height: 12, background: '#F5F6F7', borderRadius: 4, width: '35%', marginBottom: 8 }} />
                  <div style={{ height: 16, background: '#F5F6F7', borderRadius: 4, width: '75%', marginBottom: 12 }} />
                  <div style={{ height: 12, background: '#F5F6F7', borderRadius: 4, width: '90%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredDrops.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 20px', background: '#F5F6F7', borderRadius: 8, border: '1px dashed #D9D9D9' }}>
            <Zap size={44} color="#D9D9D9" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#29165E', marginBottom: 6 }}>Tidak Ada Drop Ditemukan</h3>
            <p style={{ fontSize: 14, color: '#666666', maxWidth: 360, margin: '0 auto 20px' }}>
              Coba sesuaikan kata kunci pencarian atau ubah filter status di atas.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
              style={{
                background: '#29165E', color: '#FFFFFF', fontSize: 13, fontWeight: 600,
                padding: '8px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
              }}
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: isMobile ? 16 : 24 }}>
            {filteredDrops.map(drop => {
              const status = getComputedStatus(drop)
              const isSoldOut = drop.reserved_count >= drop.total_slots

              return (
                <Link key={drop.id} to={`/drops/${drop.id}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                  <div style={{
                    background: '#FFFFFF', borderRadius: 5,
                    border: '1px solid #D9D9D9',
                    boxShadow: 'rgba(0,0,0,0.06) 0px 4px 16px -4px',
                    overflow: 'hidden', height: '100%',
                    display: 'flex', flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                    onMouseEnter={e => {
                      if (!isMobile) {
                        e.currentTarget.style.transform = 'translateY(-3px)'
                        e.currentTarget.style.boxShadow = 'rgba(41,22,94,0.12) 0px 12px 32px -8px'
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'rgba(0,0,0,0.06) 0px 4px 16px -4px'
                    }}
                  >
                    {/* Banner */}
                    <div style={{
                      height: 180, position: 'relative',
                      background: drop.banner_url
                        ? `url(${drop.banner_url}) center/cover`
                        : 'linear-gradient(135deg, #29165E 0%, #5E4C92 100%)',
                    }}>
                      {!drop.banner_url && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Zap size={36} color="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.2)" />
                        </div>
                      )}
                      <div style={{ position: 'absolute', top: 12, left: 12 }}>
                        <StatusBadge status={status} />
                      </div>
                      {isSoldOut && status === 'live' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 900, letterSpacing: '2px' }}>SOLD OUT</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ padding: '16px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontSize: 11, color: '#5E4C92', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {drop.brand?.name}
                        </p>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#29165E', marginBottom: 8, lineHeight: '22px' }}>
                          {drop.title}
                        </h3>
                        {drop.description && (
                          <p style={{ fontSize: 13, color: '#666666', lineHeight: '18px', marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {drop.description}
                          </p>
                        )}
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <span style={{ fontSize: 16, fontWeight: 900, color: '#29165E' }}>{formatRupiah(drop.price)}</span>
                          {status === 'live' && drop.ends_at && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666666' }}>
                              <Clock size={11} /> {formatTimeLeft(drop.ends_at)}
                            </span>
                          )}
                          {status === 'scheduled' && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#5E4C92' }}>
                              <Clock size={11} /> {formatCountdown(drop.starts_at)}
                            </span>
                          )}
                        </div>

                        {status !== 'ended' && <SlotBar reserved={drop.reserved_count} total={drop.total_slots} />}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
