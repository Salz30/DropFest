import { Link } from 'react-router-dom'
import {
  Zap, ArrowRight, ShoppingBag, Clock, CheckCircle,
  BarChart2, Shield, Package, ChevronRight, Users, Star
} from 'lucide-react'
import { useBreakpoint } from '../hooks/useBreakpoint'

const stats = [
  { value: '50+', label: 'Brand Aktif' },
  { value: '200+', label: 'Drop Berhasil' },
  { value: '10K+', label: 'Pre-Order' },
  { value: '98%', label: 'Kepuasan' },
]

const stepsCustomer = [
  { icon: ShoppingBag, title: 'Pilih Drop', desc: 'Browse koleksi drop terbatas dari brand indie pilihanmu.' },
  { icon: Clock, title: 'Pre-Order & Lock Slot', desc: 'Isi form & slot otomatis terkunci untukmu selama 24 jam.' },
  { icon: CheckCircle, title: 'Bayar & Konfirmasi', desc: 'Upload bukti transfer dan brand akan verifikasi pembayaranmu.' },
]

const stepsBrand = [
  { icon: Users, title: 'Daftarkan Brand', desc: 'Buat akun brand owner dan lengkapi profil brandmu.' },
  { icon: Package, title: 'Buat Drop', desc: 'Set produk, slot terbatas, harga, dan jadwal rilis.' },
  { icon: BarChart2, title: 'Kelola & Pantau', desc: 'Dashboard lengkap untuk verifikasi pembayaran & export alamat.' },
]

const features = [
  { icon: Clock, title: 'Slot Otomatis Terkunci', desc: 'Tiap order langsung lock slot secara atomik. Slot kadaluarsa dilepas otomatis tiap 15 menit.' },
  { icon: Shield, title: 'Verifikasi Pembayaran', desc: 'Brand owner review bukti transfer langsung dari dashboard. Approve/reject satu klik.' },
  { icon: Package, title: 'Export Alamat Pengiriman', desc: 'Download semua data shipping address dalam format CSV, siap dikirim ke ekspedisi.' },
  { icon: Star, title: 'Track My Order', desc: 'Pembeli cek status pesanan kapan saja dengan Order ID + email. Tanpa perlu akun.' },
  { icon: BarChart2, title: 'Dashboard Analytics', desc: 'Pantau statistik drop: slot tersisa, total revenue, pending verification — real-time.' },
  { icon: Zap, title: 'Tanpa Ribet WhatsApp', desc: 'Gantikan alur manual Instagram/WA dengan platform profesional yang skalabel.' },
]

const testimonials = [
  { quote: 'Drop pertama kami sold out dalam 3 jam. Sebelumnya pakai WA, chaos banget. DropFest beneran game changer.', name: 'Rizky A.', brand: 'Founder, Void Division' },
  { quote: 'Fitur slot expiry otomatis bikin kami nggak perlu cancel order manual tiap pagi. Hemat waktu banget.', name: 'Andra S.', brand: 'Bumi Records' },
  { quote: 'Customer kami suka fitur Track My Order. Pertanyaan "udah diproses belum?" di DM turun drastis.', name: 'Nadia P.', brand: 'Silo Coffee Roasters' },
]

