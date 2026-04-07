// Template: alerta al admin por inactividad de un empleado

import type { AlertaAdminProps, RenderedEmail } from '../types'

/** Retorna el color del semáforo de progreso según las reglas del proyecto */
function colorProgreso(porcentaje: number): string {
  if (porcentaje >= 70) return '#0D9488'  // teal
  if (porcentaje >= 30) return '#F59E0B'  // amber
  return '#EF4444'                         // rojo
}

/** Retorna la etiqueta de urgencia según días sin actividad */
function etiquetaUrgencia(dias: number): { texto: string; color: string } {
  if (dias >= 7) return { texto: 'Cr\u00edtico', color: '#EF4444' }
  if (dias >= 3) return { texto: 'Atenci\u00f3n', color: '#F59E0B' }
  return { texto: 'Aviso', color: '#38bdf8' }
}

export function render(props: AlertaAdminProps): RenderedEmail {
  const { nombreAdmin, nombreEmpleado, diasSinActividad, progresoActual } = props
  const colorProg = colorProgreso(progresoActual)
  const urgencia = etiquetaUrgencia(diasSinActividad)

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Alerta de inactividad</title>
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
                Alerta de inactividad
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.6;">
                Hola <strong style="color:#ffffff;">${nombreAdmin}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
                <strong style="color:#ffffff;">${nombreEmpleado}</strong> lleva <strong style="color:${urgencia.color};">${diasSinActividad} d\u00edas</strong> sin actividad en su onboarding. Te recomendamos hacer un seguimiento.
              </p>

              <!-- Badge de urgencia + stats -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;">
                <tr>
                  <!-- Urgencia -->
                  <td width="50%" style="padding:0 4px 0 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">Urgencia</p>
                          <p style="margin:0;font-size:16px;font-weight:700;color:${urgencia.color};">${urgencia.texto}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Progreso -->
                  <td width="50%" style="padding:0 0 0 4px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">Progreso</p>
                          <p style="margin:0;font-size:16px;font-weight:700;color:${colorProg};">${progresoActual}%</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Barra de progreso visual -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
                <tr>
                  <td style="background:rgba(255,255,255,0.06);border-radius:6px;height:8px;">
                    <table cellpadding="0" cellspacing="0" role="presentation" style="width:${progresoActual}%;height:8px;">
                      <tr>
                        <td style="background:${colorProg};border-radius:6px;height:8px;"></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Detalle -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">Empleado</p>
                    <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#fbbf24;">${nombreEmpleado}</p>
                    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);">\u00daltima actividad hace ${diasSinActividad} d\u00edas \u00b7 ${progresoActual}% completado</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                Pod\u00e9s contactar al empleado o a su buddy para entender si necesita ayuda. Un mensaje a tiempo puede hacer la diferencia.
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
    subject: `${nombreEmpleado} lleva ${diasSinActividad} d\u00edas sin actividad`,
    html,
  }
}
