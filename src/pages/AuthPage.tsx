import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Zap, Mail, Lock, Building2, Globe, Instagram, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useBreakpoint } from '../hooks/useBreakpoint'

const demoAccounts = [
  { name: 'Void Division', slug: 'void-division', email: 'owner@voiddivision.com', password: 'demo123456' },
  { name: 'Bumi Records', slug: 'bumi-records', email: 'owner@bumirecords.com', password: 'demo123456' },
  { name: 'Silo Coffee', slug: 'silo-coffee', email: 'owner@silocoffee.com', password: 'demo123456' },
]

export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'
  const { signIn, signUpBrand, loginOrProvisionDemo, user } = useAuth()

  const [mode, setMode] = useState<'login' | 'register'>(
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  )

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register Form State
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [brandName, setBrandName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [instagram, setInstagram] = useState('')

  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // If already logged in, redirect to dashboard
  if (user) {
    navigate('/dashboard', { replace: true })
    return null
  }

  const handleBrandNameChange = (name: string) => {
    setBrandName(name)
    const generated = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    setSlug(generated)
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await signIn(loginEmail, loginPassword)
      if (res.success) {
        navigate('/dashboard')
      } else {
        setError(res.error || 'Email atau password salah.')
      }
    } catch {
      setError('Gagal menghubungkan ke server auth.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (regPassword.length < 6) {
      setError('Password minimal harus 6 karakter.')
      return
    }

    if (!slug.trim()) {
      setError('Slug brand wajib diisi.')
      return
    }

    setLoading(true)
    try {
      const res = await signUpBrand({
        email: regEmail,
        password: regPassword,
        brandName,
        slug,
        description,
        instagram,
      })

      if (res.success) {
        navigate('/dashboard')
      } else {
        setError(res.error || 'Pendaftaran gagal.')
      }
    } catch {
      setError('Terjadi kesalahan saat pendaftaran.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickDemoLogin = async (acc: typeof demoAccounts[0]) => {
    setError(null)
    setDemoLoading(acc.slug)
    try {
      const res = await loginOrProvisionDemo(acc.email, acc.password, acc.slug, acc.name)
      if (res.success) {
        navigate('/dashboard')
      } else {
        setError(res.error || 'Gagal login demo.')
      }
    } finally {
      setDemoLoading(null)
    }
  }

  return (
    <div style={{ backgroundColor: '#F5F6F7', minHeight: '85vh', padding: isMobile ? '32px 0 60px' : '48px 0 80px', display: 'flex', alignItems: 'center' }}>
      <div className="container-main" style={{ maxWidth: 480 }}>

        {/* ── LOGO & HEADER ──────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#29165E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} color="#FFFFFF" fill="#FFFFFF" />
            </div>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#29165E' }}>DropFest</span>
          </Link>
          <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, color: '#29165E', marginBottom: 6 }}>
            {mode === 'login' ? 'Portal Brand Owner' : 'Daftarkan Brand Anda'}
          </h1>
          <p style={{ fontSize: 13, color: '#666666' }}>
            {mode === 'login'
              ? 'Masuk ke dashboard untuk mengelola drop & verifikasi pesanan.'
              : 'Mulai rilis produk terbatas & terima pre-order secara profesional.'}
          </p>
        </div>

        {/* ── QUICK DEMO LOGIN BOX ───────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #29165E 0%, #3D228A 100%)',
          borderRadius: 8, padding: '16px', color: '#FFFFFF',
          marginBottom: 20, boxShadow: 'rgba(41,22,94,0.2) 0px 8px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#FBBF24', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} fill="#FBBF24" /> 1-Click Demo Login
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Pilih Akun Demo:</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {demoAccounts.map(acc => (
              <button
                key={acc.slug}
                type="button"
                disabled={demoLoading !== null}
                onClick={() => handleQuickDemoLogin(acc)}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 6,
                  padding: '8px 4px',
                  color: '#FFFFFF',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              >
                {demoLoading === acc.slug ? 'Masuk...' : acc.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── CARD ───────────────────────────────────────────── */}
        <div style={{
          background: '#FFFFFF', borderRadius: 8,
          border: '1px solid #D9D9D9',
          boxShadow: 'rgba(0,0,0,0.06) 0px 8px 24px -4px',
          padding: isMobile ? '24px 20px' : '32px',
        }}>

          {/* Mode Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 4, background: '#F5F6F7', borderRadius: 6, marginBottom: 24 }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              style={{
                padding: '8px', fontSize: 13, fontWeight: mode === 'login' ? 700 : 500,
                borderRadius: 4, border: 'none',
                background: mode === 'login' ? '#FFFFFF' : 'transparent',
                color: mode === 'login' ? '#29165E' : '#666666',
                boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
              }}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              style={{
                padding: '8px', fontSize: 13, fontWeight: mode === 'register' ? 700 : 500,
                borderRadius: 4, border: 'none',
                background: mode === 'register' ? '#FFFFFF' : 'transparent',
                color: mode === 'register' ? '#29165E' : '#666666',
                boxShadow: mode === 'register' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
              }}
            >
              Daftar Brand
            </button>
          </div>

          {error && (
            <div style={{
              padding: '12px', background: '#FEE2E2', border: '1px solid #F87171',
              borderRadius: 6, marginBottom: 20, fontSize: 13, color: '#B91C1C',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          {mode === 'login' ? (
            /* ── LOGIN FORM ─────────────────────────────────── */
            <form onSubmit={handleLoginSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label className="input-label">Email Akun Brand</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} color="#75797C" style={{ position: 'absolute', left: 10, top: 14 }} />
                  <input
                    type="email"
                    required
                    placeholder="owner@brandkamu.com"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: 34 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label className="input-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color="#75797C" style={{ position: 'absolute', left: 10, top: 14 }} />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: 34 }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-navy"
                style={{ width: '100%', height: 48, fontSize: 14, fontWeight: 700 }}
              >
                {loading ? 'Memverifikasi Akun...' : 'Masuk ke Dashboard'}
              </button>
            </form>
          ) : (
            /* ── REGISTER FORM ──────────────────────────────── */
            <form onSubmit={handleRegisterSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Nama Brand</label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={15} color="#75797C" style={{ position: 'absolute', left: 10, top: 14 }} />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Void Division"
                    value={brandName}
                    onChange={e => handleBrandNameChange(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: 34 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Slug URL Brand (Otomatis)</label>
                <div style={{ position: 'relative' }}>
                  <Globe size={15} color="#75797C" style={{ position: 'absolute', left: 10, top: 14 }} />
                  <input
                    type="text"
                    required
                    placeholder="void-division"
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: 34, fontSize: 13 }}
                  />
                </div>
                <span style={{ fontSize: 11, color: '#666666', marginTop: 4, display: 'block' }}>
                  Akan muncul sebagai url brand: dropfest.id/brands/{slug || 'nama-brand'}
                </span>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Email Login Owner</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} color="#75797C" style={{ position: 'absolute', left: 10, top: 14 }} />
                  <input
                    type="email"
                    required
                    placeholder="owner@brandkamu.com"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: 34 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Password (Minimal 6 karakter)</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color="#75797C" style={{ position: 'absolute', left: 10, top: 14 }} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: 34 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Instagram Handle (Opsional)</label>
                <div style={{ position: 'relative' }}>
                  <Instagram size={15} color="#75797C" style={{ position: 'absolute', left: 10, top: 14 }} />
                  <input
                    type="text"
                    placeholder="@brandkamu"
                    value={instagram}
                    onChange={e => setInstagram(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: 34 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label className="input-label">Deskripsi Singkat / Bio Brand</label>
                <textarea
                  rows={2}
                  placeholder="Ceritakan singkat tentang konsep & rilisan produk brand kamu..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="input-field"
                  style={{ resize: 'none' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-navy"
                style={{ width: '100%', height: 48, fontSize: 14, fontWeight: 700 }}
              >
                {loading ? 'Mendaftarkan Brand...' : 'Daftarkan Brand Sekarang'}
              </button>
            </form>
          )}

        </div>

        {/* ── FOOTER LINK ────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <p style={{ fontSize: 12, color: '#666666' }}>
            Bukan brand owner? <Link to="/drops" style={{ color: '#29165E', fontWeight: 600 }}>Jelajahi Produk Indie →</Link>
          </p>
        </div>

      </div>
    </div>
  )
}
