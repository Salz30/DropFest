import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Instagram, ArrowRight, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Brand, Drop } from '../types'
import { useBreakpoint } from '../hooks/useBreakpoint'

interface BrandWithDropCount extends Brand {
  total_drops: number
  active_drops: number
}

export default function BrandsPage() {
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'
  const isTabletDown = bp === 'mobile' || bp === 'tablet'

  const [brands, setBrands] = useState<BrandWithDropCount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchBrands() {
      setLoading(true)
      try {
        const { data: brandsData, error } = await supabase
          .from('brands')
          .select('*')
          .order('name', { ascending: true })

        if (!error && brandsData) {
          const { data: dropsData } = await supabase
            .from('drops')
            .select('*')

          const dropsList = (dropsData || []) as Drop[]
          const enriched: BrandWithDropCount[] = (brandsData as Brand[]).map(b => {
            const bDrops = dropsList.filter(d => d.brand_id === b.id)
            return {
              ...b,
              total_drops: bDrops.length,
              active_drops: bDrops.filter(d => d.status === 'live').length,
            }
          })
          setBrands(enriched)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchBrands()
  }, [])

  const filteredBrands = brands.filter(b => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return b.name.toLowerCase().includes(q) ||
      (b.description && b.description.toLowerCase().includes(q)) ||
      (b.category && b.category.toLowerCase().includes(q))
  })

  const gridCols = isMobile ? '1fr' : isTabletDown ? '1fr 1fr' : 'repeat(3, 1fr)'

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '80vh', padding: isMobile ? '32px 0 60px' : '48px 0 80px' }}>
      <div className="container-main">

        {/* ── HEADER ────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#5E4C92', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
            Kolektif Kreatif
          </p>
          <h1 style={{ fontSize: isMobile ? 28 : 40, fontWeight: 900, color: '#29165E', marginBottom: 10 }}>
            Indie Brands di DropFest
          </h1>
          <p style={{ fontSize: 15, color: '#666666', maxWidth: 520 }}>
            Jelajahi brand streetwear, label rekaman vinyl, artisan roastery, dan kreator independen lainnya.
          </p>
        </div>

        {/* ── SEARCH BAR ────────────────────────────────────── */}
        <div style={{ position: 'relative', maxWidth: 400, marginBottom: 32 }}>
          <Search size={16} color="#75797C" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Cari nama brand atau kategori..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 38 }}
          />
        </div>

        {/* ── BRANDS GRID ───────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 24 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ background: '#FFFFFF', borderRadius: 6, border: '1px solid #D9D9D9', padding: 24 }}>
                <div style={{ width: 52, height: 52, borderRadius: 8, background: '#F5F6F7', marginBottom: 16 }} />
                <div style={{ height: 16, background: '#F5F6F7', width: '60%', marginBottom: 10 }} />
                <div style={{ height: 12, background: '#F5F6F7', width: '90%' }} />
              </div>
            ))}
          </div>
        ) : filteredBrands.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 20px', background: '#F5F6F7', borderRadius: 8 }}>
            <p style={{ fontSize: 15, color: '#666666' }}>Tidak ada brand yang sesuai dengan pencarianmu.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 24 }}>
            {filteredBrands.map(brand => (
              <div key={brand.id} style={{
                background: '#FFFFFF', borderRadius: 6,
                border: '1px solid #D9D9D9',
                boxShadow: 'rgba(0,0,0,0.06) 0px 4px 16px -4px',
                padding: '24px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
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
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{
                      width: 54, height: 54, borderRadius: 10,
                      background: '#0F0926', color: '#FFFFFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, fontWeight: 900, overflow: 'hidden',
                      border: '1px solid #E2E8F0', flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}>
                      {brand.logo_url || (brand.slug === 'void-division' ? '/void_logo.jpg' : null) ? (
                        <img
                          src={brand.logo_url || (brand.slug === 'void-division' ? '/void_logo.jpg' : '')}
                          alt={brand.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        brand.name.charAt(0)
                      )}
                    </div>
                    {brand.active_drops > 0 && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: '#DCFCE7', color: '#15803D',
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E' }} />
                        {brand.active_drops} DROP LIVE
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#29165E', margin: 0 }}>
                      {brand.name}
                    </h3>
                    {brand.category && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#5E4C92',
                        background: '#F0F3FF', padding: '2px 8px', borderRadius: 999,
                        border: '1px solid #E0E7FF',
                      }}>
                        {brand.category}
                      </span>
                    )}
                  </div>

                  {brand.instagram && (
                    <p style={{ fontSize: 12, color: '#5E4C92', fontWeight: 600, margin: '4px 0 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Instagram size={13} /> {brand.instagram}
                    </p>
                  )}

                  <p style={{ fontSize: 13, color: '#666666', lineHeight: '20px', marginBottom: 20 }}>
                    {brand.description || 'Brand independen berkualitas dengan rilisan terbatas.'}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid #F5F6F7', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#666666' }}>
                    Total: <strong>{brand.total_drops} Rilisan</strong>
                  </span>
                  <Link
                    to={`/brands/${brand.slug}`}
                    style={{ fontSize: 12, fontWeight: 700, color: '#29165E', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    Lihat Profil <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
