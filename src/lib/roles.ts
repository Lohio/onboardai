import type { UserRole } from '@/types'
import { createClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// Helpers de rol
// ─────────────────────────────────────────────

export function isAdmin(rol: UserRole): boolean {
  return rol === 'admin'
}

export function isDev(rol: UserRole): boolean {
  return rol === 'dev'
}

/**
 * Valida si un rol tiene acceso a una ruta dada.
 * - empleado → solo /empleado/* y /auth/*
 * - admin    → /admin/* y /auth/*
 * - dev      → todo
 */
export function canAccessRoute(rol: UserRole, pathname: string): boolean {
  if (rol === 'dev') return true

  if (pathname.startsWith('/auth')) return true

  if (rol === 'admin') return pathname.startsWith('/admin')

  if (rol === 'empleado') return pathname.startsWith('/empleado')

  return false
}

/**
 * Consulta el rol del usuario desde la tabla usuarios.
 * Usa el cliente browser (solo llamar desde Client Components o API routes).
 */
export async function getRolFromSupabase(userId: string): Promise<UserRole> {
  const supabase = createClient()
  const { data } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', userId)
    .single()

  return (data?.rol as UserRole) ?? 'empleado'
}
