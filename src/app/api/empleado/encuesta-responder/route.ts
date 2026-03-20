import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { ApiError } from '@/lib/errors'

// ─────────────────────────────────────────────
// POST /api/empleado/encuesta-responder
// Guarda las respuestas de una encuesta de pulso
// ─────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiError.unauthorized()

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
      return ApiError.badRequest('Datos incompletos')
    }

    // Validar rango de respuestas (1-5)
    const respuestas = [body.respuesta1, body.respuesta2, body.respuesta3]
    if (respuestas.some(r => r < 1 || r > 5 || !Number.isInteger(r))) {
      return ApiError.badRequest('Las respuestas deben ser valores enteros entre 1 y 5')
    }

    // Verificar que la encuesta pertenece al usuario y no fue completada
    const { data: encuesta } = await supabase
      .from('encuestas_pulso')
      .select('id, usuario_id, completada')
      .eq('id', body.encuestaId)
      .single()

    if (!encuesta) return ApiError.notFound('Encuesta')

    if (encuesta.usuario_id !== user.id) return ApiError.forbidden()

    if (encuesta.completada) return ApiError.conflict('Encuesta ya respondida')

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
      return ApiError.internal(updateError.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[encuesta-responder] Error:', err)
    return ApiError.internal()
  }
}

