// GET /api/empleado/perfil/passwords
// Retorna los campos de contraseña descifrados para el empleado autenticado.
// Los valores se leen desde la DB y se descifran server-side — nunca pasa el ciphertext al cliente.

import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { ApiError } from '@/lib/errors'
import { safeDecrypt } from '@/lib/encryption'

export const GET = withHandler(
  { auth: 'session', rol: 'empleado' },
  async ({ supabase, user }) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('password_corporativo, password_bitlocker')
      .eq('id', user!.id)
      .single()

    if (error) {
      console.error('[GET perfil/passwords] Error consultando:', error)
      return ApiError.internal()
    }

    return NextResponse.json({
      password_corporativo: safeDecrypt(data?.password_corporativo),
      password_bitlocker:   safeDecrypt(data?.password_bitlocker),
    })
  }
)
