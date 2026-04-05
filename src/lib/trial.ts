// src/lib/trial.ts
// Reglas del plan trial. Importar desde cualquier componente o API route.

export const TRIAL_LIMITS = {
  maxEmpleados: 3,
  modulosHabilitados: ['M1', 'M2'] as string[],
} as const

export function esTrial(plan: string | null | undefined): boolean {
  return !plan || plan === 'trial'
}

export function moduloHabilitadoEnTrial(moduloKey: string): boolean {
  return TRIAL_LIMITS.modulosHabilitados.includes(moduloKey)
}

// Mensaje estándar de upgrade para mostrar en toda la app
export const UPGRADE_MSG = {
  modulo:    'Disponible en el plan Pro. Contactá a ventas para activarlo.',
  empleados: `El trial permite hasta ${TRIAL_LIMITS.maxEmpleados} empleados. Upgradeá para agregar más.`,
} as const
