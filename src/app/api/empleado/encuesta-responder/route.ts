import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// POST /api/empleado/encuesta-responder
// Guarda las respuestas de una encuesta de pulso
// ─────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json() as {
      encuestaId?: string
      respuesta1?: number
      respuesta2?: number
      respuesta3?: number
      comentario?: string
    }

    if (
      !body.encuestaId ||
      body.respuesta1 === undefined ||
      body.respuesta2 === undefined ||
      body.respuesta3 === undefined
    ) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Verificar que la encuesta pertenece al usuario y no fue completada
    const { data: encuesta } = await supabase
      .from('encuestas_pulso')
      .select('id, usuario_id, completada')
      .eq('id', body.encuestaId)
      .single()

    if (!encuesta) {
      return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 })
    }

    if (encuesta.usuario_id !== user.id) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    if (encuesta.completada) {
      return NextResponse.json({ error: 'Encuesta ya respondida' }, { status: 409 })
    }

    const { error: updateError } = await supabase
      .from('encuestas_pulso')
      .update({
        respuesta_1: body.respuesta1,
        respuesta_2: body.respuesta2,
        respuesta_3: body.respuesta3,
        comentario: body.comentario ?? null,
        completada: true,
        respondida_at: new Date().toISOString(),
      })
      .eq('id', body.encuestaId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[encuesta-responder] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
