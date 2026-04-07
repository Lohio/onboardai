import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'
import { crearEmpleadoSchema } from '@/lib/schemas/admin'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { ApiError } from '@/lib/errors'
import { esTrial, TRIAL_LIMITS, UPGRADE_MSG } from '@/lib/trial'

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
  async ({ body, user, supabase }) => {
    const { email, password, nombre } = body

    // Verificar límite trial
    const { data: empresaData } = await supabase!
      .from('empresas')
      .select('plan')
      .eq('id', user!.empresaId)
      .single()

    if (esTrial(empresaData?.plan)) {
      const { count } = await supabase!
        .from('usuarios')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', user!.empresaId)
        .eq('rol', 'empleado')

      if ((count ?? 0) >= TRIAL_LIMITS.maxEmpleados) {
        return ApiError.badRequest(UPGRADE_MSG.empleados)
      }
    }

    // Crear cliente con service role key
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      console.error('[POST empleados] SUPABASE_SERVICE_ROLE_KEY no configurada')
      return ApiError.internal()
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
      // Rollback: eliminar auth user para no dejar un auth user sin perfil
      console.error('[POST empleados] Error insertando en tabla usuarios:', insertError)
      const { error: rollbackError } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (rollbackError) {
        console.error('[POST empleados] Rollback fallido — auth user huérfano:', userId, rollbackError)
      }
      return ApiError.internal()
    }

    return NextResponse.json({ usuario: nuevoUsuario }, { status: 201 })
  }
)
