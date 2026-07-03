// ─────────────────────────────────────────────
// Carga de datos del dashboard interno (dev).
// Compartida entre el Server Component (carga inicial con
// createServerSupabaseClient) y el Client Component (retry /
// refrescar con createClient).
// ─────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/types'

export interface Metricas {
  totalEmpresas: number
  totalUsuarios: number
  usuariosPorRol: Record<string, number>
  mensajesIA24h: number
  conversacionesTotales: number
  empresasPorPlan: Record<string, number>
  mensajesPorDia: { dia: string; mensajes: number }[]
}

export interface ErrorLog {
  id: string
  mensaje: string
  created_at: string
}

export interface DatosDashboardDev {
  metricas: Metricas
  errores: ErrorLog[]
}

function metricasVacias(): Metricas {
  return {
    totalEmpresas: 0,
    totalUsuarios: 0,
    usuariosPorRol: {},
    mensajesIA24h: 0,
    conversacionesTotales: 0,
    empresasPorPlan: {},
    mensajesPorDia: buildMensajesPorDia([]),
  }
}

export function datosDashboardDevVacios(): DatosDashboardDev {
  return { metricas: metricasVacias(), errores: [] }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function buildMensajesPorDia(rows: { created_at: string }[]): { dia: string; mensajes: number }[] {
  const hoy = new Date()
  const resultado: { dia: string; mensajes: number }[] = []

  for (let i = 6; i >= 0; i--) {
    const fecha = new Date(hoy)
    fecha.setDate(hoy.getDate() - i)
    const yyyy = fecha.getFullYear()
    const mm = String(fecha.getMonth() + 1).padStart(2, '0')
    const dd = String(fecha.getDate()).padStart(2, '0')
    const key = `${yyyy}-${mm}-${dd}`
    const count = rows.filter(r => r.created_at.startsWith(key)).length
    resultado.push({ dia: DIAS_SEMANA[fecha.getDay()], mensajes: count })
  }

  return resultado
}

export async function cargarDashboardDev(supabase: SupabaseClient): Promise<DatosDashboardDev> {
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const hace7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalEmpresas },
    { data: rolData },
    { count: mensajesIA24h },
    { count: conversacionesTotales },
    { data: planData },
    { data: mensajes7dData },
  ] = await Promise.all([
    supabase.from('empresas').select('*', { count: 'exact', head: true }),
    supabase.from('usuarios').select('rol'),
    supabase
      .from('mensajes_ia')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', hace24h)
      .eq('rol', 'assistant'),
    supabase.from('conversaciones_ia').select('*', { count: 'exact', head: true }),
    supabase.from('empresas').select('plan'),
    supabase
      .from('mensajes_ia')
      .select('created_at')
      .gte('created_at', hace7d)
      .eq('rol', 'assistant'),
  ])

  // Calcular usuarios por rol
  const porRol: Record<string, number> = {}
  for (const u of (rolData ?? [])) {
    const r = u.rol as UserRole
    porRol[r] = (porRol[r] ?? 0) + 1
  }

  // Calcular empresas por plan
  const porPlan: Record<string, number> = {}
  for (const e of (planData ?? [])) {
    const p = (e.plan as string) ?? 'free'
    porPlan[p] = (porPlan[p] ?? 0) + 1
  }

  // Agregar mensajes por día (últimos 7 días)
  const mensajesPorDia = buildMensajesPorDia((mensajes7dData ?? []) as { created_at: string }[])

  const metricas: Metricas = {
    totalEmpresas: totalEmpresas ?? 0,
    totalUsuarios: (rolData ?? []).length,
    usuariosPorRol: porRol,
    mensajesIA24h: mensajesIA24h ?? 0,
    conversacionesTotales: conversacionesTotales ?? 0,
    empresasPorPlan: porPlan,
    mensajesPorDia,
  }

  // Errores recientes (tabla puede no existir — no bloqueante)
  let errores: ErrorLog[] = []
  try {
    const { data: errorData, error } = await supabase
      .from('error_logs')
      .select('id, mensaje, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    if (error) {
      console.warn('[DashboardDev] error_logs:', error.message)
    } else {
      errores = (errorData ?? []) as ErrorLog[]
    }
  } catch {
    // tabla error_logs no existe — se omite silenciosamente
  }

  return { metricas, errores }
}
