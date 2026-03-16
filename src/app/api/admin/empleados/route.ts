import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// POST /api/admin/empleados
// Crea un auth user + fila en usuarios para un nuevo empleado
// Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
// ─────────────────────────────────────────────

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

    if (!admin || !['admin', 'dev'].includes(admin.rol)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // 2. Leer body
    const body = await request.json() as {
      email: string
      password: string
      nombre: string
      puesto?: string
      area?: string
      fecha_ingreso?: string
      modalidad_trabajo?: 'presencial' | 'remoto' | 'hibrido'
      manager_id?: string
      buddy_id?: string
      sobre_mi?: string
      rol?: 'empleado' | 'admin'
    }

    const { email, password, nombre } = body
    if (!email || !password || !nombre) {
      return NextResponse.json(
        { error: 'Email, contraseña y nombre son obligatorios' },
        { status: 400 }
      )
    }

    // 3. Cliente admin con service role key
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY no configurada en el servidor' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 4. Crear auth user (sin confirmación de email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'Ya existe un usuario con ese email' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    // 5. Insertar en tabla usuarios
    const { data: nuevoUsuario, error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: userId,
        empresa_id: admin.empresa_id,
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
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ usuario: nuevoUsuario }, { status: 201 })
  } catch (err) {
    console.error('Error creando empleado:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
