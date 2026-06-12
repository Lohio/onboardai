// GET /api/storage/conocimiento?path={empresaId}/{modulo}/{uuid}.{ext}
// Proxy de acceso al bucket privado 'conocimiento': verifica sesión y que el
// archivo pertenezca a la empresa del usuario, y redirige a una signed URL
// de corta vida. Permite mantener el bucket privado sin URLs públicas.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'
import { ApiError } from '@/lib/errors'

/** Path esperado: {uuid empresa}/{slug modulo}/{uuid archivo}.{ext} */
const PATH_REGEX = /^[0-9a-f-]{36}\/[a-z0-9_-]{1,50}\/[0-9a-f-]{36}\.[a-z0-9]{1,10}$/i

/** Vida de la signed URL en segundos — corta: solo para servir el render actual */
const SIGNED_URL_TTL = 300

export const GET = withHandler(
  { auth: 'session', bodyType: 'none' },
  async ({ req, user }) => {
    const path = new URL(req.url).searchParams.get('path')

    if (!path || !PATH_REGEX.test(path)) {
      return ApiError.badRequest("Parámetro 'path' inválido")
    }

    // Scoping por tenant: el primer segmento del path es el empresa_id
    if (user!.rol !== 'dev' && !path.startsWith(`${user!.empresaId}/`)) {
      return ApiError.forbidden()
    }

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await serviceSupabase
      .storage
      .from('conocimiento')
      .createSignedUrl(path, SIGNED_URL_TTL)

    if (error || !data?.signedUrl) {
      return ApiError.notFound('Archivo')
    }

    return NextResponse.redirect(data.signedUrl, 302)
  }
)
