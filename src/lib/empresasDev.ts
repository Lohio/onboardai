// ─────────────────────────────────────────────
// Carga de datos del panel de empresas (dev).
// Compartida entre el Server Component (carga inicial con
// createServerSupabaseClient) y el Client Component (retry
// con createClient).
// ─────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'

export type Plan = 'free' | 'starter' | 'pro' | 'enterprise'

export interface AdminRow {
  id: string
  nombre: string
  email: string
}

export interface Empresa {
  id: string
  nombre: string
  slug: string | null
  plan: Plan | null
  created_at: string
  admins: AdminRow[]
  userCount: number
}

export interface UsuarioLite {
  id: string
  nombre: string
  email: string
  empresa_id: string
}

export interface DatosEmpresasDev {
  empresas: Empresa[]
  allUsers: UsuarioLite[]
}

export function datosEmpresasVacios(): DatosEmpresasDev {
  return { empresas: [], allUsers: [] }
}

interface UsuarioRow {
  id: string
  nombre: string
  email: string
  rol: string
  empresa_id: string
}

export async function cargarEmpresasDev(supabase: SupabaseClient): Promise<DatosEmpresasDev> {
  const [{ data: empData }, { data: usersData }] = await Promise.all([
    supabase.from('empresas').select('id, nombre, slug, plan, created_at').order('created_at', { ascending: false }),
    supabase.from('usuarios').select('id, nombre, email, rol, empresa_id').order('nombre'),
  ])

  const usrs = (usersData ?? []) as UsuarioRow[]

  // Agrupar usuarios por empresa una sola vez (O(n)) en lugar de filtrar
  // el array completo por cada empresa (O(n·m)). El orden por nombre se conserva.
  const usuariosPorEmpresa = new Map<string, UsuarioRow[]>()
  for (const u of usrs) {
    const lista = usuariosPorEmpresa.get(u.empresa_id)
    if (lista) lista.push(u)
    else usuariosPorEmpresa.set(u.empresa_id, [u])
  }

  const empresas: Empresa[] = (empData ?? []).map(e => {
    const empUsers = usuariosPorEmpresa.get(e.id) ?? []
    return {
      ...e,
      plan: (e.plan as Plan) ?? null,
      admins: empUsers.filter(u => u.rol === 'admin').map(u => ({ id: u.id, nombre: u.nombre, email: u.email })),
      userCount: empUsers.length,
    }
  })

  const allUsers: UsuarioLite[] = usrs.map(u => ({ id: u.id, nombre: u.nombre, email: u.email, empresa_id: u.empresa_id }))

  return { empresas, allUsers }
}
