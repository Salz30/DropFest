import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, callRpc } from '../lib/supabase'
import type { Brand, BrandOwner } from '../types'

interface SignUpBrandData {
  email: string
  password: string
  brandName: string
  slug: string
  description?: string
  instagram?: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  brand: Brand | null
  brandOwner: BrandOwner | null
  isDemoMode: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUpBrand: (data: SignUpBrandData) => Promise<{ success: boolean; error?: string }>
  loginOrProvisionDemo: (email: string, password: string, brandSlug: string, brandName: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshBrandData: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEMO_STORAGE_KEY = 'dropfest_demo_brand_slug'

// Demo brand IDs (dari seed data di schema.sql)
const DEMO_BRAND_SLUGS = ['void-division', 'bumi-records', 'silo-coffee']

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [brandOwner, setBrandOwner] = useState<BrandOwner | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchBrandForUser = async (userId: string) => {
    try {
      const { data: ownerData, error: ownerError } = await supabase
        .from('brand_owners')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (ownerError || !ownerData) {
        setBrandOwner(null)
        setBrand(null)
        return
      }

      setBrandOwner(ownerData as BrandOwner)

      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .eq('id', (ownerData as BrandOwner).brand_id)
        .maybeSingle()

      if (!brandError && brandData) {
        setBrand(brandData as Brand)
      } else {
        setBrand(null)
      }
    } catch {
      setBrand(null)
      setBrandOwner(null)
    }
  }

  const refreshBrandData = async () => {
    if (isDemoMode && brand) {
      // Refresh demo brand data langsung dari tabel publik
      const { data } = await supabase.from('brands').select('*').eq('id', brand.id).single()
      if (data) setBrand(data as Brand)
    } else if (user && !isDemoMode) {
      await fetchBrandForUser(user.id)
    }
  }

  useEffect(() => {
    // 1. Check if demo session exists in localStorage
    const savedDemoSlug = localStorage.getItem(DEMO_STORAGE_KEY)
    if (savedDemoSlug && DEMO_BRAND_SLUGS.includes(savedDemoSlug)) {
      const loadDemo = async () => {
        try {
          const { data } = await supabase
            .from('brands')
            .select('*')
            .eq('slug', savedDemoSlug)
            .maybeSingle()

          if (data) {
            const demoBrand = data as Brand
            setBrand(demoBrand)
            setUser({
              id: 'demo-user-' + demoBrand.id,
              email: `owner@${demoBrand.slug}.demo`,
              app_metadata: {},
              user_metadata: { name: demoBrand.name },
              aud: 'authenticated',
              created_at: new Date().toISOString(),
            } as User)
            setIsDemoMode(true)
          }
        } finally {
          setLoading(false)
        }
      }
      loadDemo()
      return
    }

    // 2. Otherwise check Supabase Auth session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      if (currentSession?.user) {
        fetchBrandForUser(currentSession.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (localStorage.getItem(DEMO_STORAGE_KEY)) return // Skip if in demo mode
        setSession(newSession)
        setUser(newSession?.user ?? null)
        if (newSession?.user) {
          await fetchBrandForUser(newSession.user.id)
        } else {
          setBrand(null)
          setBrandOwner(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      // Exit demo mode if active
      localStorage.removeItem(DEMO_STORAGE_KEY)
      setIsDemoMode(false)

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data.user) {
        await fetchBrandForUser(data.user.id)
      }
      return { success: true }
    } catch {
      return { success: false, error: 'Terjadi kesalahan saat masuk.' }
    }
  }

  /**
   * signUpBrand — Secure brand registration using register_brand RPC.
   */
  const signUpBrand = async (data: SignUpBrandData) => {
    try {
      localStorage.removeItem(DEMO_STORAGE_KEY)
      setIsDemoMode(false)

      // 1. Create auth account
      const { error: authError } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
      })

      if (authError) {
        return { success: false, error: authError.message }
      }

      // 2. Sign in immediately
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password,
      })

      if (signInError || !signInData.user) {
        return { success: false, error: 'Akun terdaftar tapi gagal login otomatis. Coba login manual.' }
      }

      // 3. Call register_brand RPC (atomic & secure)
      const { data: rpcResult, error: rpcError } = await callRpc('register_brand', {
        p_brand_name: data.brandName.trim(),
        p_slug: data.slug.trim(),
        p_description: data.description?.trim() || null,
        p_instagram: data.instagram?.trim() || null,
      })

      if (rpcError) {
        // Fallback: jika RPC belum di-install, coba direct insert (untuk backward compat)
        const cleanSlug = data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')

        const { data: newBrand, error: brandErr } = await supabase
          .from('brands')
          .insert({
            name: data.brandName.trim(),
            slug: cleanSlug,
            description: data.description?.trim() || null,
            instagram: data.instagram?.trim() || null,
          })
          .select()
          .single()

        if (brandErr) {
          return { success: false, error: `Gagal membuat brand: ${brandErr.message}` }
        }

        await supabase.from('brand_owners').insert({
          user_id: signInData.user.id,
          brand_id: (newBrand as Brand).id,
          role: 'owner',
        })

        await fetchBrandForUser(signInData.user.id)
        return { success: true }
      }

      const res = rpcResult as { success: boolean; message?: string }
      if (!res.success) {
        return { success: false, error: res.message || 'Gagal mendaftarkan brand.' }
      }

      await fetchBrandForUser(signInData.user.id)
      return { success: true }
    } catch {
      return { success: false, error: 'Terjadi kesalahan saat pendaftaran brand.' }
    }
  }

  /**
   * loginOrProvisionDemo — 1-Click Instant Demo Login
   * 
   * Bypass Supabase Auth sepenuhnya untuk demo mode.
   * Langsung mengambil data brand dari database (public SELECT) dan
   * membuat sesi lokal di React state + localStorage.
   * 
   * Ini HANYA untuk demo/staging — bukan untuk production.
   * Data dashboard di-fetch menggunakan public queries + SECURITY DEFINER RPCs.
   */
  const loginOrProvisionDemo = async (_email: string, _password: string, brandSlug: string, _brandName: string) => {
    try {
      // Validasi hanya demo brand yang diperbolehkan
      if (!DEMO_BRAND_SLUGS.includes(brandSlug)) {
        return { success: false, error: 'Brand ini tidak tersedia untuk mode demo.' }
      }

      // Ambil data brand langsung dari tabel publik (tidak perlu auth)
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('slug', brandSlug)
        .maybeSingle()

      if (error || !data) {
        return { success: false, error: 'Brand demo tidak ditemukan di database. Pastikan seed data sudah di-run.' }
      }

      const demoBrand = data as Brand

      // Set local demo session
      setBrand(demoBrand)
      setUser({
        id: 'demo-user-' + demoBrand.id,
        email: `owner@${demoBrand.slug}.demo`,
        app_metadata: {},
        user_metadata: { name: demoBrand.name },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as User)
      setIsDemoMode(true)
      localStorage.setItem(DEMO_STORAGE_KEY, brandSlug)

      return { success: true }
    } catch {
      return { success: false, error: 'Gagal mengaktifkan mode demo.' }
    }
  }

  const signOut = async () => {
    const wasDemoMode = isDemoMode
    localStorage.removeItem(DEMO_STORAGE_KEY)
    setIsDemoMode(false)
    setBrand(null)
    setBrandOwner(null)
    setUser(null)
    setSession(null)

    // Hanya panggil Supabase signOut jika bukan demo mode
    if (!wasDemoMode) {
      await supabase.auth.signOut()
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        brand,
        brandOwner,
        isDemoMode,
        loading,
        signIn,
        signUpBrand,
        loginOrProvisionDemo,
        signOut,
        refreshBrandData,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider')
  }
  return context
}
