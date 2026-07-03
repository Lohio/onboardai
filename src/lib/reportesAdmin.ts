// ─────────────────────────────────────────────
// Carga de datos de la vista de reportes admin (Kanban por franja).
// Compartida entre el Server Component (carga inicial con
// createServerSupabaseClient) y el Client Component (retry con
// createClient dentro del callback).
// ─────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export type FranjaKey = '30d' | '60d' | '90d' | 'graduados'

export interface EmpleadoReporte {
  id: string
  nombre: string
  puesto: string | null
  foto_url: string | null
  fecha_ingreso: string | null
  diasOnboarding: number
  franja: FranjaKey
  progreso: number          // 0–100
  progresoEsperado: number  // meta según franja
  enMeta: boolean
  estancado: boolean
  ultimaActividad: string | null
}

/** Fila de la query de progreso_modulos */
interface ProgresoRow {
  usuario_id: string
  completado: boolean
  created_at: string
}

export interface DatosReportesAdmin {
  empleados: EmpleadoReporte[]
}

export function datosReportesVacios(): DatosReportesAdmin {
  return { empleados: [] }
}

// ─────────────────────────────────────────────
// Constantes de franja
// ─────────────────────────────────────────────

export const FRANJAS: { key: FranjaKey; label: string; diaMin: number; diaMax: number; meta: number }[] = [
  { key: '30d', label: '30 días',   diaMin: 0,  diaMax: 30,  meta: 25 },
  { key: '60d', label: '60 días',   diaMin: 31, diaMax: 60,  meta: 60 },
  { key: '90d', label: '90 días',   diaMin: 61, diaMax: 90,  meta: 90 },
  { key: 'graduados', label: 'Graduados', diaMin: 91, diaMax: Infinity, meta: 90 },
]

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function diasDesdeIngreso(fechaIngreso: string | null): number {
  if (!fechaIngreso) return 0
  const diffMs = Date.now() - new Date(fechaIngreso).getTime()
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

function getFranja(dias: number): FranjaKey {
  if (dias <= 30) return '30d'
  if (dias <= 60) return '60d'
  if (dias <= 90) return '90d'
  return 'graduados'
}

function getMetaPorFranja(franja: FranjaKey): number {
  return FRANJAS.find(f => f.key === franja)?.meta ?? 90
}

function esEstancado(ultimaActividad: string | null): boolean {
  if (!ultimaActividad) return true
  const sietesDias = 7 * 24 * 60 * 60 * 1000
  return Date.now() - new Date(ultimaActividad).getTime() > sietesDias
}

// ─────────────────────────────────────────────
// Carga principal
// ─────────────────────────────────────────────

export async function cargarReportesAdmin(
  supabase: SupabaseClient,
  empresaId: string
): Promise<DatosReportesAdmin> {
  // 1. Empleados de la empresa
  const { data: usuariosRaw } = await supabase
    .from('usuarios')
    .select('id, nombre, puesto, foto_url, fecha_ingreso')
    .eq('empresa_id', empresaId)
    .eq('rol', 'empleado')
    .order('fecha_ingreso', { ascending: true })

  if (!usuariosRaw || usuariosRaw.length === 0) {
    return datosReportesVacios()
  }

  const empleadoIds = usuariosRaw.map(u => u.id)

  // 2 y 3 en paralelo: progreso_modulos y total de bloques de conocimiento
  const [progresoRes, totalBloquesRes] = await Promise.all([
    supabase
      .from('progreso_modulos')
      .select('usuario_id, completado, created_at')
      .in('usuario_id', empleadoIds),
    supabase
      .from('conocimiento')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresaId),
  ])

  const progresoRows: ProgresoRow[] = (progresoRes.data ?? []) as ProgresoRow[]
  const totalBloques = Math.max(totalBloquesRes.count ?? 1, 1)

  // ── Procesar datos por empleado ──
  const empleados: EmpleadoReporte[] = usuariosRaw.map(u => {
    const filasUsuario = progresoRows.filter(r => r.usuario_id === u.id)

    // Progreso: bloques completados / total
    const completados = filasUsuario.filter(r => r.completado).length
    const progreso = Math.min(100, Math.round((completados / totalBloques) * 100))

    // Última actividad: max created_at entre sus filas
    const ultimaActividad = filasUsuario.length > 0
      ? filasUsuario.reduce((max, r) => r.created_at > max ? r.created_at : max, filasUsuario[0].created_at)
      : null

    const diasOnboarding = diasDesdeIngreso(u.fecha_ingreso)
    const franja = getFranja(diasOnboarding)
    const progresoEsperado = getMetaPorFranja(franja)

    return {
      id: u.id,
      nombre: u.nombre ?? '',
      puesto: u.puesto ?? null,
      foto_url: u.foto_url ?? null,
      fecha_ingreso: u.fecha_ingreso ?? null,
      diasOnboarding,
      franja,
      progreso,
      progresoEsperado,
      enMeta: progreso >= progresoEsperado,
      estancado: esEstancado(ultimaActividad),
      ultimaActividad,
    }
  })

  return { empleados }
}
