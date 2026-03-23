// ─────────────────────────────────────────────
// GET /api/v1/empleados/[id] — detalle de un empleado (scope: empleados:read)
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

// GET /api/v1/empleados/[id]
export const GET = withHandler(
  { auth: 'apiKey' },
  async ({ params, apiKeyRecord }) => {
    // Verificar scope requerido
    if (!hasScope(apiKeyRecord!, 'empleados:read')) {
      return ApiError.forbidden()
    }

    const empresaId = apiKeyRecord!.empresa_id
    const { id } = params

    const sa = makeServiceClient()

    const { data: empleado, error } = await sa
      .from('usuarios')
      .select('id, nombre, email, puesto, area, rol, fecha_ingreso, modalidad_trabajo, manager_id, buddy_id')
      .eq('id', id)
      .eq('empresa_id', empresaId) // verifica que pertenece a la empresa de la API key
      .single()

    if (error || !empleado) {
      return ApiError.notFound('Empleado')
    }

    return NextResponse.json({ empleado })
  }
)

// OPTIONS /api/v1/empleados/[id] — preflight CORS
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
