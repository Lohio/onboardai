// Template: email de bienvenida al admin que creó su cuenta

import type { BienvenidaAdminProps, RenderedEmail } from '../types'

/** Formatea fecha ISO a formato legible en español */
function formatFechaES(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function render(props: BienvenidaAdminProps): RenderedEmail {
  const { nombreAdmin, nombreEmpresa, linkDashboard, fechaVencimientoPrueba } = props
  const fechaFormateada = formatFechaES(fechaVencimientoPrueba)

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido a Heero</title>
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
                \u00a1Bienvenido a Heero, ${nombreAdmin}!
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.6;">
                Tu cuenta de <strong style="color:#ffffff;">${nombreEmpresa}</strong> est\u00e1 lista. Ahora pod\u00e9s configurar el onboarding de tu equipo en minutos.
              </p>

              <!-- 3 pasos de setup -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
                <!-- Paso 1 -->
                <tr>
                  <td style="padding:14px 20px;background:rgba(59,79,216,0.08);border:1px solid rgba(59,79,216,0.2);border-radius:10px 10px 0 0;border-bottom:none;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:14px;">
                          <p style="margin:0;font-size:13px;font-weight:700;color:#8d9bf5;width:22px;height:22px;line-height:22px;text-align:center;background:rgba(59,79,216,0.2);border-radius:6px;">1</p>
                        </td>
                        <td>
                          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#ffffff;">Carg\u00e1 el conocimiento de tu empresa</p>
                          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);">Cultura, valores, procesos y todo lo que tu equipo necesita saber.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Paso 2 -->
                <tr>
                  <td style="padding:14px 20px;background:rgba(59,79,216,0.08);border-left:1px solid rgba(59,79,216,0.2);border-right:1px solid rgba(59,79,216,0.2);">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:14px;">
                          <p style="margin:0;font-size:13px;font-weight:700;color:#8d9bf5;width:22px;height:22px;line-height:22px;text-align:center;background:rgba(59,79,216,0.2);border-radius:6px;">2</p>
                        </td>
                        <td>
                          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#ffffff;">Sum\u00e1 a tus colaboradores</p>
                          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);">Cre\u00e1 sus perfiles y asign\u00e1 roles, herramientas y tareas.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Paso 3 -->
                <tr>
                  <td style="padding:14px 20px;background:rgba(59,79,216,0.08);border:1px solid rgba(59,79,216,0.2);border-radius:0 0 10px 10px;border-top:none;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:14px;">
                          <p style="margin:0;font-size:13px;font-weight:700;color:#8d9bf5;width:22px;height:22px;line-height:22px;text-align:center;background:rgba(59,79,216,0.2);border-radius:6px;">3</p>
                        </td>
                        <td>
                          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#ffffff;">Activ\u00e1 el preboarding</p>
                          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);">Cada colaborador recibe acceso y empieza a conocer la empresa antes del d\u00eda 1.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Info prueba gratuita -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(13,148,136,0.08);border:1px solid rgba(13,148,136,0.2);border-radius:10px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">Prueba gratuita</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#5eead4;">Activa hasta el ${fechaFormateada}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">Pod\u00e9s usar todas las funcionalidades sin l\u00edmites durante este per\u00edodo.</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td>
                    <a href="${linkDashboard}" style="display:inline-block;padding:12px 28px;background:#3B4FD8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                      Ir al dashboard \u2192
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                Si ten\u00e9s alguna duda, respond\u00e9 a este email y te ayudamos.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.5;">
                El equipo de <strong style="color:rgba(255,255,255,0.4);">Heero</strong>
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
    subject: `\u00a1Bienvenido a Heero, ${nombreAdmin}!`,
    html,
  }
}
