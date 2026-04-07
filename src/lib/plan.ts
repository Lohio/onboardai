// ─── Configuración compartida del Plan 30-60-90 ───────────────────────────────
// Usada por: src/app/empleado/plan/page.tsx y src/app/empleado/page.tsx

export const FASES_CONFIG = {
  '30': {
    label: 'Días 1-30',
    titulo: 'Aprender',
    descripcion: 'Conocé la empresa, las herramientas y a tu equipo. Completá los módulos de cultura y perfil.',
    color: 'teal',
    iconBg: 'bg-teal-500/15',
    iconText: 'text-teal-400',
  },
  '60': {
    label: 'Días 31-60',
    titulo: 'Contribuir',
    descripcion: 'Empezá a aportar en proyectos reales. Colaborá con tu equipo y tomá ownership de tareas.',
    color: 'amber',
    iconBg: 'bg-amber-500/15',
    iconText: 'text-amber-400',
  },
  '90': {
    label: 'Días 61-90',
    titulo: 'Liderar',
    descripcion: 'Demostrá autonomía. Proponé mejoras, liderá iniciativas y consolidá tu impacto.',
    color: 'indigo',
    iconBg: 'bg-indigo-500/15',
    iconText: 'text-indigo-400',
  },
} as const

export const COLOR_EXTRAS: Record<string, { border: string; dot: string; ring: string }> = {
  teal:   { border: 'border-teal-500/30',   dot: 'bg-teal-400',   ring: '#0D9488' },
  amber:  { border: 'border-amber-500/30',  dot: 'bg-amber-400',  ring: '#F59E0B' },
  indigo: { border: 'border-indigo-500/30', dot: 'bg-indigo-400', ring: '#6366F1' },
}
