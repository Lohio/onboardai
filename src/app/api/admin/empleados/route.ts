import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'
import { crearEmpleadoSchema } from '@/lib/schemas/admin'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { ApiError } from '@/lib/errors'

// ─────────────────────────────────────────────
// POST /api/admin/empleados
// Crea un auth user + fila en usuarios para un nuevo empleado
// Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
// ─────────────────────────────────────────────

export const POST = withHandler(
  {
    auth: 'session',
    rol: ['admin', 'dev'],
    schema: crearEmpleadoSchema,
    rateLimit: RATE_LIMITS.crearEmpleado,
  },
  async ({ body, user }) => {
    const { email, password, nombre } = body

    // Crear cliente con service role key
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return ApiError.internal('SUPABASE_SERVICE_ROLE_KEY no configurada en el servidor')
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Crear auth user (sin confirmación de email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return ApiError.conflict('Ya existe un usuario con ese email')
      }
      return ApiError.badRequest(authError.message)
    }

    const userId = authData.user.id

    // 2. Insertar en tabla usuarios
    const { data: nuevoUsuario, error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: userId,
        empresa_id: user!.empresaId,
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        rol: body.rol ?? 'empleado',
        puesto: body.puesto?.trim() || null,
        area: body.area?.trim() || null,
        fecha_ingreso: body.fecha_ingreso || null,
        modalidad_trabajo: body.modalidad_trabajo || null,
        manager_id: body.manager_id || null,
        buddy_id: body.buddy_id || null,
        sobre_mi: body.sobre_mi?.trim() || null,
      })
      .select('id, nombre, email')
      .single()

    if (insertError) {
      // Rollback: eliminar auth user si falla la inserción
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return ApiError.internal(insertError.message)
    }

    return NextResponse.json({ usuario: nuevoUsuario }, { status: 201 })
  }
)
