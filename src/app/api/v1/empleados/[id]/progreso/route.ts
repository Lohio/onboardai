// ─────────────────────────────────────────────
// GET /api/v1/empleados/[id]/progreso — progreso del empleado (scope: progreso:read)
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

// GET /api/v1/empleados/[id]/progreso
export const GET = withHandler(
  { auth: 'apiKey' },
  async ({ params, apiKeyRecord }) => {
    // Verificar scope requerido
    if (!hasScope(apiKeyRecord!, 'progreso:read')) {
      return ApiError.forbidden()
    }

    const empresaId = apiKeyRecord!.empresa_id
    const { id } = params

    const sa = makeServiceClient()

    // Verificar que el empleado pertenece a la empresa de la API key
    const { data: empleado, error: empleadoError } = await sa
      .from('usuarios')
      .select('id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (empleadoError || !empleado) {
      return ApiError.notFound('Empleado')
    }

    // Obtener progreso de módulos del empleado
    const { data: progreso, error } = await sa
      .from('progreso_modulos')
      .select('modulo, bloque, completado, completado_at')
      .eq('usuario_id', id)
      .order('modulo', { ascending: true })

    if (error) {
      return ApiError.internal(error.message)
    }

    return NextResponse.json({ progreso: progreso ?? [] })
  }
)

// OPTIONS /api/v1/empleados/[id]/progreso — preflight CORS
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
