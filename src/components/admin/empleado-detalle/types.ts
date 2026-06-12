// ─────────────────────────────────────────────
// Tipos compartidos del detalle de empleado (admin)
// ─────────────────────────────────────────────

import type { UserRole } from '@/types'

export interface EmpleadoFull {
  id: string
  nombre: string
  email: string
  puesto: string | null
  area: string | null
  fecha_ingreso: string | null
  modalidad: string | null
  manager_id: string | null
  buddy_id: string | null
  bio: string | null
  rol: UserRole
  foto_url: string | null
  contacto_it_nombre: string | null
  contacto_it_email: string | null
  contacto_rrhh_nombre: string | null
  contacto_rrhh_email: string | null
  preboarding_activo: boolean
  fecha_acceso_preboarding: string | null
  password_corporativo: string | null
  password_bitlocker: string | null
  rol_responsabilidades: string[] | null
  rol_kpis: string[] | null
  rol_herramientas: Array<{ nombre: string; uso: string }> | null
  rol_autonomia: string | null
}

export interface FormData {
  nombre: string
  puesto: string
  area: string
  fecha_ingreso: string
  modalidad: string
  manager_id: string
  buddy_id: string
  bio: string
  rol: UserRole
  contacto_it_nombre: string
  contacto_it_email: string
  contacto_rrhh_nombre: string
  contacto_rrhh_email: string
  password_corporativo: string
  password_bitlocker: string
}

export interface ProgresoModulo {
  modulo: string
  total: number
  completados: number
  pct: number
}

export interface AlertaRow {
  id: string
  pregunta: string
  created_at: string
  resuelta: boolean
}

export interface ColaboradorRow {
  id: string
  nombre: string
  email: string
}

export interface ProgresoModuloChart {
  modulo: string
  label: string
  icon: React.ReactNode
  completados: number
  total: number
  pct: number
}

export interface TimelineEvento {
  id: string
  tipo: 'ingreso' | 'bloque' | 'tarea'
  descripcion: string
  fecha: string
}

export interface PreguntaIA {
  id: string
  pregunta: string
  respuesta: string
  fecha: string
}

export interface TareaPendiente {
  id: string
  titulo: string
  semana: number
}

export interface AccesoRow {
  id: string
  herramienta: string
  estado: 'activo' | 'pendiente' | 'sin_acceso'
  url: string | null
  notas: string | null
  usuario_acceso: string | null
  password_acceso: string | null
}

// Borrador de edición local de un acceso (antes de guardar)
export interface AccesoEditDraft {
  herramienta: string
  estado: AccesoRow['estado']
  usuario_acceso: string
  password_acceso: string
  url: string
  notas: string
}

// Chip seleccionado localmente (antes de guardar en DB)
export interface ChipDraft {
  nombre: string
  usuario: string
  password: string
  showPass: boolean
}

export type TabKey = 'edicion' | 'rol' | 'progreso' | 'plan'
