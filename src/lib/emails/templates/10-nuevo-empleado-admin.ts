// Template: notificación al admin de nuevo colaborador agregado

import type { NuevoEmpleadoAdminProps, RenderedEmail } from '../types'

/** Formatea fecha ISO a formato legible en español */
function formatFechaES(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function render(props: NuevoEmpleadoAdminProps): RenderedEmail {
  const { adminNombre, empleadoNombre, empleadoPuesto, fechaIngreso, buddyNombre, linkDashboard } = props
  const fechaFormateada = formatFechaES(fechaIngreso)

  const buddyLine = buddyNombre
    ? `<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);">Buddy asignado: <strong style="color:rgba(255,255,255,0.7);">${buddyNombre}</strong></p>`
    : `<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.4);font-style:italic;">Sin buddy asignado a\u00fan</p>`

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nuevo colaborador: ${empleadoNombre}</title>
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
                Nuevo colaborador agregado
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.6;">
                Hola <strong style="color:#ffffff;">${adminNombre}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
                Se agreg\u00f3 un nuevo colaborador al sistema. Ac\u00e1 te dejamos un resumen de su perfil y lo que va a pasar a continuaci\u00f3n.
              </p>

              <!-- Datos del empleado -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(59,79,216,0.08);border:1px solid rgba(59,79,216,0.2);border-radius:10px;margin:0 0 16px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">Colaborador</p>
                    <p style="margin:0 0 8px;font-size:17px;font-weight:600;color:#8d9bf5;">${empleadoNombre}</p>
                    <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,0.5);">Puesto: <strong style="color:rgba(255,255,255,0.7);">${empleadoPuesto}</strong></p>
                    <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,0.5);">Ingreso: <strong style="color:rgba(255,255,255,0.7);">${fechaFormateada}</strong></p>
                    ${buddyLine}
                  </td>
                </tr>
              </table>

              <!-- Qué va a pasar -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:14px 20px;background:rgba(13,148,136,0.08);border:1px solid rgba(13,148,136,0.2);border-radius:10px 10px 0 0;border-bottom:none;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:14px;">
                          <p style="margin:0;font-size:13px;font-weight:700;color:#5eead4;width:22px;height:22px;line-height:22px;text-align:center;background:rgba(13,148,136,0.2);border-radius:6px;">1</p>
                        </td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.75);">Cuando actives el preboarding, recibir\u00e1 un email de bienvenida</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;background:rgba(13,148,136,0.08);border-left:1px solid rgba(13,148,136,0.2);border-right:1px solid rgba(13,148,136,0.2);">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:14px;">
                          <p style="margin:0;font-size:13px;font-weight:700;color:#5eead4;width:22px;height:22px;line-height:22px;text-align:center;background:rgba(13,148,136,0.2);border-radius:6px;">2</p>
                        </td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.75);">El asistente IA se entrena con el conocimiento cargado</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;background:rgba(13,148,136,0.08);border:1px solid rgba(13,148,136,0.2);border-radius:0 0 10px 10px;border-top:none;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:14px;">
                          <p style="margin:0;font-size:13px;font-weight:700;color:#5eead4;width:22px;height:22px;line-height:22px;text-align:center;background:rgba(13,148,136,0.2);border-radius:6px;">3</p>
                        </td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.75);">Vas a poder seguir su progreso desde el dashboard</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td>
                    <a href="${linkDashboard}" style="display:inline-block;padding:12px 28px;background:#3B4FD8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                      Ver en el dashboard \u2192
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.5;">
                Enviado por <strong style="color:rgba(255,255,255,0.4);">Heero</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()

  return {
    subject: `Nuevo colaborador agregado: ${empleadoNombre}`,
    html,
  }
}
