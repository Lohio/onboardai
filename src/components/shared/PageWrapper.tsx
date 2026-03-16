'use client'

import { usePathname } from 'next/navigation'

// Envuelve cada página con un fade-in suave al navegar.
// Usa animación CSS pura (sin motion.div) para no crear un containing block
// para position:fixed — Framer Motion puede aplicar will-change/transform
// que confinarían los modales dentro del wrapper en lugar del viewport.
export function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  )
}
