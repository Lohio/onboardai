// ─────────────────────────────────────────────
// Carga de datos de la vista de encuestas de pulso (admin).
// Compartida entre el Server Component (carga inicial con
// createServerSupabaseClient) y el Client Component (retry con
// createClient dentro del callback).
// ─────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export interface EncuestaRow {
  id: string
  dia_onboarding: number
  pregunta_1: string
  pregunta_2: string
  pregunta_3: string
  respuesta_1: number | null
  respuesta_2: number | null
  respuesta_3: number | null
  comentario: string | null
  completada: boolean
  respondida_at: string | null
  usuario: {
    nombre: string
    puesto?: string
  } | null
}

export interface DatosEncuestasAdmin {
  encuestas: EncuestaRow[]
}

export function datosEncuestasVacios(): DatosEncuestasAdmin {
  return { encuestas: [] }
}

// ─────────────────────────────────────────────
// Carga principal
// ─────────────────────────────────────────────

export async function cargarEncuestasAdmin(
  supabase: SupabaseClient,
  empresaId: string | null,
  rol: string
): Promise<DatosEncuestasAdmin> {
  let query = supabase
    .from('encuestas_pulso')
    .select(`
      id, dia_onboarding,
      pregunta_1, pregunta_2, pregunta_3,
      respuesta_1, respuesta_2, respuesta_3,
      comentario, completada, respondida_at,
      usuario:usuarios!usuario_id(nombre, puesto)
    `)
    .order('respondida_at', { ascending: false })

  if (rol !== 'dev') {
    query = query.eq('empresa_id', empresaId)
  }

  const { data } = await query
  // Supabase retorna el join usuario como array — normalizar a objeto único
  const encuestas: EncuestaRow[] = (data ?? []).map(r => ({
    ...r,
    usuario: Array.isArray(r.usuario) ? (r.usuario[0] ?? null) : (r.usuario ?? null),
  }))

  return { encuestas }
}
