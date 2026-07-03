// ─────────────────────────────────────────────
// Carga de datos del dashboard admin.
// Compartida entre el Server Component (carga inicial con
// createServerSupabaseClient) y el Client Component (recargas
// por Supabase Realtime con createClient).
// ─────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdminEmpleadoConProgreso } from '@/types'

export interface AlertaConocimientoRow {
  id: string
  pregunta: string
  usuario_id: string
  created_at: string
  resuelta: boolean
  usuarios: { nombre: string }[] | null
}

export interface DatosDashboardAdmin {
  empleados: AdminEmpleadoConProgreso[]
  alertas: AlertaConocimientoRow[]
  chartData: { nombre: string; progreso: number }[]
}

interface ProgresoRow {
  usuario_id: string
  modulo: string
  bloque: string
  completado: boolean
}

export function datosDashboardVacios(): DatosDashboardAdmin {
  return { empleados: [], alertas: [], chartData: [] }
}

// ─────────────────────────────────────────────
// Helpers de cálculo
// ─────────────────────────────────────────────

function calcularProgreso(userId: string, progresoRows: ProgresoRow[], totalBloques: number): number {
  const completados = progresoRows.filter(p => p.usuario_id === userId && p.completado).length
  return totalBloques > 0 ? Math.min(100, Math.round((completados / totalBloques) * 100)) : 0
}

function calcularPromedioModulo(
  progresoRows: ProgresoRow[], empleadoIds: string[], modulo: string, totalBloques: number
): number {
  if (empleadoIds.length === 0 || totalBloques === 0) return 0
  const suma = empleadoIds.reduce((acc, uid) => {
    const completados = progresoRows.filter(p => p.usuario_id === uid && p.modulo === modulo && p.completado).length
    return acc + Math.min(100, Math.round((completados / totalBloques) * 100))
  }, 0)
  return Math.round(suma / empleadoIds.length)
}

// ─────────────────────────────────────────────
// Carga principal
// ─────────────────────────────────────────────

export async function cargarDashboardAdmin(
  supabase: SupabaseClient,
  empresaId: string
): Promise<DatosDashboardAdmin> {
  const { data: empleadosRaw } = await supabase
    .from('usuarios')
    .select('id, nombre, puesto, area, foto_url, fecha_ingreso')
    .eq('empresa_id', empresaId)
    .eq('rol', 'empleado')

  if (!empleadosRaw || empleadosRaw.length === 0) {
    return datosDashboardVacios()
  }

  const empleadoIds = empleadosRaw.map(e => e.id)

  const [progresoRes, alertasRes, culturaCountRes, rolCountRes] = await Promise.all([
    supabase.from('progreso_modulos').select('usuario_id, modulo, bloque, completado').in('usuario_id', empleadoIds),
    supabase.from('alertas_conocimiento')
      .select('id, pregunta, usuario_id, created_at, resuelta, usuarios(nombre)')
      .eq('empresa_id', empresaId).eq('resuelta', false).order('created_at', { ascending: false }).limit(8),
    supabase.from('conocimiento').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('modulo', 'cultura'),
    supabase.from('conocimiento').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('modulo', 'rol'),
  ])

  const progresoRows: ProgresoRow[] = (progresoRes.data ?? []) as ProgresoRow[]
  const totalBloquesCultura = culturaCountRes.count ?? 0
  const totalBloquesRol = Math.max(1, rolCountRes.count ?? 1)
  const totalBloques = totalBloquesCultura + totalBloquesRol

  const empleados: AdminEmpleadoConProgreso[] = empleadosRaw.map(e => ({
    id: e.id, nombre: e.nombre ?? '', puesto: e.puesto ?? undefined,
    area: e.area ?? undefined, foto_url: e.foto_url ?? undefined,
    fecha_ingreso: e.fecha_ingreso ?? undefined,
    progreso: calcularProgreso(e.id, progresoRows, totalBloques),
  }))

  const avgCultura = calcularPromedioModulo(progresoRows, empleadoIds, 'cultura', totalBloquesCultura)
  const avgRol = calcularPromedioModulo(progresoRows, empleadoIds, 'rol', totalBloquesRol)

  return {
    empleados,
    alertas: (alertasRes.data ?? []) as AlertaConocimientoRow[],
    chartData: [
      { nombre: 'Cultura', progreso: avgCultura },
      { nombre: 'Rol', progreso: avgRol },
    ],
  }
}
