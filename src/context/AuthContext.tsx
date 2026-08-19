import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
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
  loginOrProvisionDemo: (email: string, _password: string, brandSlug: string, brandName: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshBrandData: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEMO_STORAGE_KEY = 'dropfest_demo_brand_slug'

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
      const { data } = await supabase.from('brands').select('*').eq('id', brand.id).single()
      if (data) setBrand(data as Brand)
    } else if (user) {
      await fetchBrandForUser(user.id)
    }
  }

  useEffect(() => {
    // 1. Check if demo session exists in localStorage
    const savedDemoSlug = localStorage.getItem(DEMO_STORAGE_KEY)
    if (savedDemoSlug) {
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
              email: `owner@${demoBrand.slug}.com`,
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
        if (localStorage.getItem(DEMO_STORAGE_KEY)) return
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

  const signUpBrand = async (data: SignUpBrandData) => {
    try {
      localStorage.removeItem(DEMO_STORAGE_KEY)
      setIsDemoMode(false)

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
      })

      if (authError) {
        return { success: false, error: authError.message }
      }

      if (!authData.user) {
        return { success: false, error: 'Pendaftaran gagal dibuat.' }
      }

      const userId = authData.user.id
      const cleanSlug = data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')

      const { data: existingBrand } = await supabase
        .from('brands')
        .select('*')
        .eq('slug', cleanSlug)
        .maybeSingle()

      let brandId = existingBrand?.id

      if (!brandId) {
        const { data: newBrand, error: brandInsertError } = await supabase
          .from('brands')
          .insert({
            name: data.brandName.trim(),
            slug: cleanSlug,
            description: data.description?.trim() || null,
            instagram: data.instagram?.trim() || null,
          })
          .select()
          .single()

        if (brandInsertError) {
          return { success: false, error: `Gagal membuat profil brand: ${brandInsertError.message}` }
        }
        brandId = (newBrand as Brand).id
      }

      const { error: ownerInsertError } = await supabase
        .from('brand_owners')
        .insert({
          user_id: userId,
          brand_id: brandId,
          role: 'owner',
        })

      if (ownerInsertError) {
        return { success: false, error: `Gagal menghubungkan akun owner: ${ownerInsertError.message}` }
      }

      await fetchBrandForUser(userId)
      return { success: true }
    } catch {
      return { success: false, error: 'Terjadi kesalahan saat pendaftaran brand.' }
    }
  }

  /**
   * 1-Click Instant Demo Login:
   * Bypasses Supabase Auth SMTP / email rate limit by querying the demo brand record directly from database
   */
  const loginOrProvisionDemo = async (email: string, _password: string, brandSlug: string, _brandName: string) => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('slug', brandSlug)
        .maybeSingle()

      if (error || !data) {
        return { success: false, error: 'Brand demo belum ditemukan di database.' }
      }

      const demoBrand = data as Brand
      setBrand(demoBrand)
      setUser({
        id: 'demo-user-' + demoBrand.id,
        email: email,
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
    localStorage.removeItem(DEMO_STORAGE_KEY)
    setIsDemoMode(false)
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setBrand(null)
    setBrandOwner(null)
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
