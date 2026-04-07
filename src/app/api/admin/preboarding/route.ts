import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { preboardingSchema } from '@/lib/schemas/admin'
import { ApiError } from '@/lib/errors'
import { sendEmail } from '@/lib/emails'

// ─────────────────────────────────────────────
// POST /api/admin/preboarding
// Activa preboarding_activo y envía email al empleado
// ─────────────────────────────────────────────

export const POST = withHandler(
  {
    auth: 'session',
    rol: ['admin', 'dev'],
    schema: preboardingSchema,
  },
  async ({ body, supabase, user, req }) => {
    // body.usuarioId ya validado como UUID por Zod

    // Obtener datos del empleado y su empresa
    const { data: empleado } = await supabase
      .from('usuarios')
      .select('id, nombre, email, empresa_id, fecha_ingreso, puesto')
      .eq('id', body.usuarioId)
      .single()

    if (!empleado) return ApiError.notFound('Empleado')

    // Admin solo puede activar preboarding en empleados de su empresa
    // Dev puede acceder a cualquier empresa
    if (user!.rol !== 'dev' && empleado.empresa_id !== user!.empresaId) {
      return ApiError.forbidden()
    }

    // Obtener nombre de la empresa
    const { data: empresa } = await supabase
      .from('empresas')
      .select('nombre')
      .eq('id', empleado.empresa_id)
      .single()

    const nombreEmpresa = empresa?.nombre ?? 'la empresa'

    // Activar preboarding en la base de datos
    const ahora = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({
        preboarding_activo: true,
        fecha_acceso_preboarding: ahora,
      })
      .eq('id', empleado.id)

    if (updateError) {
      return ApiError.internal(updateError.message)
    }

    // Obtener buddy del empleado (si tiene asignado)
    const { data: buddyRelacion } = await supabase
      .from('equipo_relaciones')
      .select('usuario_relacionado_id')
      .eq('usuario_id', empleado.id)
      .eq('tipo', 'buddy')
      .single()

    let buddyNombre: string | null = null
    if (buddyRelacion) {
      const { data: buddy } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('id', buddyRelacion.usuario_relacionado_id)
        .single()
      buddyNombre = buddy?.nombre ?? null
    }

    // Construir URL de login (usar dominio de la request en prod, localhost en dev)
    const origin = req.headers.get('origin') ?? 'http://localhost:3000'
    const loginUrl = `${origin}/auth/login`

    // Enviar email de bienvenida vía sistema centralizado
    const { error: emailError } = await sendEmail(empleado.email, {
      tipo: 'bienvenida-colaborador',
      props: {
        nombre: empleado.nombre,
        empresa: nombreEmpresa,
        puesto: empleado.puesto ?? 'Colaborador',
        fechaIngreso: empleado.fecha_ingreso ?? ahora,
        buddyNombre,
        linkActivacion: loginUrl,
      },
    })

    if (emailError) {
      console.error('[preboarding] Error al enviar email:', emailError)
      // No falla el endpoint — el preboarding ya fue activado
    }

    return NextResponse.json({ ok: true, preboarding_activo: true })
  }
)
