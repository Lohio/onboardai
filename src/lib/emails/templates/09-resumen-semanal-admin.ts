// Template: resumen semanal para el admin con KPIs del equipo

import type { ResumenSemanalAdminProps, RenderedEmail } from '../types'

/** Retorna el color del engagement */
function colorEngagement(tasa: number): string {
  if (tasa >= 70) return '#0D9488'  // teal
  if (tasa >= 30) return '#F59E0B'  // amber
  return '#EF4444'                   // rojo
}

export function render(props: ResumenSemanalAdminProps): RenderedEmail {
  const { adminNombre, empresa, empleadosActivos, modulosCompletadosTotal, empleadosEnRiesgo, tasaEngagement, linkDashboard } = props
  const colorEng = colorEngagement(tasaEngagement)

  const riesgoBlock = empleadosEnRiesgo > 0
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;margin:0 0 24px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">Atenci\u00f3n</p>
            <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#fbbf24;">${empleadosEnRiesgo} empleado${empleadosEnRiesgo > 1 ? 's' : ''} en riesgo</p>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);">Tienen baja actividad o progreso. Revis\u00e1 su estado en el dashboard.</p>
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
  <title>Resumen semanal de ${empresa}</title>
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
                Resumen semanal de ${empresa}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.6;">
                Hola <strong style="color:#ffffff;">${adminNombre}</strong>, ac\u00e1 va el resumen de c\u00f3mo le fue a tu equipo esta semana.
              </p>

              <!-- KPIs grid: 2x2 -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 8px;">
                <tr>
                  <td width="50%" style="padding:0 4px 8px 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0;font-size:28px;font-weight:700;color:#8d9bf5;">${empleadosActivos}</p>
                          <p style="margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">Activos</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" style="padding:0 0 8px 4px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0;font-size:28px;font-weight:700;color:#38bdf8;">${modulosCompletadosTotal}</p>
                          <p style="margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">M\u00f3dulos</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:0 4px 0 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0;font-size:28px;font-weight:700;color:${colorEng};">${tasaEngagement}%</p>
                          <p style="margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">Engagement</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" style="padding:0 0 0 4px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0;font-size:28px;font-weight:700;color:${empleadosEnRiesgo > 0 ? '#F59E0B' : '#5eead4'};">${empleadosEnRiesgo}</p>
                          <p style="margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">En riesgo</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Empleados en riesgo (condicional) -->
              ${riesgoBlock}

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:${empleadosEnRiesgo > 0 ? '0' : '16px'} 0 28px;">
                <tr>
                  <td>
                    <a href="${linkDashboard}" style="display:inline-block;padding:12px 28px;background:#3B4FD8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                      Ver dashboard completo \u2192
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                Este resumen se env\u00eda todos los lunes. Pod\u00e9s desactivarlo desde la configuraci\u00f3n.
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
    subject: `Resumen semanal de ${empresa}`,
    html,
  }
}
