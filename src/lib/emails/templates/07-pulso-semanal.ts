// Template: invitación a completar encuesta de pulso semanal

import type { PulsoSemanalProps, RenderedEmail } from '../types'

export function render(props: PulsoSemanalProps): RenderedEmail {
  const { nombre, semanaNumero, linkEncuesta } = props

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>\u00bfC\u00f3mo va tu semana?</title>
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
                \u00bfC\u00f3mo va tu semana ${semanaNumero}?
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.6;">
                Hola <strong style="color:#ffffff;">${nombre}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
                Quer\u00edamos saber c\u00f3mo te sent\u00eds. Son solo <strong style="color:#ffffff;">30 segundos</strong> y nos ayuda mucho a mejorar tu experiencia.
              </p>

              <!-- Preview de preguntas -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:14px 20px;background:rgba(59,79,216,0.08);border:1px solid rgba(59,79,216,0.2);border-radius:10px 10px 0 0;border-bottom:none;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:12px;">
                          <p style="margin:0;font-size:16px;line-height:20px;">&#9733;</p>
                        </td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.75);">\u00bfC\u00f3mo te sent\u00eds en tu puesto?</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;background:rgba(59,79,216,0.08);border:1px solid rgba(59,79,216,0.2);border-radius:0 0 10px 10px;border-top:none;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:12px;">
                          <p style="margin:0;font-size:16px;line-height:20px;">&#9733;</p>
                        </td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.75);">\u00bfSent\u00eds que ten\u00e9s lo que necesit\u00e1s para trabajar?</p>
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
                    <a href="${linkEncuesta}" style="display:inline-block;padding:12px 28px;background:#3B4FD8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                      Responder encuesta \u2192
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                Tus respuestas son confidenciales y nos ayudan a mejorar el proceso de onboarding.
              </p>
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
    subject: `${nombre}, \u00bfc\u00f3mo va tu semana?`,
    html,
  }
}
