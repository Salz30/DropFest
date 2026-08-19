import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, ChevronUp, ChevronDown, CheckCircle2, User, Building2, Search, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const demoBrands = [
  { name: 'Void Division', slug: 'void-division', email: 'owner@voiddivision.com' },
  { name: 'Bumi Records', slug: 'bumi-records', email: 'owner@bumirecords.com' },
  { name: 'Silo Coffee', slug: 'silo-coffee', email: 'owner@silocoffee.com' },
]

export default function DemoToolbar() {
  const navigate = useNavigate()
  const { user, brand, loginOrProvisionDemo, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [loadingBrand, setLoadingBrand] = useState<string | null>(null)

  const handleQuickBrandLogin = async (b: typeof demoBrands[0]) => {
    setLoadingBrand(b.slug)
    try {
      const res = await loginOrProvisionDemo(b.email, 'demo123456', b.slug, b.name)
      if (res.success) {
        navigate('/dashboard')
        setIsOpen(false)
      }
    } finally {
      setLoadingBrand(null)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 18,
      right: 18,
      zIndex: 1002,
      fontFamily: 'inherit',
    }}>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#29165E',
          color: '#FFFFFF',
          border: '2px solid #E7E3FF',
          borderRadius: 999,
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 700,
          boxShadow: 'rgba(41,22,94,0.35) 0px 8px 24px',
          cursor: 'pointer',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <Zap size={14} color="#FBBF24" fill="#FBBF24" />
        <span>Akses Cepat Demo</span>
        {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {/* Expanded Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: 50,
          right: 0,
          width: 320,
          background: '#FFFFFF',
          borderRadius: 10,
          border: '1px solid #D9D9D9',
          boxShadow: 'rgba(0,0,0,0.18) 0px 16px 40px',
          padding: 16,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #F5F6F7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} color="#29165E" fill="#29165E" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#29165E' }}>Demo Mode Assistant</span>
            </div>
            <span style={{ fontSize: 10, background: '#DCFCE7', color: '#15803D', fontWeight: 700, padding: '2px 6px', borderRadius: 999 }}>
              READY
            </span>
          </div>

          {/* Current State */}
          <div style={{ background: '#F5F6F7', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
            <span style={{ color: '#666666' }}>Role saat ini: </span>
            {user ? (
              <strong style={{ color: '#15803D' }}>👑 Brand Owner ({brand?.name || 'Brand'})</strong>
            ) : (
              <strong style={{ color: '#29165E' }}>🛍️ Customer (Guest)</strong>
            )}
          </div>

          {/* Section 1: Quick Brand Owner Logins */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#5E4C92', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Building2 size={12} /> 1-Click Login Brand Owner
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {demoBrands.map(b => (
                <button
                  key={b.slug}
                  disabled={loadingBrand !== null}
                  onClick={() => handleQuickBrandLogin(b)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #D9D9D9',
                    background: brand?.slug === b.slug ? '#F0F3FF' : '#FFFFFF',
                    color: '#29165E',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{b.name}</span>
                  {loadingBrand === b.slug ? (
                    <span style={{ fontSize: 11, color: '#666666' }}>Masuk...</span>
                  ) : brand?.slug === b.slug ? (
                    <CheckCircle2 size={13} color="#15803D" />
                  ) : (
                    <span style={{ fontSize: 11, color: '#5E4C92' }}>Login →</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Customer Actions */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#5E4C92', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <User size={12} /> Alur Demo Customer
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                onClick={() => {
                  navigate('/drops/33333333-0000-0000-0000-000000000001')
                  setIsOpen(false)
                }}
                style={{
                  padding: '8px',
                  borderRadius: 6,
                  border: '1px solid #D9D9D9',
                  background: '#FFFFFF',
                  color: '#29165E',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ⚡ Pre-Order Drop
              </button>

              <button
                onClick={() => {
                  navigate('/track-order?id=44444444-0000-0000-0000-000000000001&email=raka%40example.com')
                  setIsOpen(false)
                }}
                style={{
                  padding: '8px',
                  borderRadius: 6,
                  border: '1px solid #D9D9D9',
                  background: '#FFFFFF',
                  color: '#29165E',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Search size={11} /> Cek Pesanan
              </button>
            </div>
          </div>

          {/* Footer Reset / Logout */}
          {user && (
            <div style={{ paddingTop: 8, borderTop: '1px solid #F5F6F7', textAlign: 'center' }}>
              <button
                onClick={async () => {
                  await signOut()
                  navigate('/')
                  setIsOpen(false)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#D32F2F',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <LogOut size={12} /> Keluar (Kembali ke Customer Guest)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
