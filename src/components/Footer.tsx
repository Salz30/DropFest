import { Link } from 'react-router-dom'
import { Zap, Instagram, Mail } from 'lucide-react'
import { useIsMobile } from '../hooks/useBreakpoint'

export default function Footer() {
  const isMobile = useIsMobile()

  return (
    <footer style={{ borderTop: '1px solid #D9D9D9', backgroundColor: '#FFFFFF', marginTop: isMobile ? 0 : 0 }}>
      <div className="container-main" style={{ padding: isMobile ? '36px 16px 28px' : '52px 40px 40px' }}>

        {/* Main grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: isMobile ? 28 : 40,
          marginBottom: isMobile ? 28 : 40,
        }}>

          {/* Brand — full width on mobile */}
          <div style={{ gridColumn: isMobile ? '1 / -1' : 'auto' }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: '#29165E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={13} color="#FFFFFF" fill="#FFFFFF" />
              </div>
              <span style={{ fontSize: 15, fontWeight: 900, color: '#29165E' }}>DropFest</span>
            </Link>
            <p style={{ fontSize: 12, color: '#666666', lineHeight: '18px', maxWidth: isMobile ? '100%' : 220 }}>
              Platform micro-drop & pre-order untuk brand indie Indonesia.
            </p>
          </div>

          {/* Explore */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#3D464D', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Explore</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Semua Drops', to: '/drops' },
                { label: 'Brand Listing', to: '/brands' },
                { label: 'Cek Pesanan', to: '/track-order' },
              ].map(l => (
                <Link key={l.to} to={l.to} style={{ fontSize: 13, color: '#666666', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#29165E')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#666666')}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* For Brands */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#3D464D', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Brand</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Daftarkan Brand', to: '/auth?mode=register' },
                { label: 'Login Dashboard', to: '/auth' },
              ].map(l => (
                <Link key={l.to} to={l.to} style={{ fontSize: 13, color: '#666666', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#29165E')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#666666')}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact — hidden on mobile if not enough space, shown via grid */}
          {!isMobile && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#3D464D', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kontak</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a href="mailto:hello@dropfest.id" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#666666', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#29165E')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#666666')}>
                  <Mail size={13} /> hello@dropfest.id
                </a>
                <a href="https://instagram.com/dropfest.id" target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#666666', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#29165E')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#666666')}>
                  <Instagram size={13} /> @dropfest.id
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Contact row on mobile */}
        {isMobile && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #F5F6F7' }}>
            <a href="mailto:hello@dropfest.id" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666666', textDecoration: 'none' }}>
              <Mail size={12} /> hello@dropfest.id
            </a>
            <a href="https://instagram.com/dropfest.id" target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666666', textDecoration: 'none' }}>
              <Instagram size={12} /> @dropfest.id
            </a>
          </div>
        )}

        {/* Bottom bar */}
        <div style={{
          borderTop: isMobile ? 'none' : '1px solid #D9D9D9',
          paddingTop: isMobile ? 0 : 20,
          display: 'flex',
          justifyContent: isMobile ? 'center' : 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: 8,
          textAlign: isMobile ? 'center' : 'left',
        }}>
          <p style={{ fontSize: 11, color: '#999999' }}>© 2026 DropFest. All rights reserved.</p>
          {!isMobile && <p style={{ fontSize: 11, color: '#D9D9D9' }}>Platform untuk brand indie Indonesia 🇮🇩</p>}
        </div>
      </div>
    </footer>
  )
}
