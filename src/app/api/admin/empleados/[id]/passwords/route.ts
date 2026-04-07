// GET /api/admin/empleados/[id]/passwords
// Retorna los campos de contraseña descifrados para un empleado específico.
// Solo accesible por admin/dev. Los valores se descifran server-side.

import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { ApiError } from '@/lib/errors'
import { safeDecrypt } from '@/lib/encryption'

export const GET = withHandler(
  { auth: 'session', rol: ['admin', 'dev'], bodyType: 'none' },
  async ({ supabase, user, params }) => {
    const { id } = params

    const { data, error } = await supabase
      .from('usuarios')
      .select('id, empresa_id, password_corporativo, password_bitlocker')
      .eq('id', id)
      .single()

    if (error || !data) return ApiError.notFound('Empleado')

    // Verificar que el empleado pertenece a la empresa del admin
    if (user!.rol !== 'dev' && data.empresa_id !== user!.empresaId) {
      return ApiError.forbidden()
    }

    return NextResponse.json({
      password_corporativo: safeDecrypt(data.password_corporativo),
      password_bitlocker:   safeDecrypt(data.password_bitlocker),
    })
  }
)