export default function LandingPage() {
  const bp = useBreakpoint()
  const isMobile = bp === 'mobile'
  const isTabletDown = bp === 'mobile' || bp === 'tablet'

  // Responsive values
  const heroFontSize = isMobile ? 36 : isTabletDown ? 48 : 72
  const heroPadding = isMobile ? '64px 0 48px' : '100px 0 80px'
  const sectionPadding = isMobile ? '48px 0' : '80px 0'
  const gridCols = isMobile ? '1fr' : isTabletDown ? '1fr 1fr' : 'repeat(3, 1fr)'
  const cardPadding = isMobile ? '20px 16px' : '28px 24px'

  return (
    <div style={{ backgroundColor: '#FFFFFF' }}>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section style={{
        background: 'linear-gradient(160deg, #F0F3FF 0%, #FFFFFF 50%, #E7E3FF 100%)',
        padding: heroPadding,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(41,22,94,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 300, height: 300, borderRadius: '50%', background: 'rgba(231,227,255,0.6)', pointerEvents: 'none' }} />

        <div className="container-main" style={{ position: 'relative', zIndex: 1 }}>
          {/* Badge */}
          <div style={{ marginBottom: 20 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#E7E3FF', color: '#29165E',
              fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 999,
              border: '1px solid rgba(41,22,94,0.15)',
            }}>
              <Zap size={11} fill="#29165E" /> Platform Drop #1 untuk Brand Indie Indonesia
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: heroFontSize,
            fontWeight: 900, color: '#29165E',
            lineHeight: 1.05, marginBottom: 20,
            maxWidth: isMobile ? '100%' : 780,
          }}>
            Rilis Produkmu.<br />
            <span style={{ color: '#5E4C92' }}>Tanpa Chaos.</span>
          </h1>

          <p style={{
            fontSize: isMobile ? 15 : 18,
            color: '#3D464D', lineHeight: '28px',
            maxWidth: isMobile ? '100%' : 540,
            marginBottom: isMobile ? 28 : 40,
          }}>
            Platform micro-drop & pre-order untuk brand indie — streetwear, vinyl, sneakers, kopi, dan lebih banyak lagi.
            Gantikan alur manual Instagram/WhatsApp dengan sistem yang profesional.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap' }}>
            <Link to="/auth?mode=register" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#29165E', color: '#FFFFFF',
              fontSize: 15, fontWeight: 600,
              padding: '0 28px', height: 52, borderRadius: 999,
              textDecoration: 'none', width: isMobile ? '100%' : 'auto',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1A0F3D')}
              onMouseLeave={e => (e.currentTarget.style.background = '#29165E')}
            >
              Mulai Gratis <ArrowRight size={16} />
            </Link>
            <Link to="/drops" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'rgba(255,255,255,0.9)', color: '#3D464D',
              fontSize: 15, border: '1px solid #D9D9D9',
              padding: '0 28px', height: 52, borderRadius: 999,
              textDecoration: 'none', width: isMobile ? '100%' : 'auto',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FFFFFF')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.9)')}
            >
              Lihat Drops Aktif
            </Link>
          </div>

          {/* Trust indicators */}
          <div style={{ marginTop: 32, display: 'flex', gap: isMobile ? 12 : 24, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
            {['✓ Tanpa biaya setup', '✓ Customer tanpa buat akun', '✓ Slot otomatis terkunci'].map(t => (
              <span key={t} style={{ fontSize: 12, color: '#666666' }}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────────── */}
      <section style={{ background: '#29165E', padding: isMobile ? '28px 0' : '36px 0' }}>
        <div className="container-main">
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: isMobile ? 20 : 32,
          }}>
            {stats.map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS: CUSTOMER ─────────────────────────── */}
      <section style={{ padding: sectionPadding }}>
        <div className="container-main">
          <div style={{ marginBottom: isMobile ? 28 : 48 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#5E4C92', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Untuk Pembeli</p>
            <h2 style={{ fontSize: isMobile ? 26 : 36, fontWeight: 900, color: '#29165E', marginBottom: 10 }}>Pre-Order Jadi Gampang</h2>
            <p style={{ fontSize: 14, color: '#666666', maxWidth: 480 }}>
              Dari pilih produk sampai bukti bayar — semua dalam satu platform, tanpa perlu buat akun.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: isMobile ? 16 : 24 }}>
            {stepsCustomer.map((step, i) => (
              <div key={step.title} style={{
                padding: cardPadding, borderRadius: 5,
                border: '1px solid #D9D9D9', background: '#FFFFFF',
                boxShadow: 'rgba(0,0,0,0.06) 0px 4px 16px -4px',
                position: 'relative',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: '#E7E3FF', color: '#29165E',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                }}>
                  <step.icon size={20} />
                </div>
                <div style={{ position: 'absolute', top: 24, right: 20, fontSize: 28, fontWeight: 900, color: '#F0F3FF' }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#29165E', marginBottom: 6 }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: '#666666', lineHeight: '20px' }}>{step.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <Link to="/drops" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 14, color: '#29165E', textDecoration: 'none', fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              Lihat drop yang sedang live <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS: BRAND ────────────────────────────── */}
      <section style={{ padding: sectionPadding, background: '#F5F6F7' }}>
        <div className="container-main">
          <div style={{ marginBottom: isMobile ? 28 : 48 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#5E4C92', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Untuk Brand</p>
            <h2 style={{ fontSize: isMobile ? 26 : 36, fontWeight: 900, color: '#29165E', marginBottom: 10 }}>Kelola Drop Lebih Profesional</h2>
            <p style={{ fontSize: 14, color: '#666666', maxWidth: 480 }}>
              Dashboard lengkap, verifikasi pembayaran, dan export data — semua yang brand indie butuhkan.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: isMobile ? 16 : 24 }}>
            {stepsBrand.map((step, i) => (
              <div key={step.title} style={{
                background: i === 1 ? 'rgb(19,0,65)' : '#FFFFFF',
                color: i === 1 ? '#FFFFFF' : '#3D464D',
                padding: cardPadding, borderRadius: 5,
                boxShadow: 'rgba(0,0,0,0.1) 0px 10px 30px -10px',
                position: 'relative',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: i === 1 ? 'rgba(255,255,255,0.15)' : '#E7E3FF',
                  color: i === 1 ? '#FFFFFF' : '#29165E',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                }}>
                  <step.icon size={20} />
                </div>
                <div style={{ position: 'absolute', top: 24, right: 20, fontSize: 28, fontWeight: 900, color: i === 1 ? 'rgba(255,255,255,0.08)' : '#F0F3FF' }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: i === 1 ? '#FFFFFF' : '#29165E' }}>{step.title}</h3>
                <p style={{ fontSize: 13, lineHeight: '20px', color: i === 1 ? 'rgba(255,255,255,0.7)' : '#666666' }}>{step.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28 }}>
            <Link to="/auth?mode=register" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#29165E', color: '#FFFFFF', fontSize: 14, fontWeight: 600,
              padding: '0 24px', height: 48, borderRadius: 999, textDecoration: 'none',
              width: isMobile ? '100%' : 'auto',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1A0F3D')}
              onMouseLeave={e => (e.currentTarget.style.background = '#29165E')}
            >
              Daftarkan Brand Sekarang <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ──────────────────────────────────── */}
      <section style={{ padding: sectionPadding }}>
        <div className="container-main">
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 28 : 48 }}>
            <h2 style={{ fontSize: isMobile ? 26 : 36, fontWeight: 900, color: '#29165E', marginBottom: 10 }}>Semua yang Kamu Butuhkan</h2>
            <p style={{ fontSize: 14, color: '#666666', maxWidth: 440, margin: '0 auto' }}>
              Dibangun khusus untuk workflow drop terbatas — bukan platform e-commerce generik.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTabletDown ? '1fr 1fr' : 'repeat(3, 1fr)', gap: isMobile ? 12 : 20 }}>
            {features.map((feat, i) => (
              <div key={feat.title} style={{
                padding: isMobile ? '16px' : '22px',
                borderRadius: 5, border: '1px solid #D9D9D9', background: '#FFFFFF',
                display: 'flex', gap: 14, alignItems: 'flex-start',
                transition: 'box-shadow 0.2s, transform 0.2s',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = 'rgba(41,22,94,0.1) 0px 8px 24px -4px'
                  if (!isMobile) e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                  background: i % 2 === 0 ? '#E7E3FF' : '#F0F3FF', color: '#29165E',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <feat.icon size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#29165E', marginBottom: 4 }}>{feat.title}</h3>
                  <p style={{ fontSize: 12, color: '#666666', lineHeight: '18px' }}>{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────── */}
      <section style={{ padding: sectionPadding, background: '#29165E' }}>
        <div className="container-main">
          <h2 style={{ fontSize: isMobile ? 22 : 32, fontWeight: 900, color: '#FFFFFF', textAlign: 'center', marginBottom: isMobile ? 28 : 44 }}>
            Kata Brand yang Sudah Pakai DropFest
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: isMobile ? 16 : 24 }}>
            {testimonials.map(t => (
              <div key={t.name} style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 5, padding: cardPadding,
              }}>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: '21px', marginBottom: 16, fontStyle: 'italic' }}>
                  "{t.quote}"
                </p>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>{t.name}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{t.brand}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────── */}
      <section style={{ padding: sectionPadding }}>
        <div className="container-main" style={{ textAlign: 'center' }}>
          <div style={{
            background: 'linear-gradient(135deg, #E7E3FF 0%, #F0F3FF 100%)',
            borderRadius: 12, padding: isMobile ? '40px 20px' : '64px 40px',
            border: '1px solid rgba(41,22,94,0.1)',
          }}>
            <h2 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 900, color: '#29165E', marginBottom: 12 }}>
              Siap Rilis Drop Pertamamu?
            </h2>
            <p style={{ fontSize: 14, color: '#666666', marginBottom: 28, maxWidth: 360, margin: '0 auto 28px' }}>
              Daftar gratis, setup brand, dan mulai terima pre-order dalam hitungan menit.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center' }}>
              <Link to="/auth?mode=register" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: '#29165E', color: '#FFFFFF', fontSize: 15, fontWeight: 600,
                padding: '0 32px', height: 52, borderRadius: 999, textDecoration: 'none',
                width: isMobile ? '100%' : 'auto',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1A0F3D')}
                onMouseLeave={e => (e.currentTarget.style.background = '#29165E')}
              >
                Mulai Sekarang — Gratis <ArrowRight size={16} />
              </Link>
              <Link to="/drops" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: '#FFFFFF', color: '#29165E', fontSize: 15,
                border: '1px solid #29165E', padding: '0 32px', height: 52, borderRadius: 999,
                textDecoration: 'none', fontWeight: 500, width: isMobile ? '100%' : 'auto',
              }}>
                Lihat Contoh Drop
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
