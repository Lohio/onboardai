// Template: email de bienvenida al colaborador (preboarding)

import type { BienvenidaColaboradorProps, RenderedEmail } from '../types'

/** Formatea fecha ISO a formato legible en español */
function formatFechaES(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function render(props: BienvenidaColaboradorProps): RenderedEmail {
  const { nombre, empresa, puesto, fechaIngreso, buddyNombre, linkActivacion } = props
  const fechaFormateada = formatFechaES(fechaIngreso)

  const buddyBlock = buddyNombre
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(13,148,136,0.08);border:1px solid rgba(13,148,136,0.2);border-radius:10px;margin:0 0 24px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">Tu buddy</p>
            <p style="margin:0;font-size:15px;font-weight:600;color:#5eead4;">${buddyNombre}</p>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">Te va a acompa\u00f1ar durante tus primeros d\u00edas</p>
          </td>
        </tr>
      </table>`
    : ''

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenida a ${empresa}</title>
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
                \u00a1Tu onboarding en ${empresa} est\u00e1 listo!
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
                Tu acceso a <strong style="color:#ffffff;">Heero</strong> ya est\u00e1 activado. Pod\u00e9s ingresar ahora y explorar la cultura de <strong>${empresa}</strong> y conocer a tu equipo antes de tu primer d\u00eda oficial.
              </p>

              <!-- Info del puesto -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(59,79,216,0.08);border:1px solid rgba(59,79,216,0.2);border-radius:10px;margin:0 0 16px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">Tu puesto</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#8d9bf5;">${puesto}</p>
                  </td>
                </tr>
              </table>

              <!-- Info fecha de ingreso -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.2);border-radius:10px;margin:0 0 16px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">Tu primer d\u00eda oficial</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#38bdf8;">${fechaFormateada}</p>
                  </td>
                </tr>
              </table>

              <!-- Buddy (condicional) -->
              ${buddyBlock}

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0 28px;">
                <tr>
                  <td>
                    <a href="${linkActivacion}" style="display:inline-block;padding:12px 28px;background:#3B4FD8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                      Ingresar a Heero \u2192
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                Mientras tanto pod\u00e9s explorar la cultura de la empresa y conocer a tu equipo. El resto de los m\u00f3dulos estar\u00e1n disponibles desde el d\u00eda de tu ingreso.
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
    subject: `\u00a1Tu onboarding en ${empresa} est\u00e1 listo!`,
    html,
  }
}
