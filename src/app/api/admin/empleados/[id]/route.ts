import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'
import { actualizarEmpleadoSchema } from '@/lib/schemas/admin'
import { ApiError } from '@/lib/errors'

// ─────────────────────────────────────────────
// PATCH /api/admin/empleados/[id]
// Actualiza los datos del empleado
// ─────────────────────────────────────────────

const actualizarEmpleado = withHandler(
  {
    auth: 'session',
    rol: ['admin', 'dev'],
    schema: actualizarEmpleadoSchema,
  },
  async ({ body, supabase, user, params }) => {
    const { id } = params

    // Verificar que el empleado pertenece a la empresa (dev puede editar cualquier empresa)
    const { data: empleado } = await supabase
      .from('usuarios')
      .select('id, empresa_id')
      .eq('id', id)
      .single()

    if (!empleado) {
      return ApiError.notFound('Empleado')
    }
    if (user!.rol !== 'dev' && empleado.empresa_id !== user!.empresaId) {
      return ApiError.forbidden()
    }

    // body ya viene filtrado y validado por Zod (actualizarEmpleadoSchema)
    // Construir objeto de actualización solo con campos presentes en el body
    const updateData: Record<string, unknown> = {}
    const camposSchema = [
      'nombre', 'puesto', 'area', 'fecha_ingreso',
      'modalidad_trabajo', 'manager_id', 'buddy_id', 'sobre_mi', 'rol',
      'password_corporativo', 'password_bitlocker',
      'bio', 'contacto_it_nombre', 'contacto_it_email',
      'contacto_rrhh_nombre', 'contacto_rrhh_email',
    ] as const

    for (const campo of camposSchema) {
      if (campo in body) updateData[campo] = body[campo] ?? null
    }

    const { data: actualizado, error } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id', id)
      .select(`id, nombre, email, puesto, area, rol, fecha_ingreso,
        modalidad_trabajo, manager_id, buddy_id, sobre_mi,
        password_corporativo, password_bitlocker`)
      .single()

    if (error) return ApiError.internal(error.message)

    return NextResponse.json({ usuario: actualizado })
  }
)

export const PATCH = actualizarEmpleado
export const PUT = actualizarEmpleado

// ─────────────────────────────────────────────
// DELETE /api/admin/empleados/[id]
// Elimina el empleado: progreso, conversaciones, fila en usuarios y auth user
// ─────────────────────────────────────────────

export const DELETE = withHandler(
  {
    auth: 'session',
    rol: ['admin', 'dev'],
    bodyType: 'none',
  },
  async ({ supabase, user, params }) => {
    const { id } = params

    // No permitir auto-eliminación
    if (id === user!.id) {
      return ApiError.badRequest('No podés eliminar tu propia cuenta')
    }

    // Verificar que el empleado pertenece a la empresa
    const { data: empleado } = await supabase
      .from('usuarios')
      .select('id, empresa_id')
      .eq('id', id)
      .single()

    if (!empleado) {
      return ApiError.notFound('Empleado')
    }
    if (user!.rol !== 'dev' && empleado.empresa_id !== user!.empresaId) {
      return ApiError.forbidden()
    }

    // Crear cliente con service role key para operaciones de eliminación
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return ApiError.internal('SUPABASE_SERVICE_ROLE_KEY no configurada')
    }

    const sa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Eliminar auth user primero — si falla, abortamos antes de tocar datos
    // Así evitamos dejar datos huérfanos con un auth user activo
    const { error: authError } = await sa.auth.admin.deleteUser(id)
    if (authError) {
      console.error('[DELETE empleado] Error eliminando auth user:', authError)
      return ApiError.internal('No se pudo eliminar el usuario de autenticación. Los datos no fueron modificados.')
    }

    // 2. Auth eliminado — limpiar datos asociados
    await sa.from('progreso_modulos').delete().eq('usuario_id', id)

    const { data: convs } = await sa
      .from('conversaciones_ia')
      .select('id')
      .eq('usuario_id', id)

    if (convs && convs.length > 0) {
      const ids = convs.map((c: { id: string }) => c.id)
      await sa.from('mensajes_ia').delete().in('conversacion_id', ids)
      await sa.from('conversaciones_ia').delete().in('id', ids)
    }

    // 3. Eliminar fila en tabla usuarios
    const { error: deleteError } = await sa
      .from('usuarios')
      .delete()
      .eq('id', id)

    if (deleteError) {
      // Auth ya fue eliminado — el usuario no puede loguearse.
      // Loguear para limpieza manual si fuera necesario.
      console.error('[DELETE empleado] Auth eliminado pero fila en usuarios no se pudo borrar:', deleteError)
    }

    return NextResponse.json({ ok: true })
  }
)
