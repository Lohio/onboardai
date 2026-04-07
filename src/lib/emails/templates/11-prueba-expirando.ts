// Template: aviso de vencimiento de prueba gratuita

import type { PruebaExpirandoProps, RenderedEmail } from '../types'

/** Retorna color según urgencia de días restantes */
function colorUrgencia(dias: number): string {
  if (dias <= 3) return '#EF4444'   // rojo
  if (dias <= 7) return '#F59E0B'   // amber
  return '#38bdf8'                   // sky
}

export function render(props: PruebaExpirandoProps): RenderedEmail {
  const { adminNombre, empresa, diasRestantes, empleadosOnboarding, linkContratar } = props
  const color = colorUrgencia(diasRestantes)

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tu prueba vence pronto</title>
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
                Tu prueba vence en ${diasRestantes} d\u00eda${diasRestantes !== 1 ? 's' : ''}
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
                La prueba gratuita de <strong style="color:#ffffff;">${empresa}</strong> en Heero est\u00e1 por vencer. Para que tu equipo no pierda el acceso, activ\u00e1 un plan antes de que termine.
              </p>

              <!-- Stats de uso -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">
                <tr>
                  <td width="50%" style="padding:0 4px 0 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0;font-size:28px;font-weight:700;color:${color};">${diasRestantes}</p>
                          <p style="margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">D\u00edas restantes</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" style="padding:0 0 0 4px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0;font-size:28px;font-weight:700;color:#8d9bf5;">${empleadosOnboarding}</p>
                          <p style="margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">En onboarding</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Mensaje de lo que pasa si vence -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">Si vence la prueba</p>
                    <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">Tus datos se mantienen por 30 d\u00edas, pero los empleados no podr\u00e1n acceder al onboarding ni al asistente IA.</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td>
                    <a href="${linkContratar}" style="display:inline-block;padding:12px 28px;background:#3B4FD8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                      Activar plan \u2192
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                Si ten\u00e9s dudas sobre los planes, respond\u00e9 a este email y te ayudamos.
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
    subject: `Tu prueba de Heero vence en ${diasRestantes} d\u00eda${diasRestantes !== 1 ? 's' : ''}`,
    html,
  }
}
