import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { preboardingSchema } from '@/lib/schemas/admin'
import { ApiError } from '@/lib/errors'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatFechaES(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function buildEmailHtml({
  nombreEmpleado,
  nombreEmpresa,
  fechaIngreso,
  loginUrl,
}: {
  nombreEmpleado: string
  nombreEmpresa: string
  fechaIngreso: string
  loginUrl: string
}): string {
  const fechaFormateada = formatFechaES(fechaIngreso)
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Acceso a OnboardAI</title>
</head>
<body style="margin:0;padding:0;background:#040810;font-family:'Inter',Arial,sans-serif;color:#e8eaf0;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" style="max-width:520px;background:#0f1f3d;border-radius:16px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Heero</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
                ¡Tu onboarding en ${nombreEmpresa} está listo!
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.6;">
                Hola <strong style="color:#ffffff;">${nombreEmpleado}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
                Tu acceso a <strong style="color:#ffffff;">Heero</strong> ya está activado. Podés ingresar ahora y explorar la cultura de <strong>${nombreEmpresa}</strong> y conocer a tu equipo antes de tu primer día oficial.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td>
                    <a href="${loginUrl}" style="display:inline-block;padding:12px 28px;background:#0EA5E9;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                      Ingresar a OnboardAI →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info ingreso -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.2);border-radius:10px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">Tu primer día oficial</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#8d9bf5;">${fechaFormateada}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                Mientras tanto podés explorar la cultura de la empresa y conocer a tu equipo. El resto de los módulos estarán disponibles desde el día de tu ingreso.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.5;">
                El equipo de <strong style="color:rgba(255,255,255,0.4);">${nombreEmpresa}</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()
}

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
      .select('id, nombre, email, empresa_id, fecha_ingreso')
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

    // Construir URL de login (usar dominio de la request en prod, localhost en dev)
    const origin = req.headers.get('origin') ?? 'http://localhost:3000'
    const loginUrl = `${origin}/auth/login`

    // Construir email
    const emailHtml = buildEmailHtml({
      nombreEmpleado: empleado.nombre,
      nombreEmpresa,
      fechaIngreso: empleado.fecha_ingreso ?? ahora,
      loginUrl,
    })

    const asunto = `¡Tu onboarding en ${nombreEmpresa} está listo!`

    // Enviar email vía Resend (si hay API key) o loguear en consola
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(resendKey)

        const { error: emailError } = await resend.emails.send({
          from: `${nombreEmpresa} <onboarding@resend.dev>`,
          to: [empleado.email],
          subject: asunto,
          html: emailHtml,
        })

        if (emailError) {
          console.error('[preboarding] Error al enviar email vía Resend:', emailError)
          // No falla el endpoint — el preboarding ya fue activado
        }
      } catch (err) {
        console.error('[preboarding] Error al inicializar Resend:', err)
      }
    } else {
      // Sin RESEND_API_KEY: loguear el email en consola para desarrollo
      console.log('[preboarding] RESEND_API_KEY no configurada. Email que se enviaría:')
      console.log(`  Para: ${empleado.email}`)
      console.log(`  Asunto: ${asunto}`)
      console.log(`  Login URL: ${loginUrl}`)
    }

    return NextResponse.json({ ok: true, preboarding_activo: true })
  }
)
