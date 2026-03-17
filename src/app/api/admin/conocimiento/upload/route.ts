// POST /api/admin/conocimiento/upload
// Recibe FormData: file (File), empresaId, modulo, tipo
// Sube al bucket 'conocimiento' de Supabase Storage
// Devuelve: { path, publicUrl }
// Requiere SUPABASE_SERVICE_ROLE_KEY

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    // 1. Verificar sesión del admin
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: admin } = await supabase
      .from('usuarios')
      .select('empresa_id, rol')
      .eq('id', user.id)
      .single()

    if (!admin || !['admin', 'dev'].includes(admin.rol as string)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // 2. Leer FormData
    const formData = await request.formData()
    const file      = formData.get('file') as File | null
    const empresaId = formData.get('empresaId') as string | null
    const modulo    = formData.get('modulo') as string | null

    if (!file || !empresaId || !modulo) {
      return NextResponse.json({ error: 'Faltan parámetros: file, empresaId, modulo' }, { status: 400 })
    }

    // Validar que el empresaId del admin coincide (evitar subir a empresa ajena)
    if (admin.empresa_id !== empresaId) {
      return NextResponse.json({ error: 'Empresa no autorizada' }, { status: 403 })
    }

    // 3. Generar path único: {empresaId}/{modulo}/{uuid}.{ext}
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const uuid = crypto.randomUUID()
    const path = `${empresaId}/${modulo}/${uuid}.${ext}`

    // 4. Subir con service role key (bypass RLS de Storage)
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
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // 5. Obtener URL pública
    const { data: { publicUrl } } = serviceSupabase
      .storage
      .from('conocimiento')
      .getPublicUrl(path)

    return NextResponse.json({ path, publicUrl })

  } catch (err) {
    console.error('[upload/conocimiento] Error inesperado:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
