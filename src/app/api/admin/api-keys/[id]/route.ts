import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'
import { ApiError } from '@/lib/errors'

// ─────────────────────────────────────────────
// DELETE /api/admin/api-keys/[id]
// Revoca (desactiva) una API key — soft delete
// ─────────────────────────────────────────────

export const DELETE = withHandler(
  {
    auth: 'session',
    rol: ['admin', 'dev'],
    bodyType: 'none',
  },
  async ({ user, params }) => {
    const { id } = params

    if (!id) {
      return ApiError.badRequest('ID de API key requerido')
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return ApiError.internal('SUPABASE_SERVICE_ROLE_KEY no configurada en el servidor')
    }

    const sa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar que la key existe y pertenece a la empresa del usuario
    // (dev puede revocar cualquier key)
    const matchQuery = sa
      .from('api_keys')
      .select('id, empresa_id, activa')
      .eq('id', id)

    if (user!.rol !== 'dev') {
      matchQuery.eq('empresa_id', user!.empresaId)
    }

    const { data: existente, error: fetchError } = await matchQuery.single()

    if (fetchError || !existente) {
      return ApiError.notFound('API key no encontrada')
    }

    // Soft delete: marcar como inactiva
    const { error: updateError } = await sa
      .from('api_keys')
      .update({ activa: false })
      .eq('id', id)

    if (updateError) {
      return ApiError.internal(updateError.message)
    }

    return NextResponse.json({ ok: true })
  }
)
