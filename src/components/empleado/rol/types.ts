// Tipos compartidos del módulo Rol (M3) — extraídos de src/app/empleado/rol/page.tsx

import type React from 'react'

// Configuración visual por estado de objetivo (se construye en la página con i18n)
export type EstadoObjetivoConfig = Record<string, {
  label: string
  variant: 'default' | 'warning' | 'success'
  Icon: React.FC<{ className?: string }>
  color: string
  bg: string
  border: string
}>
