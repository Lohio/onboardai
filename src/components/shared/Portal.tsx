'use client'

import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

// Sin suscripción real: solo distingue server (false) de cliente hidratado (true)
const subscribeNoop = () => () => {}

/**
 * Renderiza sus hijos directamente en document.body via portal.
 * Evita que CSS de ancestros (backdrop-filter, transform, overflow)
 * confinen position:fixed de modales al área de contenido en vez del viewport.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false)

  if (!mounted) return null
  return createPortal(children, document.body)
}
