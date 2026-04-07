// Template: resumen semanal de progreso para el empleado

import type { ResumenSemanalEmpleadoProps, RenderedEmail } from '../types'

/** Retorna el color del semáforo de progreso según las reglas del proyecto */
function colorProgreso(porcentaje: number): string {
  if (porcentaje >= 70) return '#0D9488'  // teal
  if (porcentaje >= 30) return '#F59E0B'  // amber
  return '#EF4444'                         // rojo
}

export function render(props: ResumenSemanalEmpleadoProps): RenderedEmail {
  const { nombre, semanaNumero, modulosCompletados, tareasCompletadas, progresoTotal, proximaSemana } = props
  const color = colorProgreso(progresoTotal)

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tu semana ${semanaNumero} en resumen</title>
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
                Tu semana ${semanaNumero} en resumen
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.6;">
                Hola <strong style="color:#ffffff;">${nombre}</strong>, ac\u00e1 va un resumen de c\u00f3mo te fue esta semana.
              </p>

              <!-- Stats grid: 3 bloques en fila -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
                <tr>
                  <!-- Progreso total -->
                  <td width="33%" style="padding:0 4px 0 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0;font-size:28px;font-weight:700;color:${color};">${progresoTotal}%</p>
                          <p style="margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">Progreso</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Módulos -->
                  <td width="33%" style="padding:0 2px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0;font-size:28px;font-weight:700;color:#8d9bf5;">${modulosCompletados}</p>
                          <p style="margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">M\u00f3dulos</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Tareas -->
                  <td width="33%" style="padding:0 0 0 4px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;">
                      <tr>
                        <td style="padding:16px 14px;text-align:center;">
                          <p style="margin:0;font-size:28px;font-weight:700;color:#38bdf8;">${tareasCompletadas}</p>
                          <p style="margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.35);">Tareas</p>
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
                    <table cellpadding="0" cellspacing="0" role="presentation" style="width:${progresoTotal}%;height:8px;">
                      <tr>
                        <td style="background:${color};border-radius:6px;height:8px;"></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Próxima semana -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(59,79,216,0.08);border:1px solid rgba(59,79,216,0.2);border-radius:10px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">Pr\u00f3xima semana</p>
                    <p style="margin:0;font-size:15px;font-weight:500;color:#c7d0ff;line-height:1.5;">${proximaSemana}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                Segu\u00ed as\u00ed. Cada paso te acerca a sentirte parte del equipo.
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
    subject: `Semana ${semanaNumero}: ${progresoTotal}% de progreso en tu onboarding`,
    html,
  }
}
