// Template: aviso de consumo de cuota IA (80% o 100%)

import type { CuotaIAProps, RenderedEmail } from '../types'

export function render(props: CuotaIAProps): RenderedEmail {
  const { adminNombre, empresa, umbral, usadas, limite, linkSuscripcion } = props
  const agotada = umbral >= 100
  const color = agotada ? '#EF4444' : '#F59E0B'
  const titulo = agotada
    ? 'Tu empresa agotó las consultas IA del mes'
    : `Tu empresa usó el ${umbral}% de las consultas IA del mes`

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titulo}</title>
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
                ${titulo}
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
                ${agotada
                  ? `El equipo de <strong style="color:#ffffff;">${empresa}</strong> alcanzó el límite de consultas al asistente IA incluido en tu plan. Hasta el próximo mes, el asistente responderá con un aviso de límite alcanzado.`
                  : `El equipo de <strong style="color:#ffffff;">${empresa}</strong> está usando activamente el asistente IA — ya consumió el ${umbral}% de las consultas incluidas en tu plan este mes.`}
              </p>

              <!-- Stat de consumo -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 14px;text-align:center;">
                    <p style="margin:0;font-size:28px;font-weight:700;color:${color};">${usadas.toLocaleString('es-AR')} / ${limite.toLocaleString('es-AR')}</p>
                    <p style="margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">Consultas IA este mes</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td>
                    <a href="${linkSuscripcion}" style="display:inline-block;padding:12px 28px;background:#3B4FD8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                      ${agotada ? 'Ampliar plan ahora →' : 'Ver planes →'}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                La cuota se renueva automáticamente el primer día de cada mes.
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
    subject: agotada
      ? `${empresa} agotó las consultas IA del mes — ampliá tu plan`
      : `${empresa} ya usó el ${umbral}% de las consultas IA del mes`,
    html,
  }
}
