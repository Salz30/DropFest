import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Menu, X, Zap, LayoutDashboard, LogOut,
  Store, Package, Flame, Globe, Building2
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const { user, brand, isDemoMode, signOut } = useAuth()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [location])

  const isActive = (to: string) => {
    if (to === '/dashboard') return location.pathname === '/dashboard'
    if (to === '/brands') return location.pathname === '/brands'
    if (to.startsWith('/brands/')) return location.pathname === to
    if (to === '/drops') return location.pathname === '/drops' || location.pathname.startsWith('/drops/')
    return location.pathname === to
  }

  // --- Brand Owner Nav Links ---
  const ownerNavLinks = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    ...(brand?.slug ? [{ label: 'Profil Brand Publik', to: `/brands/${brand.slug}`, icon: Store }] : []),
    { label: 'Semua Drops', to: '/drops', icon: Flame },
    { label: 'Katalog Brand', to: '/brands', icon: Building2 },
  ]

  // --- Customer / Guest Nav Links ---
  const customerNavLinks = [
    { label: 'Drops', to: '/drops', icon: Flame },
    { label: 'Brands', to: '/brands', icon: Building2 },
    { label: 'Cek Pesanan Saya', to: '/track-order', icon: Package },
  ]

  const activeLinks = user ? ownerNavLinks : customerNavLinks

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 102 }}>
      {/* ── TOP ROLE BANNER (Only for Brand Owner) ──────────── */}
      {user && (
        <div style={{
          background: 'linear-gradient(90deg, #1A0F3D 0%, #29165E 100%)',
          color: '#FFFFFF',
          fontSize: 11,
          fontWeight: 600,
          padding: '4px 0',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div className="container-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                background: isDemoMode ? '#FBBF24' : '#86EFAC',
                color: '#1A0F3D',
                fontSize: 9,
                fontWeight: 900,
                padding: '1px 6px',
                borderRadius: 999,
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}>
                {isDemoMode ? '👑 Mode Demo Owner' : '👑 Mode Brand Owner'}
              </span>
              <span>
                Sedang mengelola: <strong>{brand?.name || 'Brand Anda'}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {brand?.slug && (
                <Link
                  to={`/brands/${brand.slug}`}
                  style={{ color: '#E7E3FF', fontSize: 11, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#E7E3FF')}
                >
                  <Globe size={11} /> Lihat Tampilan Publik Brand →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN NAVBAR ─────────────────────────────────────── */}
      <nav
        style={{
          backgroundColor: user ? '#FFFFFF' : 'rgba(255,255,255,0.96)',
          borderBottom: '1px solid #D9D9D9',
          backdropFilter: 'blur(8px)',
          boxShadow: scrolled ? 'rgba(0,0,0,0.06) 0px 2px 8px' : 'none',
          transition: 'box-shadow 0.2s ease',
        }}
      >
        <div className="container-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          {/* Logo & Role Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: '#29165E',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(41,22,94,0.3)',
              }}>
                <Zap size={18} color="#FFFFFF" fill="#FFFFFF" />
              </div>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#29165E', letterSpacing: '-0.3px' }}>
                DropFest
              </span>
            </Link>

            {/* If Brand Owner, show brand badge separator */}
            {user && brand && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="hidden-mobile">
                <span style={{ color: '#CBD5E1', fontSize: 18 }}>/</span>
                <Link
                  to="/dashboard"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '3px 10px', background: '#F5F6F7', border: '1px solid #E2E8F0',
                    borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#29165E',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 999, background: '#0F0926',
                    color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 900, overflow: 'hidden', flexShrink: 0,
                  }}>
                    {brand.logo_url || (brand.slug === 'void-division' ? '/void_logo.jpg' : null) ? (
                      <img src={brand.logo_url || (brand.slug === 'void-division' ? '/void_logo.jpg' : '')} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      brand.name.charAt(0)
                    )}
                  </div>
                  <span>{brand.name}</span>
                </Link>
              </div>
            )}
          </div>

          {/* Desktop Nav Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }} className="hidden-mobile">
            {activeLinks.map(link => {
              const active = isActive(link.to)
              const Icon = link.icon
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: '100%',
                    padding: '0 14px',
                    fontSize: 13,
                    color: active ? '#29165E' : '#475569',
                    textDecoration: 'none',
                    fontWeight: active ? 700 : 500,
                    borderBottom: active ? '3px solid #29165E' : '3px solid transparent',
                    transition: 'color 0.15s ease, border-color 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#29165E'
                    if (!active) e.currentTarget.style.borderBottomColor = 'rgba(41,22,94,0.2)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = active ? '#29165E' : '#475569'
                    if (!active) e.currentTarget.style.borderBottomColor = 'transparent'
                  }}
                >
                  <Icon size={14} color={active ? '#29165E' : '#64748B'} />
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Desktop Right CTA / Action Area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="hidden-mobile">
            {user ? (
              /* --- Brand Owner Actions --- */
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link
                  to="/dashboard"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    height: 36, padding: '0 14px', borderRadius: 999,
                    background: location.pathname === '/dashboard' ? '#1A0F3D' : '#29165E',
                    color: '#FFFFFF',
                    fontSize: 13, fontWeight: 700, textDecoration: 'none',
                    boxShadow: '0 2px 6px rgba(41,22,94,0.2)',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <LayoutDashboard size={14} /> Buka Dashboard
                </Link>

                <button
                  onClick={() => signOut()}
                  style={{
                    height: 36, padding: '0 12px', background: '#FFF1F2',
                    border: '1px solid #FECDD3', borderRadius: 999,
                    color: '#E11D48', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                  title="Keluar dari akun Brand Owner"
                >
                  <LogOut size={13} /> Keluar
                </button>
              </div>
            ) : (
              /* --- Customer / Guest Actions --- */
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link
                  to="/auth"
                  style={{
                    height: 36, padding: '0 14px', fontSize: 13, fontWeight: 600,
                    color: '#29165E', textDecoration: 'none',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  Masuk Brand
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="btn-navy"
                  style={{
                    height: 36, padding: '0 18px', fontSize: 13, fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Daftarkan Brand
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            className="show-mobile"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 6,
              cursor: 'pointer', padding: 7, color: '#29165E',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* ── MOBILE MENU DRAWER ─────────────────────────────── */}
        {menuOpen && (
          <div style={{
            borderTop: '1px solid #E2E8F0',
            backgroundColor: '#FFFFFF',
            padding: '16px 0 20px',
            animation: 'fadeIn 0.15s ease',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <div className="container-main" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              
              {/* Role Header in Mobile */}
              <div style={{
                padding: '10px 14px',
                background: user ? '#F0F3FF' : '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 999,
                    background: user ? '#0F0926' : '#64748B',
                    color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 900, overflow: 'hidden', flexShrink: 0,
                  }}>
                    {user && brand ? (
                      brand.logo_url || (brand.slug === 'void-division' ? '/void_logo.jpg' : null) ? (
                        <img src={brand.logo_url || (brand.slug === 'void-division' ? '/void_logo.jpg' : '')} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        brand.name.charAt(0)
                      )
                    ) : (
                      '🛍️'
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748B', display: 'block' }}>Peran Saat Ini:</span>
                    <strong style={{ fontSize: 13, color: '#29165E' }}>
                      {user ? `👑 Brand Owner (${brand?.name || 'Brand'})` : '🛍️ Customer (Pembeli)'}
                    </strong>
                  </div>
                </div>

                {isDemoMode && (
                  <span style={{ background: '#FBBF24', color: '#1A0F3D', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 999 }}>
                    DEMO
                  </span>
                )}
              </div>

              {/* Navigation Links */}
              {activeLinks.map(link => {
                const active = isActive(link.to)
                const Icon = link.icon
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    style={{
                      padding: '11px 14px',
                      fontSize: 14,
                      color: active ? '#29165E' : '#334155',
                      textDecoration: 'none',
                      borderRadius: 6,
                      background: active ? '#F0F3FF' : 'transparent',
                      fontWeight: active ? 700 : 500,
                      borderLeft: active ? '3px solid #29165E' : '3px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Icon size={16} color={active ? '#29165E' : '#64748B'} />
                    <span>{link.label}</span>
                  </Link>
                )
              })}

              {/* Mobile Actions */}
              <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 12, paddingTop: 12 }}>
                {user ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Link
                      to="/dashboard"
                      className="btn-navy"
                      style={{
                        textAlign: 'center', padding: '12px', textDecoration: 'none',
                        fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 6,
                      }}
                    >
                      <LayoutDashboard size={15} /> Buka Dashboard {brand?.name}
                    </Link>
                    <button
                      onClick={() => signOut()}
                      style={{
                        textAlign: 'center', padding: '10px', color: '#E11D48',
                        background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 999,
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <LogOut size={14} /> Keluar (Kembali ke Customer)
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Link
                      to="/auth"
                      style={{
                        textAlign: 'center', padding: '10px', color: '#29165E',
                        textDecoration: 'none', fontSize: 13, fontWeight: 700,
                        border: '1px solid #CBD5E1', borderRadius: 999,
                      }}
                    >
                      Masuk Portal Brand Owner
                    </Link>
                    <Link
                      to="/auth?mode=register"
                      className="btn-navy"
                      style={{
                        textAlign: 'center', padding: '11px', textDecoration: 'none',
                        fontSize: 13, fontWeight: 700,
                      }}
                    >
                      Daftarkan Brand Sekarang
                    </Link>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
