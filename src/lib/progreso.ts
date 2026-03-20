// ─────────────────────────────────────────────
// Lógica centralizada de cálculo de progreso de módulos
// Usado por: layout del empleado, home del empleado, admin dashboard
// ─────────────────────────────────────────────

import type { ProgresoModulo } from '@/types'

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
 * Calcula el porcentaje de progreso global (0-100) a partir del estado de módulos.
 */
export function calcularProgresoPct(estado: EstadoModulos): number {
  const completados = Object.values(estado).filter(Boolean).length
  return Math.round((completados / 4) * 100)
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
