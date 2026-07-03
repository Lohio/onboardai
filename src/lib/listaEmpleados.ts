// ─────────────────────────────────────────────
// Carga de datos de la lista de empleados del admin.
// Compartida entre el Server Component (carga inicial con
// createServerSupabaseClient) y el Client Component (retry/recarga
// con createClient dentro del callback).
// ─────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/types'

export interface EmpleadoConProgreso {
  id: string
  nombre: string
  email: string
  puesto: string | null
  area: string | null
  fecha_ingreso: string | null
  modalidad_trabajo: string | null
  rol: UserRole
  progreso: number
}

export interface DatosListaEmpleados {
  empleados: EmpleadoConProgreso[]
  rolAdmin: UserRole
}

export function datosListaEmpleadosVacios(): DatosListaEmpleados {
  return { empleados: [], rolAdmin: 'admin' }
}

interface EmpleadoRow {
  id: string
  nombre: string
  email: string
  puesto: string | null
  area: string | null
  fecha_ingreso: string | null
  modalidad_trabajo: string | null
  rol: UserRole
}

// ─────────────────────────────────────────────
// Carga principal
// ─────────────────────────────────────────────

export async function cargarListaEmpleados(
  supabase: SupabaseClient,
  empresaId: string
): Promise<EmpleadoConProgreso[]> {
  const { data: rows } = await supabase
    .from('usuarios')
    .select('id, nombre, email, puesto, area, fecha_ingreso, modalidad_trabajo, rol')
    .eq('empresa_id', empresaId)
    .eq('rol', 'empleado')
    .order('nombre')

  const empRows = (rows ?? []) as EmpleadoRow[]
  const empIds = empRows.map(e => e.id)

  const { count: totalBloques } = await supabase
    .from('conocimiento')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)

  const { data: progresoRows } = await supabase
    .from('progreso_modulos')
    .select('usuario_id, completado')
    .in('usuario_id', empIds)
    .eq('completado', true)

  const completadosPorUsuario: Record<string, number> = {}
  for (const row of (progresoRows ?? [])) {
    completadosPorUsuario[row.usuario_id] = (completadosPorUsuario[row.usuario_id] ?? 0) + 1
  }

  const total = Math.max(totalBloques ?? 1, 1)

  return empRows.map(e => ({
    ...e,
    progreso: Math.min(100, Math.round(((completadosPorUsuario[e.id] ?? 0) / total) * 100)),
  }))
}
