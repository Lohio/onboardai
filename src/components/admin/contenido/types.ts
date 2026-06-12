// ─────────────────────────────────────────────
// Tipos compartidos de la página de contenido (admin)
// ─────────────────────────────────────────────

import type { ReactNode } from 'react'
import type { BloqueContenido } from '@/components/admin/BloqueContenidoForm'

export type CapaKey = 'empresa' | 'area' | 'rol' | 'empleado'

export interface CapaDef {
  key: CapaKey
  label: string
  icon: ReactNode
}

export interface EmpleadoConNotas {
  id: string
  nombre: string
  puesto: string | null
  area: string | null
  notas_ia: string | null
}

// Estado del formulario inline de la capa empresa (nuevo / edición)
export type FormularioEmpresa = { modulo: string; bloque?: BloqueContenido } | null
