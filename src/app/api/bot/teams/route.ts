// Endpoint para el bot de Microsoft Teams (Outgoing Webhook)
// Teams verifica la autenticidad via HMAC-SHA256
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { procesarMensajeBot } from '@/lib/botCore'

// ─────────────────────────────────────────────
// Verificación HMAC de Teams
// ─────────────────────────────────────────────

function verificarHmacTeams(body: string, authHeader: string): boolean {
  const token = process.env.TEAMS_WEBHOOK_TOKEN
  if (!token) return false

  try {
    const hmac = crypto.createHmac('sha256', Buffer.from(token, 'base64'))
    hmac.update(Buffer.from(body, 'utf8'))
    const hashEsperado = 'HMAC ' + hmac.digest('base64')
    // Comparación en tiempo constante para evitar timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(authHeader),
      Buffer.from(hashEsperado)
    )
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────
// POST /api/bot/teams
// ─────────────────────────────────────────────

export const POST = withHandler(
  {
    auth: 'webhook',   // withHandler no verifica auth — lo hace el handler
    bodyType: 'none',  // el handler lee req.text() internamente para el HMAC
    rateLimit: RATE_LIMITS.bot,
  },
  async ({ req }) => {
    // Verificar que TEAMS_WEBHOOK_TOKEN esté configurado
    if (!process.env.TEAMS_WEBHOOK_TOKEN) {
      return NextResponse.json(
        { type: 'message', text: 'Integración de Teams no configurada.' },
        { status: 503 }
      )
    }

    try {
      // Leer el body como string para verificar HMAC antes de parsear
      const bodyText   = await req.text()
      const authHeader = req.headers.get('authorization') ?? ''

      if (!verificarHmacTeams(bodyText, authHeader)) {
        return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
      }

      // Parsear el cuerpo del mensaje de Teams
      const body = JSON.parse(bodyText) as {
        text?: string
        from?: {
          id:          string
          aadObjectId: string
          name:        string
        }
      }

      // Limpiar etiquetas <at>...</at> que Teams incluye en las menciones
      const mensaje = (body.text ?? '').replace(/<at>[^<]+<\/at>/g, '').trim()

      if (!mensaje) {
        return NextResponse.json({
          type: 'message',
          text: '¿En qué puedo ayudarte?',
        })
      }

      const chatUserId = body.from?.id ?? ''
      // aadObjectId es un GUID de Azure AD, NO es un email — no usar para vinculación por email
      // La vinculación se hace manualmente o via chatUserId (primera interacción en la app web)
      const email: null = null

      // Procesar con el core del bot
      const { respuesta, linkWebApp } = await procesarMensajeBot({
        chatUserId,
        chatEmail: email,
        plataforma: 'teams',
        mensaje,
      })

      // Formatear respuesta para Teams (Adaptive Card si hay link)
      if (linkWebApp) {
        return NextResponse.json({
          type: 'message',
          attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
              $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
              type:    'AdaptiveCard',
              version: '1.4',
              body: [
                {
                  type:   'TextBlock',
                  text:   respuesta,
                  wrap:   true,
                  size:   'Default',
                },
              ],
              actions: [{
                type:  'Action.OpenUrl',
                title: linkWebApp.texto,
                url:   linkWebApp.url,
              }],
            },
          }],
        })
      }

      // Respuesta de texto simple
      return NextResponse.json({
        type: 'message',
        text: respuesta,
      })

    } catch (err) {
      console.error('[teams] Error procesando mensaje:', err)
      return NextResponse.json({
        type: 'message',
        text: 'Ocurrió un error inesperado. Intentá de nuevo.',
      })
    }
  }
)
