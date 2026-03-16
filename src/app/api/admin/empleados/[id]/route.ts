import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function resolverAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado', status: 401, supabase: null, admin: null }

  const { data: admin } = await supabase
    .from('usuarios')
    .select('empresa_id, rol')
    .eq('id', user.id)
    .single()

  if (!admin || !['admin', 'dev'].includes(admin.rol)) {
    return { error: 'Acceso denegado', status: 403, supabase: null, admin: null }
  }

  return { error: null, status: 200, supabase, admin, userId: user.id }
}

function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─────────────────────────────────────────────
// PATCH /api/admin/empleados/[id]
// Actualiza los datos del empleado
// ─────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await resolverAdmin()
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    const { supabase, admin } = ctx

    // Verificar que el empleado pertenece a la empresa (dev puede editar cualquier empresa)
    const { data: empleado } = await supabase!
      .from('usuarios')
      .select('id, empresa_id')
      .eq('id', id)
      .single()

    if (!empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
    }
    if (admin!.rol !== 'dev' && empleado.empresa_id !== admin!.empresa_id) {
      return NextResponse.json({ error: 'Sin acceso a este empleado' }, { status: 403 })
    }

    const body = await request.json() as Record<string, unknown>

    // Construir objeto de actualización solo con campos permitidos
    const camposPermitidos = [
      'nombre', 'puesto', 'area', 'fecha_ingreso',
      'modalidad_trabajo', 'manager_id', 'buddy_id', 'sobre_mi',
    ]
    const updateData: Record<string, unknown> = {}
    for (const campo of camposPermitidos) {
      if (campo in body) updateData[campo] = body[campo] ?? null
    }

    // Rol: solo admin y dev pueden cambiarlo, y no pueden asignar 'dev' via esta ruta
    if ('rol' in body && ['empleado', 'admin'].includes(String(body.rol))) {
      updateData['rol'] = body.rol
    }

    const { data: actualizado, error } = await supabase!
      .from('usuarios')
      .update(updateData)
      .eq('id', id)
      .select('id, nombre, email, puesto, area, rol, fecha_ingreso, modalidad_trabajo, manager_id, buddy_id, sobre_mi')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ usuario: actualizado })
  } catch (err) {
    console.error('Error actualizando empleado:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// DELETE /api/admin/empleados/[id]
// Elimina el empleado: progreso, conversaciones, fila en usuarios y auth user
// ─────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await resolverAdmin()
    if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    const { supabase, admin, userId } = ctx

    // No permitir auto-eliminación
    if (id === userId) {
      return NextResponse.json({ error: 'No podés eliminar tu propia cuenta' }, { status: 400 })
    }

    // Verificar que el empleado pertenece a la empresa
    const { data: empleado } = await supabase!
      .from('usuarios')
      .select('id, empresa_id')
      .eq('id', id)
      .single()

    if (!empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
    }
    if (admin!.rol !== 'dev' && empleado.empresa_id !== admin!.empresa_id) {
      return NextResponse.json({ error: 'Sin acceso a este empleado' }, { status: 403 })
    }

    const sa = adminClient()
    if (!sa) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    }

    // 1. Eliminar progreso de módulos
    await sa.from('progreso_modulos').delete().eq('usuario_id', id)

    // 2. Eliminar mensajes de conversaciones IA
    const { data: convs } = await sa
      .from('conversaciones_ia')
      .select('id')
      .eq('usuario_id', id)

    if (convs && convs.length > 0) {
      const ids = convs.map(c => c.id)
      await sa.from('mensajes_ia').delete().in('conversacion_id', ids)
      await sa.from('conversaciones_ia').delete().in('id', ids)
    }

    // 3. Eliminar fila en tabla usuarios
    const { error: deleteError } = await sa
      .from('usuarios')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // 4. Eliminar usuario en Supabase Auth
    const { error: authError } = await sa.auth.admin.deleteUser(id)
    if (authError) {
      console.error('Error eliminando auth user (la fila ya fue eliminada):', authError)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error eliminando empleado:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
