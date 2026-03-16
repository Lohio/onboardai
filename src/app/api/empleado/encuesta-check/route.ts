import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// Días del onboarding en que se disparan encuestas
const DIAS_ENCUESTA = [7, 30, 60]

// Preguntas por día
function preguntasPorDia(dia: number): { p1: string; p2: string; p3: string } {
  if (dia === 7) {
    return {
      p1: '¿Cómo fue tu primera semana en la empresa?',
      p2: '¿Qué tan claro fue el proceso de onboarding hasta ahora?',
      p3: '¿Cómo calificás el apoyo recibido de tu equipo?',
    }
  }
  if (dia === 30) {
    return {
      p1: '¿Cómo te sentís integrado/a al equipo?',
      p2: '¿Qué tan claro tenés tu rol y responsabilidades?',
      p3: '¿Cómo calificás el acceso a las herramientas y recursos que necesitás?',
    }
  }
  // 60 días
  return {
    p1: '¿Cómo calificás tu experiencia de onboarding en general?',
    p2: '¿Qué tan alineado/a te sentís con la cultura de la empresa?',
    p3: '¿Cómo calificás tu productividad y autonomía actual?',
  }
}

// ─────────────────────────────────────────────
// POST /api/empleado/encuesta-check
// Crea encuestas pendientes según días de onboarding
// y devuelve la más antigua sin responder
// ─────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json() as { usuarioId?: string; diasOnboarding?: number }
    if (!body.usuarioId || body.diasOnboarding === undefined) {
      return NextResponse.json({ error: 'usuarioId y diasOnboarding requeridos' }, { status: 400 })
    }

    // Solo el propio usuario puede verificar sus encuestas
    if (body.usuarioId !== user.id) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // Obtener empresa_id
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .single()

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Ver qué encuestas ya existen para este usuario
    const { data: existentes } = await supabase
      .from('encuestas_pulso')
      .select('dia_onboarding')
      .eq('usuario_id', user.id)

    const diasExistentes = new Set((existentes ?? []).map((e) => e.dia_onboarding))

    // Crear encuestas para días alcanzados que no existen aún
    const diasACrear = DIAS_ENCUESTA.filter(
      (d) => body.diasOnboarding! >= d && !diasExistentes.has(d),
    )

    if (diasACrear.length > 0) {
      const nuevas = diasACrear.map((dia) => {
        const preguntas = preguntasPorDia(dia)
        return {
          empresa_id: usuario.empresa_id,
          usuario_id: user.id,
          dia_onboarding: dia,
          pregunta_1: preguntas.p1,
          pregunta_2: preguntas.p2,
          pregunta_3: preguntas.p3,
        }
      })

      await supabase.from('encuestas_pulso').insert(nuevas)
    }

    // Obtener la encuesta pendiente más antigua
    const { data: pendiente } = await supabase
      .from('encuestas_pulso')
      .select('id, dia_onboarding, pregunta_1, pregunta_2, pregunta_3')
      .eq('usuario_id', user.id)
      .eq('completada', false)
      .order('dia_onboarding', { ascending: true })
      .limit(1)
      .single()

    return NextResponse.json({ encuesta: pendiente ?? null })
  } catch (err) {
    console.error('[encuesta-check] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
