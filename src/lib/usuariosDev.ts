// ─────────────────────────────────────────────
// Carga de datos del panel de usuarios (dev).
// Compartida entre el Server Component (carga inicial con
// createServerSupabaseClient) y el Client Component (retry
// con createClient).
// ─────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/types'

export interface UsuarioRow {
  id: string
  nombre: string
  email: string
  rol: UserRole
  empresa_id: string | null
  empresa_nombre: string | null
  created_at: string
}

export interface EmpresaOption {
  id: string
  nombre: string
}

export interface DatosUsuariosDev {
  usuarios: UsuarioRow[]
  empresas: EmpresaOption[]
}

export function datosUsuariosVacios(): DatosUsuariosDev {
  return { usuarios: [], empresas: [] }
}

export async function cargarUsuariosDev(supabase: SupabaseClient): Promise<DatosUsuariosDev> {
  const [{ data: usersData }, { data: empData }] = await Promise.all([
    supabase
      .from('usuarios')
      .select('id, nombre, email, rol, empresa_id, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('empresas')
      .select('id, nombre')
      .order('nombre'),
  ])

  const empMap: Record<string, string> = {}
  for (const e of (empData ?? [])) empMap[e.id] = e.nombre

  const usuarios: UsuarioRow[] = (usersData ?? []).map(u => ({
    ...u,
    rol: u.rol as UserRole,
    empresa_nombre: u.empresa_id ? (empMap[u.empresa_id] ?? null) : null,
  }))

  const empresas = (empData ?? []) as EmpresaOption[]

  return { usuarios, empresas }
}
