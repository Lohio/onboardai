// Template: envío principal del módulo del día (no recordatorio)

import type { ModuloDiarioFallbackProps, RenderedEmail } from '../types'

export function render(props: ModuloDiarioFallbackProps): RenderedEmail {
  const { nombre, moduloNombre, diaNumero, linkModulo } = props

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tu m\u00f3dulo del d\u00eda ${diaNumero}</title>
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
                Tu m\u00f3dulo del d\u00eda ${diaNumero}
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
                Hoy te toca avanzar con un nuevo m\u00f3dulo de tu onboarding. Son pocos minutos y cada uno te acerca m\u00e1s a sentirte parte del equipo.
              </p>

              <!-- Info del módulo -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(59,79,216,0.08);border:1px solid rgba(59,79,216,0.2);border-radius:10px;margin:0 0 16px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">M\u00f3dulo de hoy</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#8d9bf5;">${moduloNombre}</p>
                  </td>
                </tr>
              </table>

              <!-- Día del onboarding -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(13,148,136,0.08);border:1px solid rgba(13,148,136,0.2);border-radius:10px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">D\u00eda de onboarding</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#5eead4;">D\u00eda ${diaNumero}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td>
                    <a href="${linkModulo}" style="display:inline-block;padding:12px 28px;background:#3B4FD8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                      Empezar m\u00f3dulo \u2192
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                Si ten\u00e9s alguna duda, us\u00e1 el asistente IA dentro de la plataforma.
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
    subject: `Tu m\u00f3dulo del d\u00eda ${diaNumero}: ${moduloNombre}`,
    html,
  }
}
