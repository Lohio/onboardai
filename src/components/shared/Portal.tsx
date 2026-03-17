'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renderiza sus hijos directamente en document.body via portal.
 * Evita que CSS de ancestros (backdrop-filter, transform, overflow)
 * confinen position:fixed de modales al área de contenido en vez del viewport.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) return null
  return createPortal(children, document.body)
}
