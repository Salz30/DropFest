import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Zap, LayoutDashboard, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navLinks = [
  { label: 'Drops', to: '/drops' },
  { label: 'Brands', to: '/brands' },
  { label: 'Cek Pesanan', to: '/track-order' },
]

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const { user, brand, signOut } = useAuth()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [location])

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 102,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderBottom: '1px solid #D9D9D9',
        backdropFilter: 'blur(8px)',
        boxShadow: scrolled ? 'rgba(0,0,0,0.05) 0px 1px 3px' : 'none',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      <div className="container-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 80 }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: '#29165E',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color="#FFFFFF" fill="#FFFFFF" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#29165E', letterSpacing: '-0.3px' }}>
            DropFest
          </span>
        </Link>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="hidden-mobile">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              style={{
                fontSize: 14,
                color: location.pathname === link.to ? '#29165E' : '#3D464D',
                textDecoration: location.pathname === link.to ? 'underline' : 'none',
                fontWeight: location.pathname === link.to ? 600 : 400,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#29165E')}
              onMouseLeave={e => (e.currentTarget.style.color = location.pathname === link.to ? '#29165E' : '#3D464D')}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA / Auth State */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="hidden-mobile">
          {user ? (
            <>
              <Link
                to="/dashboard"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  height: 40, padding: '0 16px', borderRadius: 999,
                  background: '#29165E', color: '#FFFFFF',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                }}
              >
                <LayoutDashboard size={14} /> Dashboard ({brand?.name || 'Brand'})
              </Link>
              <button
                onClick={() => signOut()}
                style={{
                  height: 40, padding: '0 12px', background: 'none',
                  border: 'none', color: '#666666', cursor: 'pointer',
                  fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
                }}
                title="Keluar"
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <>
              <Link to="/auth" className="btn-ghost" style={{ height: 40, padding: '0 16px' }}>
                Masuk
              </Link>
              <Link to="/auth?mode=register" className="btn-navy" style={{ height: 40, padding: '0 20px', fontSize: 14, textDecoration: 'none' }}>
                Daftarkan Brand
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          className="show-mobile"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#3D464D' }}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div style={{
          borderTop: '1px solid #D9D9D9',
          backgroundColor: '#FFFFFF',
          padding: '16px 0',
        }}>
          <div className="container-main" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  padding: '12px 0',
                  fontSize: 16,
                  color: location.pathname === link.to ? '#29165E' : '#3D464D',
                  textDecoration: 'none',
                  borderBottom: '1px solid #F5F6F7',
                  fontWeight: location.pathname === link.to ? 600 : 400,
                }}
              >
                {link.label}
              </Link>
            ))}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {user ? (
                <>
                  <Link to="/dashboard" className="btn-navy" style={{ textAlign: 'center', padding: '12px', textDecoration: 'none', fontSize: 14 }}>
                    📊 Buka Dashboard Brand ({brand?.name || 'Brand'})
                  </Link>
                  <button
                    onClick={() => signOut()}
                    style={{
                      textAlign: 'center', padding: '10px', color: '#D32F2F',
                      background: 'none', border: '1px solid #D9D9D9', borderRadius: 999,
                      fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Keluar Akun
                  </button>
                </>
              ) : (
                <>
                  <Link to="/auth" style={{ textAlign: 'center', padding: '12px', color: '#29165E', textDecoration: 'none', fontSize: 14, border: '1px solid #D9D9D9', borderRadius: 999 }}>
                    Masuk
                  </Link>
                  <Link to="/auth?mode=register" className="btn-navy" style={{ textAlign: 'center', padding: '12px', textDecoration: 'none', fontSize: 14 }}>
                    Daftarkan Brand
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
