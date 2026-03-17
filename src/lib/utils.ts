import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Combina clases de Tailwind resolviendo conflictos correctamente
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Iniciales del nombre (ej: "Juan Pérez" → "JP")
export function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Formatea fecha ISO a formato corto en español (ej: "12 ene. 2024")
export function formatFecha(dateStr?: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Clase de color de fondo según porcentaje — semáforo (≥70 teal, ≥30 amber, <30 rojo)
export function semaforoColor(progreso: number): string {
  if (progreso > 70) return 'bg-teal-500'
  if (progreso >= 30) return 'bg-amber-500'
  return 'bg-red-500'
}

// Días transcurridos desde una fecha hasta hoy (mínimo 1)
export function diasDesde(fechaStr?: string | null): number | null {
  if (!fechaStr) return null
  return Math.max(1, Math.ceil((Date.now() - new Date(fechaStr).getTime()) / (1000 * 60 * 60 * 24)))
}
