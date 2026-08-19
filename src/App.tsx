import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import DropsPage from './pages/DropsPage'
import DropDetailPage from './pages/DropDetailPage'
import TrackOrderPage from './pages/TrackOrderPage'
import BrandsPage from './pages/BrandsPage'

function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1 }}>
          <Routes>
            {/* Landing page (Marketing) */}
            <Route path="/" element={<LandingPage />} />

            {/* Homepage (Showcase & Live Drops) */}
            <Route path="/home" element={<HomePage />} />

            {/* Drops Catalog & Detail */}
            <Route path="/drops" element={<DropsPage />} />
            <Route path="/drops/:id" element={<DropDetailPage />} />

            {/* Brands Catalog */}
            <Route path="/brands" element={<BrandsPage />} />

            {/* Track My Order & Upload Payment */}
            <Route path="/track-order" element={<TrackOrderPage />} />

            {/* Auth & Brand Dashboard (Fase berikutnya) */}
            <Route path="/auth" element={<ComingSoon page="Login / Registrasi Brand Owner" />} />
            <Route path="/dashboard" element={<ComingSoon page="Dashboard Brand Owner & Verifikasi Pembayaran" />} />
            <Route path="*" element={<ComingSoon page="404 — Halaman tidak ditemukan" />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

function ComingSoon({ page }: { page: string }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#E7E3FF', color: '#29165E',
          fontSize: 12, fontWeight: 600,
          padding: '6px 16px', borderRadius: 999,
          marginBottom: 20,
        }}>
          🚧 Dalam Pengembangan
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: '#29165E', marginBottom: 8 }}>{page}</h2>
        <p style={{ fontSize: 14, color: '#666666' }}>Halaman ini akan diimplementasikan pada tahap Brand Dashboard.</p>
      </div>
    </div>
  )
}

export default App
