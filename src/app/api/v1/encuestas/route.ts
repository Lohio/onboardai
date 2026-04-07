// ─────────────────────────────────────────────
// GET /api/v1/encuestas — resultados de encuestas de pulso (scope: encuestas:read)
// Query params opcionales: dia (7|30|60), completada (true|false), page, limit
// ─────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { hasScope } from '@/lib/api/apiKeys'
import { makeServiceClient } from '@/lib/api/serviceClient'
import { optionsResponse } from '@/lib/api/cors'
import { ApiError } from '@/lib/errors'

// Días válidos para filtrar encuestas de pulso
const DIAS_VALIDOS = [7, 30, 60] as const

// GET /api/v1/encuestas
export const GET = withHandler(
  { auth: 'apiKey' },
  async ({ req, apiKeyRecord }) => {
    // Verificar scope requerido
    if (!hasScope(apiKeyRecord!, 'encuestas:read')) {
      return ApiError.forbidden()
    }

    const empresaId = apiKeyRecord!.empresa_id

    const url = new URL(req.url)
    const diaParam = url.searchParams.get('dia')
    const completadaParam = url.searchParams.get('completada')

    // Parsear query params de paginación
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const limitRaw = parseInt(url.searchParams.get('limit') ?? '20', 10) || 20
    const limit = Math.min(100, Math.max(1, limitRaw))
    const offset = (page - 1) * limit

    const sa = makeServiceClient()

    // Construir query base: join con usuarios para filtrar por empresa
    let query = sa
      .from('encuestas_pulso')
      .select(`
        id,
        usuario_id,
        dia_onboarding,
        pregunta_1,
        pregunta_2,
        pregunta_3,
        respuesta_1,
        respuesta_2,
        respuesta_3,
        comentario,
        completada,
        created_at,
        respondida_at,
        usuarios!inner(empresa_id)
      `, { count: 'exact' })
      .eq('usuarios.empresa_id', empresaId)

    // Filtro por día de onboarding (7, 30 o 60)
    if (diaParam !== null) {
      const dia = parseInt(diaParam, 10)
      if (!DIAS_VALIDOS.includes(dia as typeof DIAS_VALIDOS[number])) {
        return ApiError.badRequest('El parámetro "dia" debe ser 7, 30 o 60')
      }
      query = query.eq('dia_onboarding', dia)
    }

    // Filtro por estado completada
    if (completadaParam !== null) {
      const completada = completadaParam === 'true'
      query = query.eq('completada', completada)
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: encuestas, count, error } = await query

    if (error) {
      console.error('[GET encuestas] Error consultando:', error)
      return ApiError.internal()
    }

    // Omitir el campo `usuarios` del join (solo se usó para filtrar)
    const resultado = (encuestas ?? []).map(({ usuarios: _usuarios, ...rest }) => rest)

    return NextResponse.json({ encuestas: resultado, total: count ?? 0, page, limit })
  }
)

// OPTIONS /api/v1/encuestas — preflight CORS
export async function OPTIONS() {
  return optionsResponse('*')
}
