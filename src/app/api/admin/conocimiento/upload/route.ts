// POST /api/admin/conocimiento/upload
// Recibe FormData: file (File), empresaId, modulo, tipo
// Sube al bucket 'conocimiento' de Supabase Storage
// Devuelve: { path, publicUrl }
// Requiere SUPABASE_SERVICE_ROLE_KEY

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { ApiError } from '@/lib/errors'

export const POST = withHandler(
  {
    auth: 'session',
    rol: ['admin', 'dev'],
    bodyType: 'formdata',
    rateLimit: RATE_LIMITS.upload,
  },
  async ({ req, user }) => {
    // Leer FormData manualmente (sin schema Zod para FormData)
    const formData = await req.formData()
    const file      = formData.get('file') as File | null
    const empresaId = formData.get('empresaId') as string | null
    const modulo    = formData.get('modulo') as string | null

    if (!file || !empresaId || !modulo) {
      return ApiError.badRequest('Faltan parámetros: file, empresaId, modulo')
    }

    // Validar que el empresaId del admin coincide (evitar subir a empresa ajena)
    if (user!.empresaId !== empresaId) {
      return ApiError.forbidden()
    }

    // Generar path único: {empresaId}/{modulo}/{uuid}.{ext}
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const uuid = crypto.randomUUID()
    const path = `${empresaId}/${modulo}/${uuid}.${ext}`

    // Subir con service role key (bypass RLS de Storage)
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await serviceSupabase
      .storage
      .from('conocimiento')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload/conocimiento] Error subiendo archivo:', uploadError)
      return ApiError.internal(uploadError.message)
    }

    // Obtener URL pública
    const { data: { publicUrl } } = serviceSupabase
      .storage
      .from('conocimiento')
      .getPublicUrl(path)

    return NextResponse.json({ path, publicUrl })
  }
)
