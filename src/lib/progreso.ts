// ─────────────────────────────────────────────
// Lógica centralizada de cálculo de progreso de módulos y plan 30-60-90
// Usado por: layout del empleado, home del empleado, admin dashboard
// ─────────────────────────────────────────────

import type { ProgresoModulo, PlanFase, PlanItem } from '@/types'

// ─── Plan 30-60-90 ────────────────────────────────────────────

/**
 * Devuelve la fase del plan (30/60/90) correspondiente a la fecha de ingreso.
 */
export function calcularFaseActual(fechaIngreso: string): PlanFase {
  const dias = Math.floor(
    (Date.now() - new Date(fechaIngreso).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (dias <= 30) return '30'
  if (dias <= 60) return '60'
  return '90'
}

/**
 * Devuelve el día de onboarding (1-based) a partir de la fecha de ingreso.
 */
export function calcularDiaOnboarding(fechaIngreso: string): number {
  return Math.max(1, Math.floor(
    (Date.now() - new Date(fechaIngreso).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1)
}

/** Porcentaje de ítems completados en una fase del plan 30-60-90. */
export function calcularProgresoPlanFase(items: PlanItem[], fase: PlanFase): number {
  const faseItems = items.filter(i => i.fase === fase)
  if (faseItems.length === 0) return 0
  return Math.round((faseItems.filter(i => i.completado).length / faseItems.length) * 100)
}

/** Porcentaje global de ítems completados en todo el plan 30-60-90. */
export function calcularProgresoPlanGlobal(items: PlanItem[]): number {
  if (items.length === 0) return 0
  return Math.round((items.filter(i => i.completado).length / items.length) * 100)
}

export interface EstadoModulos {
  M1: boolean
  M2: boolean
  M3: boolean
  M4: boolean
}

/**
 * Calcula el estado de completado de cada módulo dado un array de filas
 * de progreso_modulos y el total de bloques de cultura de la empresa.
 *
 * - M1: siempre true (el empleado llegó hasta aquí)
 * - M2: requiere completar TODOS los bloques de cultura de la empresa
 * - M3: al menos un bloque de "rol" completado
 * - M4: al menos un bloque de "asistente" completado
 */
export function calcularEstadoModulos(
  progresoRows: Pick<ProgresoModulo, 'modulo' | 'bloque' | 'completado'>[],
  totalBloquesCultura: number
): EstadoModulos {
  const culturaCompletados = progresoRows.filter(
    r => r.modulo === 'cultura' && r.completado
  ).length

  return {
    M1: true,
    M2: totalBloquesCultura > 0
      ? culturaCompletados >= totalBloquesCultura
      : false,
    M3: progresoRows.some(r => r.modulo === 'rol' && r.completado),
    M4: progresoRows.some(r => r.modulo === 'asistente' && r.completado),
  }
}

/**
 * Calcula el porcentaje de progreso global (0-100) sobre 3 módulos (M1, M2, M3).
 * M4 (asistente) queda fuera del cómputo de progreso principal.
 */
export function calcularProgresoPct(estado: EstadoModulos): number {
  const completados = [estado.M1, estado.M2, estado.M3].filter(Boolean).length
  return Math.round((completados / 3) * 100)
}

/**
 * Determina si un módulo está desbloqueado.
 * Los módulos se desbloquean secuencialmente (M2 requiere M1, etc.)
 * En preboarding, M3 y M4 siempre están bloqueados.
 */
export function isModuloDesbloqueado(
  idx: number,
  estadoModulos: boolean[],
  enPreboarding: boolean
): boolean {
  if (enPreboarding && (idx === 2 || idx === 3)) return false
  if (idx === 0) return true
  return estadoModulos[idx - 1]
}
