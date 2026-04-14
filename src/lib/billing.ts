// src/lib/billing.ts
// Configuración central de planes y lógica de billing

import type { PlanId, PlanConfig } from '@/types'

// ─── Configuración de planes ─────────────────────────────────────────────────

export const PLANES: Record<PlanId, PlanConfig> = {
  trial: {
    id: 'trial',
    nombre: 'Trial',
    precioUSD: 0,
    empleadosIncluidos: 3,
    extraPorEmpleado: 0,
    modulos: ['M1', 'M2'],
  },
  pro: {
    id: 'pro',
    nombre: 'Pro',
    precioUSD: 50,
    empleadosIncluidos: 15,
    extraPorEmpleado: 3,
    modulos: ['M1', 'M2', 'M3', 'M4'],
  },
  enterprise: {
    id: 'enterprise',
    nombre: 'Enterprise',
    precioUSD: 150,
    empleadosIncluidos: 50,
    extraPorEmpleado: 2,
    modulos: ['M1', 'M2', 'M3', 'M4'],
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getPlan(plan: string | null | undefined): PlanConfig {
  return PLANES[(plan as PlanId) ?? 'trial'] ?? PLANES.trial
}

export function esTrial(plan: string | null | undefined): boolean {
  return !plan || plan === 'trial'
}

export function moduloHabilitado(plan: string | null | undefined, moduloKey: string): boolean {
  return getPlan(plan).modulos.includes(moduloKey)
}

export function puedeAgregarEmpleado(plan: string | null | undefined, empleadosActuales: number): boolean {
  const p = getPlan(plan)
  // enterprise no tiene límite duro (solo el plan_empleados configurado)
  if (p.id === 'enterprise') return true
  return empleadosActuales < p.empleadosIncluidos
}

export function calcularCostoMensual(plan: PlanId, empleadosActivos: number): number {
  const p = PLANES[plan] ?? PLANES.trial
  if (!p || p.precioUSD === 0) return 0
  const extras = Math.max(0, empleadosActivos - p.empleadosIncluidos)
  return p.precioUSD + extras * p.extraPorEmpleado
}

export function getPlanFeatureList(planId: PlanId): string[] {
  switch (planId) {
    case 'trial':
      return [
        'Hasta 3 empleados',
        'Módulos M1 y M2',
        'Dashboard admin básico',
      ]
    case 'pro':
      return [
        'Hasta 15 empleados incluidos',
        'Todos los módulos (M1–M4)',
        'Asistente IA conversacional',
        'Reportes y encuestas de pulso',
        'Organigrama y equipo',
        '$3 por empleado adicional',
      ]
    case 'enterprise':
      return [
        '50 empleados incluidos',
        'Todos los módulos (M1–M4)',
        'Asistente IA conversacional',
        'Reportes avanzados',
        'Soporte prioritario',
        '$2 por empleado adicional',
      ]
  }
}

// Mensajes estándar de upgrade
export const UPGRADE_MSG = {
  modulo: 'Este módulo está disponible en el plan Pro. Upgradeá para activarlo.',
  empleados: (max: number) =>
    `Tu plan incluye hasta ${max} empleados. Upgradeá para agregar más.`,
} as const
