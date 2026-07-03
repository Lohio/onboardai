// ─────────────────────────────────────────────
// Carga de datos base del home del empleado (M5).
// Compartida entre el Server Component (carga inicial con
// createServerSupabaseClient) y el Client Component (retry
// con createClient).
//
// Solo cubre los datos base de carga inicial (usuario + progreso
// + plan + total de bloques de cultura). Los datos lazy por tab
// (equipo, cultura, tareas, conversaciones) y la verificación de
// encuesta de pulso siguen resolviéndose client-side post-render.
// ─────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanItem } from '@/types'
import { calcularEstadoModulos, calcularProgresoPct, type EstadoModulos } from '@/lib/progreso'

export interface DatosBaseEmpleado {
  id: string
  nombre: string
  puesto?: string
  area?: string
  empresa_id: string
  fecha_ingreso?: string
  foto_url?: string
  modalidad?: string
  email: string
}

export interface DatosHomeEmpleado {
  datosBase: DatosBaseEmpleado | null
  estadoModulos: EstadoModulos
  progresoPct: number
  planItems: PlanItem[]
  totalBloquesCultura: number
}

export function datosHomeVacios(): DatosHomeEmpleado {
  return {
    datosBase: null,
    estadoModulos: { M1: true, M2: false, M3: false, M4: false },
    progresoPct: 0,
    planItems: [],
    totalBloquesCultura: 5,
  }
}

// ─────────────────────────────────────────────
// Carga principal
// ─────────────────────────────────────────────

export async function cargarHomeEmpleado(
  supabase: SupabaseClient,
  userId: string
): Promise<DatosHomeEmpleado> {
  const datos = datosHomeVacios()

  // Datos del usuario, progreso y plan en paralelo
  const [usuarioRes, progresoRes, planRes] = await Promise.all([
    supabase
      .from('usuarios')
      .select('id, nombre, puesto, area, empresa_id, fecha_ingreso, foto_url, modalidad, email')
      .eq('id', userId)
      .single(),
    supabase
      .from('progreso_modulos')
      .select('modulo, bloque, completado')
      .eq('usuario_id', userId),
    supabase
      .from('plan_30_60_90')
      .select('*')
      .eq('usuario_id', userId)
      .order('orden', { ascending: true }),
  ])

  const usuario = usuarioRes.data
  if (!usuario) return datos

  datos.datosBase = usuario as DatosBaseEmpleado
  datos.planItems = (planRes.data ?? []) as PlanItem[]

  // Ahora que tenemos empresa_id, consultamos el total de bloques de cultura
  const culturaCountRes = await supabase
    .from('conocimiento')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', usuario.empresa_id)
    .eq('modulo', 'cultura')

  const progresoRows = progresoRes.data ?? []
  const totalCultura = culturaCountRes.count ?? 5
  datos.totalBloquesCultura = totalCultura

  const estados = calcularEstadoModulos(progresoRows, totalCultura)
  datos.estadoModulos = estados
  datos.progresoPct = calcularProgresoPct(estados)

  return datos
}
