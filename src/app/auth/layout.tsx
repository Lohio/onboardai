'use client'

import { useEffect } from 'react'

// El login/register siempre en tema oscuro, sin importar la preferencia guardada
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement
    ;['theme-dark', 'theme-light', 'theme-gray'].forEach(t => html.classList.remove(t))
    // Sin clase = :root styles = tema oscuro por defecto
  }, [])

  return <>{children}</>
}
