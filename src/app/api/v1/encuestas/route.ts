// ─────────────────────────────────────────────
// GET /api/v1/encuestas — resultados de encuestas de pulso (scope: encuestas:read)
// Query params opcionales: dia (7|30|60), completada (true|false)
// ─────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'
import { hasScope } from '@/lib/api/apiKeys'
import { ApiError } from '@/lib/errors'

// Crea cliente Supabase con service role (necesario para bypassear RLS en API pública)
function makeServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

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
      `)
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

    query = query.order('created_at', { ascending: false })

    const { data: encuestas, error } = await query

    if (error) {
      return ApiError.internal(error.message)
    }

    // Omitir el campo `usuarios` del join (solo se usó para filtrar)
    const resultado = (encuestas ?? []).map(({ usuarios: _usuarios, ...rest }) => rest)

    return NextResponse.json({ encuestas: resultado })
  }
)

// OPTIONS /api/v1/encuestas — preflight CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
