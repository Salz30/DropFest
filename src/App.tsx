import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import DemoToolbar from './components/DemoToolbar'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import DropsPage from './pages/DropsPage'
import DropDetailPage from './pages/DropDetailPage'
import TrackOrderPage from './pages/TrackOrderPage'
import BrandsPage from './pages/BrandsPage'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  return (
    <AuthProvider>
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

              {/* Brand Auth (Login & Register) */}
              <Route path="/auth" element={<AuthPage />} />

              {/* Brand Owner Dashboard (Protected Route) */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />

          {/* Floating Demo Assistant */}
          <DemoToolbar />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

function NotFoundPage() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <h1 style={{ fontSize: 48, fontWeight: 900, color: '#29165E', marginBottom: 8 }}>404</h1>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#3D464D', marginBottom: 16 }}>Halaman Tidak Ditemukan</h2>
        <p style={{ fontSize: 14, color: '#666666', marginBottom: 24 }}>Halaman yang Anda tuju mungkin sudah dipindahkan atau tidak tersedia.</p>
        <a href="/" style={{ textDecoration: 'none' }} className="btn-navy">
          Kembali ke Beranda
        </a>
      </div>
    </div>
  )
}

export default App
