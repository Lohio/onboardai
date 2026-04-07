// Template: invitación a unirse al workspace de comunicación

import type { InvitacionWorkspaceProps, RenderedEmail } from '../types'

/** Retorna nombre legible y color del canal */
function infoCanal(canal: 'slack' | 'google_chat'): { nombre: string; color: string } {
  if (canal === 'slack') return { nombre: 'Slack', color: '#E01E5A' }
  return { nombre: 'Google Chat', color: '#00AC47' }
}

export function render(props: InvitacionWorkspaceProps): RenderedEmail {
  const { nombre, empresa, canal, workspaceName, linkUnirse } = props
  const info = infoCanal(canal)

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>\u00danete al workspace de ${empresa}</title>
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
                \u00danete al workspace de ${empresa}
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
                Tu equipo usa <strong style="color:${info.color};">${info.nombre}</strong> para comunicarse. Uni\u00e9ndote al workspace vas a poder hablar con tu buddy y tu equipo desde el d\u00eda 1.
              </p>

              <!-- Workspace info -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(59,79,216,0.08);border:1px solid rgba(59,79,216,0.2);border-radius:10px;margin:0 0 24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);">Workspace</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:#8d9bf5;">${workspaceName}</p>
                  </td>
                </tr>
              </table>

              <!-- 3 pasos -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:14px 20px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px 10px 0 0;border-bottom:none;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:14px;">
                          <p style="margin:0;font-size:13px;font-weight:700;color:#8d9bf5;width:22px;height:22px;line-height:22px;text-align:center;background:rgba(59,79,216,0.2);border-radius:6px;">1</p>
                        </td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.75);">Hac\u00e9 clic en el bot\u00f3n de abajo</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;background:rgba(255,255,255,0.04);border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:14px;">
                          <p style="margin:0;font-size:13px;font-weight:700;color:#8d9bf5;width:22px;height:22px;line-height:22px;text-align:center;background:rgba(59,79,216,0.2);border-radius:6px;">2</p>
                        </td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.75);">Inici\u00e1 sesi\u00f3n con tu email de trabajo</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:0 0 10px 10px;border-top:none;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:top;padding-right:14px;">
                          <p style="margin:0;font-size:13px;font-weight:700;color:#8d9bf5;width:22px;height:22px;line-height:22px;text-align:center;background:rgba(59,79,216,0.2);border-radius:6px;">3</p>
                        </td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.75);">Presentate en el canal de bienvenida</p>
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
                    <a href="${linkUnirse}" style="display:inline-block;padding:12px 28px;background:#3B4FD8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                      Unirme a ${info.nombre} \u2192
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">
                Si ten\u00e9s problemas para acceder, contacta a tu referente de IT.
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
    subject: `\u00danete al workspace de ${empresa}`,
    html,
  }
}
