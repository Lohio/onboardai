// ─────────────────────────────────────────────
// GET /api/v1/empleados/[id]/progreso — progreso del empleado (scope: progreso:read)
// ─────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { hasScope } from '@/lib/api/apiKeys'
import { makeServiceClient } from '@/lib/api/serviceClient'
import { optionsResponse } from '@/lib/api/cors'
import { ApiError } from '@/lib/errors'

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
      .select('modulo, completado, completado_at')
      .eq('usuario_id', id)
      .order('modulo', { ascending: true })

    if (error) {
      console.error('[GET v1/empleados/progreso] Error consultando:', error)
      return ApiError.internal()
    }

    // Mapear columnas reales a la forma que define la spec:
    // modulo → modulo_id, completado_at → updated_at
    const payload = (progreso ?? []).map((row) => ({
      modulo_id: row.modulo,
      completado: row.completado,
      updated_at: row.completado_at,
    }))

    return NextResponse.json({ progreso: payload })
  }
)

// OPTIONS /api/v1/empleados/[id]/progreso — preflight CORS
export async function OPTIONS() {
  return optionsResponse('*')
}
