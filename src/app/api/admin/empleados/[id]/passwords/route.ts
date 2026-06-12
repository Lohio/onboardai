// GET /api/admin/empleados/[id]/passwords
// Retorna los campos de contraseña descifrados para un empleado específico.
// Solo accesible por admin/dev. Los valores se descifran server-side.

import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { ApiError } from '@/lib/errors'
import { safeDecrypt } from '@/lib/encryption'

export const GET = withHandler(
  { auth: 'session', rol: ['admin', 'dev'], bodyType: 'none', rateLimit: RATE_LIMITS.passwords },
  async ({ supabase, user, params, requestId }) => {
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

    // Auditoría: registro durable en DB de quién accedió a credenciales de quién.
    // No bloqueante: si la tabla aún no existe (scripts/auditoria.sql) queda el log.
    const { error: auditError } = await supabase.from('auditoria_accesos').insert({
      empresa_id: data.empresa_id,
      actor_id: user!.id,
      evento: 'passwords_acceso',
      target_id: id,
      detalle: { requestId },
    })
    if (auditError) {
      console.warn('[audit] no se pudo persistir el acceso a passwords:', auditError.message)
    }
    console.log('[audit] acceso a passwords', {
      requestId,
      adminId: user!.id,
      empleadoId: id,
      empresaId: data.empresa_id,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      password_corporativo: safeDecrypt(data.password_corporativo),
      password_bitlocker:   safeDecrypt(data.password_bitlocker),
    })
  }
)
