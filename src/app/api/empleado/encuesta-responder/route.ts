import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { encuestaResponderSchema } from '@/lib/schemas/empleado'
import { ApiError } from '@/lib/errors'

// ─────────────────────────────────────────────
// POST /api/empleado/encuesta-responder
// Guarda las respuestas de una encuesta de pulso
// ─────────────────────────────────────────────

export const POST = withHandler(
  {
    auth: 'session',
    schema: encuestaResponderSchema,
    rateLimit: RATE_LIMITS.encuesta,
  },
  async ({ body, supabase, user }) => {
    // body ya validado por Zod: encuestaId (uuid), respuesta1/2/3 (int 1-5), comentario? (string max 2000)

    // Verificar que la encuesta pertenece al usuario y no fue completada
    const { data: encuesta } = await supabase
      .from('encuestas_pulso')
      .select('id, usuario_id, completada')
      .eq('id', body.encuestaId)
      .single()

    if (!encuesta) return ApiError.notFound('Encuesta')

    if (encuesta.usuario_id !== user!.id) return ApiError.forbidden()

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
  }
)
