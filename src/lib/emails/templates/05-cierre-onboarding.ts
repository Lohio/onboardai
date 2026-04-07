// Template: celebración de cierre de onboarding

import type { CierreOnboardingProps, RenderedEmail } from '../types'

export function render(props: CierreOnboardingProps): RenderedEmail {
  const { nombre, empresa, diasTotales, modulosCompletados, preguntasRealizadas } = props

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Completaste tu onboarding</title>
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
                \ud83c\udf89 \u00a1Felicitaciones, ${nombre}!
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.6;">
                Completaste tu onboarding en <strong style="color:#ffffff;">${empresa}</strong>. Ya sos parte del equipo.
              </p>

              <!-- Stats grid -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
                <tr>
                  <td width="33%" style="padding:0 4px 0 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(13,148,136,0.08);border:1px solid rgba(13,148,136,0.2);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0;font-size:28px;font-weight:700;color:#5eead4;">${diasTotales}</p>
                          <p style="margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">D\u00edas</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="33%" style="padding:0 2px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(59,79,216,0.08);border:1px solid rgba(59,79,216,0.2);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0;font-size:28px;font-weight:700;color:#8d9bf5;">${modulosCompletados}</p>
                          <p style="margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">M\u00f3dulos</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="33%" style="padding:0 0 0 4px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.2);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0;font-size:28px;font-weight:700;color:#38bdf8;">${preguntasRealizadas}</p>
                          <p style="margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">Preguntas</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Asistente disponible -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(59,79,216,0.08);border:1px solid rgba(59,79,216,0.2);border-radius:10px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">Recordatorio</p>
                    <p style="margin:0;font-size:15px;font-weight:500;color:#c7d0ff;line-height:1.5;">Tu asistente IA sigue disponible para cualquier duda que tengas sobre la empresa, procesos o herramientas.</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                Gracias por completar cada paso. El equipo de ${empresa} est\u00e1 feliz de tenerte.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.5;">
                El equipo de <strong style="color:rgba(255,255,255,0.4);">${empresa}</strong>
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
    subject: `\ud83c\udf89 \u00a1Felicitaciones ${nombre}! Completaste tu onboarding`,
    html,
  }
}
