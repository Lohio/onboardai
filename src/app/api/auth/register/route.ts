import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { registerSchema } from '@/lib/schemas/auth'

// ─────────────────────────────────────────────
// POST /api/auth/register
// Registra una nueva empresa y su admin inicial.
// Usa service role key para bypasear RLS en la
// primera inserción (no hay admin aún).
// ─────────────────────────────────────────────

export const POST = withHandler(
  {
    auth: 'none',
    schema: registerSchema,
    rateLimit: RATE_LIMITS.register,
  },
  async ({ body }) => {
    const { email, password, nombre, nombreEmpresa } = body

    // Cliente con service role (bypasea RLS)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta' },
        { status: 500 }
      )
    }

    const sa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Crear auth user
    const { data: authData, error: authError } = await sa.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // sin verificación de email
    })

    if (authError) {
      if (authError.message.includes('already been registered') ||
          authError.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'Ya existe una cuenta con ese email' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    // 2. Generar slug de la empresa
    const slug = nombreEmpresa
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    // 3. Crear empresa
    const { data: empresa, error: empresaError } = await sa
      .from('empresas')
      .insert({ nombre: nombreEmpresa.trim(), slug })
      .select('id')
      .single()

    if (empresaError) {
      // Rollback: eliminar auth user
      await sa.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Error al crear la empresa: ' + empresaError.message },
        { status: 500 }
      )
    }

    // 4. Crear usuario admin
    const { error: usuarioError } = await sa
      .from('usuarios')
      .insert({
        id: userId,
        empresa_id: empresa.id,
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        rol: 'admin',
      })

    if (usuarioError) {
      // Rollback: eliminar empresa y auth user
      await sa.from('empresas').delete().eq('id', empresa.id)
      await sa.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Error al crear el perfil: ' + usuarioError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  }
)
