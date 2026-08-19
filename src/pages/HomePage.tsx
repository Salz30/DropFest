import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock, Zap, Users, TrendingUp, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Drop, Brand } from '../types'
import { useBreakpoint } from '../hooks/useBreakpoint'

interface DropWithBrand extends Drop {
  brand: Brand
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

function formatTimeLeft(endsAt: string | null): string {
  if (!endsAt) return 'Tanpa batas'
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'Berakhir'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}h ${hours}j`
  const mins = Math.floor((diff % 3600000) / 60000)
  return `${hours}j ${mins}m lagi`
}

function formatCountdown(startsAt: string): string {
  const diff = new Date(startsAt).getTime() - Date.now()
  if (diff <= 0) return 'Segera'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  return `${days}h ${hours}j lagi`
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

function DropCard({ drop, isMobile }: { drop: DropWithBrand; isMobile: boolean }) {
  const status = getComputedStatus(drop)
  const isSoldOut = drop.reserved_count >= drop.total_slots

  return (
    <Link to={`/drops/${drop.id}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div style={{
        background: '#FFFFFF', borderRadius: 5,
        border: '1px solid #D9D9D9',
        boxShadow: 'rgba(0,0,0,0.06) 0px 4px 16px -4px',
        overflow: 'hidden', height: '100%',
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
          height: isMobile ? 160 : 180, position: 'relative',
          background: drop.banner_url
            ? `url(${drop.banner_url}) center/cover`
            : 'linear-gradient(135deg, #29165E 0%, #5E4C92 100%)',
        }}>
          {!drop.banner_url && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={36} color="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.2)" />
            </div>
          )}
          <div style={{ position: 'absolute', top: 10, left: 10 }}>
            <StatusBadge status={status} />
          </div>
          {isSoldOut && status === 'live' && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 900, letterSpacing: '2px' }}>SOLD OUT</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: isMobile ? '14px 16px 16px' : '16px 20px 20px' }}>
          <p style={{ fontSize: 10, color: '#5E4C92', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {drop.brand.name}
          </p>
          <h3 style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: '#29165E', marginBottom: 8, lineHeight: '20px' }}>
            {drop.title}
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: isMobile ? 15 : 16, fontWeight: 900, color: '#29165E' }}>{formatRupiah(drop.price)}</span>
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
    </Link>
  )
}

function DropCardSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 5, border: '1px solid #D9D9D9', overflow: 'hidden' }}>
      <div style={{ height: isMobile ? 160 : 180, background: 'linear-gradient(90deg, #F5F6F7 25%, #EBEBEB 50%, #F5F6F7 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
      <div style={{ padding: isMobile ? '14px 16px' : '16px 20px' }}>
        <div style={{ height: 10, background: '#F5F6F7', borderRadius: 4, width: '35%', marginBottom: 8 }} />
        <div style={{ height: 14, background: '#F5F6F7', borderRadius: 4, width: '70%', marginBottom: 10 }} />
        <div style={{ height: 10, background: '#F5F6F7', borderRadius: 4, width: '90%' }} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
export default function HomePage() {
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'
  const isTabletDown = bp === 'mobile' || bp === 'tablet'

  const [liveDrops, setLiveDrops] = useState<DropWithBrand[]>([])
  const [upcomingDrops, setUpcomingDrops] = useState<DropWithBrand[]>([])
  const [featuredDrop, setFeaturedDrop] = useState<DropWithBrand | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ brands: 0, drops: 0 })

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('drops')
          .select('*, brand:brands(*)')
          .in('status', ['live', 'scheduled'])
          .order('starts_at', { ascending: true })

        if (data) {
          const live = data.filter(d => getComputedStatus(d as Drop) === 'live') as DropWithBrand[]
          const upcoming = data.filter(d => getComputedStatus(d as Drop) === 'scheduled') as DropWithBrand[]
          setLiveDrops(live)
          setUpcomingDrops(upcoming)
          if (live.length > 0) {
            setFeaturedDrop([...live].sort((a, b) => b.reserved_count - a.reserved_count)[0])
          }
        }

        const [{ count: bc }, { count: dc }] = await Promise.all([
          supabase.from('brands').select('*', { count: 'exact', head: true }),
          supabase.from('drops').select('*', { count: 'exact', head: true }).eq('status', 'live'),
        ])
        setStats({ brands: bc || 0, drops: dc || 0 })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Responsive grid
  const dropsGrid = isMobile ? '1fr' : isTabletDown ? '1fr 1fr' : 'repeat(3, 1fr)'
  const sectionPadding = isMobile ? '40px 0' : '64px 0'

  return (
    <div style={{ backgroundColor: '#FFFFFF' }}>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(160deg, #F0F3FF 0%, #FFFFFF 60%)',
        padding: isMobile ? '40px 0 36px' : '64px 0 52px',
      }}>
        <div className="container-main">
          {/* On mobile: stacked. On desktop: 2-col if featured drop exists */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: (!isMobile && featuredDrop) ? '1fr 1fr' : '1fr',
            gap: isMobile ? 32 : 48,
            alignItems: 'center',
          }}>
            {/* Copy */}
            <div>
              <div style={{ marginBottom: 14 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#E7E3FF', color: '#29165E',
                  fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 999,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                  {stats.drops} Drop Aktif Sekarang
                </span>
              </div>

              <h1 style={{
                fontSize: isMobile ? 30 : isTabletDown ? 40 : 52,
                fontWeight: 900, color: '#29165E',
                lineHeight: 1.1, marginBottom: 14,
              }}>
                Produk Terbatas.<br />Pre-Order Mudah.
              </h1>

              <p style={{ fontSize: isMobile ? 14 : 16, color: '#666666', lineHeight: '26px', marginBottom: 28, maxWidth: 420 }}>
                Temukan drop eksklusif dari brand indie Indonesia — streetwear, vinyl, sneakers, kopi, dan lebih banyak lagi.
              </p>

              <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap' }}>
                <Link to="/drops" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#29165E', color: '#FFFFFF', fontSize: 14, fontWeight: 600,
                  padding: '0 24px', height: 48, borderRadius: 999, textDecoration: 'none',
                  width: isMobile ? '100%' : 'auto',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1A0F3D')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#29165E')}
                >
                  Lihat Semua Drops <ArrowRight size={15} />
                </Link>
                <Link to="/track-order" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#FFFFFF', color: '#3D464D', fontSize: 14,
                  border: '1px solid #D9D9D9', padding: '0 24px', height: 48, borderRadius: 999,
                  textDecoration: 'none', width: isMobile ? '100%' : 'auto',
                }}>
                  Cek Pesanan Saya
                </Link>
              </div>
            </div>

            {/* Featured Drop — show below on mobile */}
            {featuredDrop && (
              <div>
                {isMobile && (
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                    ⭐ Drop Terpopuler
                  </p>
                )}
                {!isMobile && (
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                    ⭐ Drop Terpopuler
                  </p>
                )}
                <Link to={`/drops/${featuredDrop.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{
                    background: 'rgb(19,0,65)', borderRadius: 8, overflow: 'hidden',
                    boxShadow: 'rgba(41,22,94,0.25) 0px 20px 48px -12px',
                  }}>
                    <div style={{ height: isMobile ? 140 : 180, background: featuredDrop.banner_url ? `url(${featuredDrop.banner_url}) center/cover` : 'linear-gradient(135deg, #29165E, #5E4C92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {!featuredDrop.banner_url && <Zap size={40} color="rgba(255,255,255,0.15)" fill="rgba(255,255,255,0.15)" />}
                    </div>
                    <div style={{ padding: isMobile ? '16px 18px' : '20px 24px' }}>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>{featuredDrop.brand.name}</p>
                      <h3 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 900, color: '#FFFFFF', marginBottom: 10 }}>{featuredDrop.title}</h3>
                      <SlotBar reserved={featuredDrop.reserved_count} total={featuredDrop.total_slots} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                        <span style={{ fontSize: isMobile ? 16 : 20, fontWeight: 900, color: '#FFFFFF' }}>{formatRupiah(featuredDrop.price)}</span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: '#FFFFFF', color: '#29165E', fontSize: 12, fontWeight: 600,
                          padding: '0 14px', height: 34, borderRadius: 999,
                        }}>
                          Pre-Order <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────────── */}
      <section style={{ background: '#F5F6F7', borderTop: '1px solid #D9D9D9', borderBottom: '1px solid #D9D9D9' }}>
        <div className="container-main" style={{ padding: isMobile ? '16px' : '20px 40px' }}>
          <div style={{ display: 'flex', gap: isMobile ? 20 : 40, flexWrap: 'wrap', alignItems: 'center', justifyContent: isMobile ? 'space-around' : 'flex-start' }}>
            {[
              { icon: Zap, label: `${stats.drops} Drop Live` },
              { icon: Users, label: `${stats.brands} Brand Aktif` },
              { icon: TrendingUp, label: '10K+ Pre-Order' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <item.icon size={16} color="#29165E" />
                <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: '#29165E' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE DROPS ─────────────────────────────────────── */}
      <section style={{ padding: sectionPadding }}>
        <div className="container-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: isMobile ? 20 : 28 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#5E4C92', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Sedang Live</p>
              <h2 style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#29165E' }}>Drop Aktif Sekarang</h2>
            </div>
            <Link to="/drops" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#29165E', textDecoration: 'none', fontWeight: 500, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              Lihat semua <ChevronRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: dropsGrid, gap: isMobile ? 12 : 20 }}>
              {[1, 2, 3].map(i => <DropCardSkeleton key={i} isMobile={isMobile} />)}
            </div>
          ) : liveDrops.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#666666' }}>
              <Zap size={36} color="#D9D9D9" style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 14 }}>Belum ada drop aktif saat ini.</p>
              <p style={{ fontSize: 12, marginTop: 4, color: '#999' }}>Cek lagi nanti atau lihat drop yang akan datang!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: dropsGrid, gap: isMobile ? 12 : 20 }}>
              {liveDrops.map(drop => <DropCard key={drop.id} drop={drop} isMobile={isMobile} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── UPCOMING DROPS ─────────────────────────────────── */}
      {(loading || upcomingDrops.length > 0) && (
        <section style={{ padding: `0 0 ${isMobile ? 40 : 64}px` }}>
          <div className="container-main">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: isMobile ? 20 : 28 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#5E4C92', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Segera Hadir</p>
                <h2 style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: '#29165E' }}>Drop yang Akan Datang</h2>
              </div>
              <Link to="/drops?status=scheduled" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#29165E', textDecoration: 'none', fontWeight: 500, flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                Lihat semua <ChevronRight size={14} />
              </Link>
            </div>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: dropsGrid, gap: isMobile ? 12 : 20 }}>
                {[1, 2].map(i => <DropCardSkeleton key={i} isMobile={isMobile} />)}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: dropsGrid, gap: isMobile ? 12 : 20 }}>
                {upcomingDrops.slice(0, isMobile ? 2 : 3).map(drop => <DropCard key={drop.id} drop={drop} isMobile={isMobile} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── CTA FOR BRANDS ─────────────────────────────────── */}
      <section style={{ padding: `0 0 ${isMobile ? 40 : 80}px` }}>
        <div className="container-main">
          <div style={{
            background: 'rgb(19,0,65)', borderRadius: 8,
            padding: isMobile ? '28px 20px' : '36px 48px',
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
            gap: 20,
          }}>
            <div>
              <h3 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, color: '#FFFFFF', marginBottom: 6 }}>Kamu punya brand?</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', maxWidth: 360 }}>
                Mulai rilis drop pertamamu di DropFest — gratis, mudah, dan profesional.
              </p>
            </div>
            <Link to="/auth?mode=register" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#FFFFFF', color: '#29165E', fontSize: 13, fontWeight: 700,
              padding: '0 22px', height: 44, borderRadius: 999, textDecoration: 'none',
              flexShrink: 0, width: isMobile ? '100%' : 'auto',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0F3FF')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
            >
              Daftarkan Brand <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
