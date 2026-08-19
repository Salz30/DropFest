import { useState, useEffect } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'large'

export function useBreakpoint(): Breakpoint {
  const getBreakpoint = (): Breakpoint => {
    const w = window.innerWidth
    if (w < 480) return 'mobile'
    if (w < 768) return 'tablet'
    if (w < 1240) return 'desktop'
    return 'large'
  }

  const [bp, setBp] = useState<Breakpoint>(getBreakpoint)

  useEffect(() => {
    const handler = () => setBp(getBreakpoint())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return bp
}

export function useIsMobile() {
  const bp = useBreakpoint()
  return bp === 'mobile'
}

export function useIsTabletDown() {
  const bp = useBreakpoint()
  return bp === 'mobile' || bp === 'tablet'
}
