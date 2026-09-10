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

  // 1. Todo lo que depende solo de userId en un único round-trip:
  //    perfil (con la empresa embebida vía FK usuarios.empresa_id → empresas),
  //    relaciones, accesos, progreso de módulos y encuestas de pulso.
  const [perfilRes, relacionesRes, accesosRes, progresoRes, encuestasRes] = await Promise.all([
    supabase
      .from('usuarios')
      .select('id, nombre, puesto, area, email, modalidad, fecha_ingreso, bio, foto_url, empresa_id, manager_id, buddy_id, contacto_it_nombre, contacto_it_email, contacto_rrhh_nombre, contacto_rrhh_email, empresas(nombre, herramientas_contacto)')
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
    // Progreso de módulos (no bloqueante — tabla puede no existir)
    supabase
      .from('progreso_modulos')
      .select('modulo, bloque, completado')
      .eq('usuario_id', userId),
    // Encuestas de pulso (no bloqueante)
    supabase
      .from('encuestas_pulso')
      .select('dia_onboarding, respondida')
      .eq('usuario_id', userId),
  ])

  const perfilData = perfilRes.data
  // Perfil sin la key `empresas` embebida, para conservar exactamente las
  // mismas columnas que antes
  let perfilRow: Omit<NonNullable<typeof perfilData>, 'empresas'> | null = null

  if (perfilData) {
    const { empresas: empresaEmbed, ...resto } = perfilData
    perfilRow = resto

    // Mezclar passwords descifradas (server-side) con el perfil
    datos.perfil = { ...perfilRow, ...passwords } as Usuario

    // Herramienta de contacto + nombre de la empresa (embed to-one puede llegar
    // como objeto o como array de un elemento según la versión del cliente)
    const empresa = Array.isArray(empresaEmbed) ? empresaEmbed[0] : empresaEmbed
    const herramientas = empresa?.herramientas_contacto
    if (herramientas && herramientas.length > 0) {
      datos.herramientaContacto = herramientas[0] as string
    }
    if (empresa?.nombre) {
      datos.nombreEmpresa = empresa.nombre as string
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

  // 3. Progreso de módulos (ya cargado en el paso 1; si falla queda el default)
  if (progresoRes.error) {
    console.warn('[Perfil] progreso_modulos:', progresoRes.error.message)
  }
  const progresoRows = progresoRes.data ?? []
  const culturaCompletados = progresoRows.filter(
    r => r.modulo === 'cultura' && r.completado
  ).length
  const m2 = culturaCompletados >= CULTURA_TOTAL
  const m3 = progresoRows.some(r => r.modulo === 'rol' && r.completado)

  datos.modulosProgreso = { M1: true, M2: m2, M3: m3 }

  // 4. Encuestas de pulso (ya cargadas en el paso 1)
  datos.encuestasPulso = (encuestasRes.data ?? []).map(e => ({
    dia: e.dia_onboarding as 7 | 30 | 60,
    respondida: e.respondida ?? false,
  }))

  return datos
}
