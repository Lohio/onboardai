// ─────────────────────────────────────────────
// Helpers compartidos del detalle de empleado (admin)
// ─────────────────────────────────────────────

import { BookOpen, Wrench, MessageSquare } from 'lucide-react'
import type { AccesoRow } from './types'

export function getInitials(nombre: string): string {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export function formatFecha(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatFechaCorta(d: string): string {
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

export function inputCls(error?: boolean): string {
  return [
    'w-full h-9 px-3 rounded-lg text-sm bg-white/[0.04] border text-white/85',
    'placeholder:text-white/20 outline-none transition-colors duration-150',
    'focus:bg-white/[0.06] focus:border-[#0EA5E9]/60',
    error ? 'border-red-500/50' : 'border-white/[0.08]',
  ].join(' ')
}

export function renderLinea(line: string, key: number): React.ReactNode {
  if (line.startsWith('## ')) {
    return <h3 key={key} className="text-sm font-semibold text-white/90 mt-5 mb-2 first:mt-0">{line.slice(3)}</h3>
  }
  if (line.startsWith('- ')) {
    return <li key={key} className="text-sm text-white/65 ml-4 list-disc">{line.slice(2)}</li>
  }
  if (line.trim() === '') return <br key={key} />
  return <p key={key} className="text-sm text-white/65 leading-relaxed">{line}</p>
}

export const MODULOS_CONFIG = [
  { key: 'cultura' as const, label: 'Cultura', icon: <BookOpen className="w-3.5 h-3.5" />, color: 'text-gray-900' },
  { key: 'rol' as const, label: 'Rol y herramientas', icon: <Wrench className="w-3.5 h-3.5" />, color: 'text-gray-900' },
  { key: 'asistente' as const, label: 'CopilBot', icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-gray-900' },
]

// ── Herramienta "configurada": activa con usuario o contraseña cargados ──
export function isConfigured(a: AccesoRow): boolean {
  return a.estado === 'activo' && !!(a.usuario_acceso?.trim() || a.password_acceso?.trim())
}
