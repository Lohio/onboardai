// ─────────────────────────────────────────────
// GET /api/v1/empleados/[id] — detalle de un empleado (scope: empleados:read)
// ─────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { hasScope } from '@/lib/api/apiKeys'
import { makeServiceClient } from '@/lib/api/serviceClient'
import { optionsResponse } from '@/lib/api/cors'
import { ApiError } from '@/lib/errors'

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
  return optionsResponse('*')
}
