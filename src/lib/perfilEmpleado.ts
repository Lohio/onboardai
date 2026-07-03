// ─────────────────────────────────────────────
// Carga de datos del perfil del empleado (M1).
// Compartida entre el Server Component (carga inicial con
// createServerSupabaseClient) y el Client Component (retry
// con createClient).
// ─────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Usuario, MiembroEquipo, Acceso } from '@/types'

// Total de bloques requeridos para completar M2 — Cultura
export const CULTURA_TOTAL = 5

export interface EstadoModulos {
  M1: boolean
  M2: boolean
  M3: boolean
}

export interface EncuestaPulsoResumen {
  dia: 7 | 30 | 60
  respondida: boolean
}

// Passwords ya descifradas (el descifrado SIEMPRE es server-side:
// en el server component directo con safeDecrypt, en el cliente vía
// GET /api/empleado/perfil/passwords)
export interface PerfilPasswords {
  password_corporativo: string | null
  password_bitlocker: string | null
}

export interface DatosPerfilEmpleado {
  perfil: Usuario | null
  equipo: MiembroEquipo[]
  accesos: Acceso[]
  accesosRlsBlock: boolean
  herramientaContacto: string
  nombreEmpresa: string
  modulosProgreso: EstadoModulos
  encuestasPulso: EncuestaPulsoResumen[]
}

export function datosPerfilVacios(): DatosPerfilEmpleado {
  return {
    perfil: null,
    equipo: [],
    accesos: [],
    accesosRlsBlock: false,
    herramientaContacto: 'email',
    nombreEmpresa: '',
    modulosProgreso: { M1: true, M2: false, M3: false },
    encuestasPulso: [],
  }
}

// ─────────────────────────────────────────────
// Carga principal
// ─────────────────────────────────────────────

export async function cargarPerfilEmpleado(
  supabase: SupabaseClient,
  userId: string,
  passwords: PerfilPasswords | null
): Promise<DatosPerfilEmpleado> {
  const datos = datosPerfilVacios()

  // 1. Perfil + relaciones + accesos en paralelo
  const [perfilRes, relacionesRes, accesosRes] = await Promise.all([
    supabase
      .from('usuarios')
      .select('id, nombre, puesto, area, email, modalidad, fecha_ingreso, bio, foto_url, empresa_id, manager_id, buddy_id, contacto_it_nombre, contacto_it_email, contacto_rrhh_nombre, contacto_rrhh_email')
      .eq('id', userId)
      .single(),
    supabase
      .from('equipo_relaciones')
      .select('relacion, miembro_id')
      .eq('usuario_id', userId),
    supabase
      .from('accesos_herramientas')
      .select('*')
      .eq('usuario_id', userId)
      .order('herramienta'),
  ])

  const perfilRow = perfilRes.data

  if (perfilRow) {
    // Mezclar passwords descifradas (server-side) con el perfil
    datos.perfil = { ...perfilRow, ...passwords } as Usuario

    // Herramienta de contacto + nombre de la empresa
    const empresaRes = await supabase
      .from('empresas')
      .select('nombre, herramientas_contacto')
      .eq('id', perfilRow.empresa_id)
      .single()
    const herramientas = empresaRes.data?.herramientas_contacto
    if (herramientas && herramientas.length > 0) {
      datos.herramientaContacto = herramientas[0] as string
    }
    if (empresaRes.data?.nombre) {
      datos.nombreEmpresa = empresaRes.data.nombre as string
    }
  }

  if (accesosRes.error) {
    console.warn('[Perfil] accesos_herramientas error:', accesosRes.error.code, accesosRes.error.message)
    // PGRST301 = JWT expired, 42501 = insufficient_privilege (RLS bloqueando)
    if (accesosRes.error.code === '42501' || accesosRes.error.message?.includes('permission')) {
      datos.accesosRlsBlock = true
    }
  } else {
    datos.accesos = (accesosRes.data ?? []) as Acceso[]
  }

  // 2. Miembros del equipo
  // Primero intentar desde equipo_relaciones; si está vacío, fallback a manager_id/buddy_id del perfil
  const ordenEquipo: Record<MiembroEquipo['relacion'], number> = { manager: 0, buddy: 1, companero: 2 }

  if (relacionesRes.data && relacionesRes.data.length > 0) {
    const miembroIds = relacionesRes.data.map(r => r.miembro_id)

    const miembrosRes = await supabase
      .from('usuarios')
      .select('id, nombre, email, puesto, foto_url')
      .in('id', miembroIds)

    if (miembrosRes.data) {
      const miembros: MiembroEquipo[] = relacionesRes.data
        .map(rel => {
          const u = miembrosRes.data.find(m => m.id === rel.miembro_id)
          return {
            id: rel.miembro_id,
            nombre: u?.nombre ?? '',
            email: u?.email ?? '',
            puesto: u?.puesto ?? undefined,
            foto_url: u?.foto_url ?? undefined,
            relacion: rel.relacion as MiembroEquipo['relacion'],
          }
        })
        .filter(m => m.nombre)

      miembros.sort((a, b) => ordenEquipo[a.relacion] - ordenEquipo[b.relacion])
      datos.equipo = miembros
    }
  } else if (perfilRow) {
    // Fallback: resolver manager_id y buddy_id directamente desde usuarios
    const fallbackIds = [perfilRow.manager_id, perfilRow.buddy_id].filter(Boolean) as string[]
    if (fallbackIds.length > 0) {
      const { data: fallbackUsuarios } = await supabase
        .from('usuarios')
        .select('id, nombre, email, puesto, foto_url')
        .in('id', fallbackIds)

      if (fallbackUsuarios) {
        const miembros: MiembroEquipo[] = []
        if (perfilRow.manager_id) {
          const u = fallbackUsuarios.find(m => m.id === perfilRow.manager_id)
          if (u) miembros.push({ id: u.id, nombre: u.nombre, email: u.email, puesto: u.puesto ?? undefined, foto_url: u.foto_url ?? undefined, relacion: 'manager' })
        }
        if (perfilRow.buddy_id) {
          const u = fallbackUsuarios.find(m => m.id === perfilRow.buddy_id)
          if (u) miembros.push({ id: u.id, nombre: u.nombre, email: u.email, puesto: u.puesto ?? undefined, foto_url: u.foto_url ?? undefined, relacion: 'buddy' })
        }
        miembros.sort((a, b) => ordenEquipo[a.relacion] - ordenEquipo[b.relacion])
        datos.equipo = miembros
      }
    }
  }

  // 3. Progreso de módulos (no bloqueante — tabla puede no existir)
  try {
    const { data: rows } = await supabase
      .from('progreso_modulos')
      .select('modulo, bloque, completado')
      .eq('usuario_id', userId)

    const progresoRows = rows ?? []
    const culturaCompletados = progresoRows.filter(
      r => r.modulo === 'cultura' && r.completado
    ).length
    const m2 = culturaCompletados >= CULTURA_TOTAL
    const m3 = progresoRows.some(r => r.modulo === 'rol' && r.completado)

    datos.modulosProgreso = { M1: true, M2: m2, M3: m3 }
  } catch (err) {
    console.warn('[Perfil] progreso_modulos:', err)
  }

  // 4. Encuestas de pulso (no bloqueante)
  const { data: encuestasData } = await supabase
    .from('encuestas_pulso')
    .select('dia_onboarding, respondida')
    .eq('usuario_id', userId)

  datos.encuestasPulso = (encuestasData ?? []).map(e => ({
    dia: e.dia_onboarding as 7 | 30 | 60,
    respondida: e.respondida ?? false,
  }))

  return datos
}
