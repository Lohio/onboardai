import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'
import { ApiError } from '@/lib/errors'
import { generarTokenInvitacion } from '@/lib/bienvenidaCore'

const schema = z.object({ usuarioId: z.string().uuid() })

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export const POST = withHandler(
  { auth: 'session', rol: ['admin', 'dev'], schema },
  async ({ body, user }) => {
    const username = process.env.TELEGRAM_BOT_USERNAME
    if (!username) return ApiError.internal('TELEGRAM_BOT_USERNAME no configurado')

    const db = adminClient()

    const { data: empleado } = await db
      .from('usuarios')
      .select('id, empresa_id')
      .eq('id', body.usuarioId)
      .maybeSingle()

    if (!empleado) return ApiError.notFound('Empleado')

    if (user!.rol !== 'dev' && empleado.empresa_id !== user!.empresaId) {
      return ApiError.forbidden()
    }

    const token = generarTokenInvitacion()

    const { error } = await db.from('bot_invitaciones').insert({
      usuario_id: empleado.id,
      empresa_id: empleado.empresa_id,
      plataforma: 'telegram',
      token,
    })

    if (error) return ApiError.internal(error.message)

    return NextResponse.json({
      link: `https://t.me/${username}?start=${token}`,
    })
  }
)
