// Endpoint para el bot de Google Chat
// Google Chat envía eventos POST con verificación via token Bearer
import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { procesarMensajeBot } from '@/lib/botCore'

// ─────────────────────────────────────────────
// Verificación del token de Google
// ─────────────────────────────────────────────

async function verificarTokenGoogle(token: string): Promise<boolean> {
  try {
    // Obtener el email esperado desde el service account configurado
    let expectedEmail: string | null = null
    const credJson = process.env.GCHAT_SERVICE_ACCOUNT_JSON
    if (credJson) {
      try {
        const creds = JSON.parse(credJson) as { client_email?: string }
        expectedEmail = creds.client_email ?? null
      } catch { /* JSON malformado — se rechazará abajo */ }
    }

    // Requerir que el service account esté correctamente configurado con client_email
    if (!expectedEmail) {
      console.warn('[gchat] verificarTokenGoogle: GCHAT_SERVICE_ACCOUNT_JSON no contiene client_email — rechazando token')
      return false
    }

    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`
    )
    if (!res.ok) return false
    const data = await res.json() as { email?: string; issued_to?: string; error?: string }

    // Rechazar tokens con error explícito de Google
    if (data.error) return false

    // Verificar que el token venga exactamente del service account configurado
    return data.email === expectedEmail || data.issued_to === expectedEmail
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────
// POST /api/bot/gchat
// ─────────────────────────────────────────────

export const POST = withHandler(
  {
    auth: 'webhook',   // withHandler no verifica auth — lo hace el handler
    bodyType: 'none',  // no parsear body automáticamente
    rateLimit: RATE_LIMITS.bot,
  },
  async ({ req }) => {
    // Verificar que GCHAT_SERVICE_ACCOUNT_JSON esté configurado
    if (!process.env.GCHAT_SERVICE_ACCOUNT_JSON) {
      return NextResponse.json(
        { error: 'Integración de Google Chat no configurada' },
        { status: 503 }
      )
    }

    try {
      // Verificar token de autorización
      const authHeader = req.headers.get('authorization') ?? ''
      const token = authHeader.replace('Bearer ', '').trim()

      if (!token) {
        return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })
      }

      const tokenValido = await verificarTokenGoogle(token)
      if (!tokenValido) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
      }

      // Parsear evento de Google Chat
      const event = await req.json() as {
        type: string
        message?: {
          text: string
          sender: {
            email: string
            name:  string // formato: users/123
          }
        }
      }

      // Solo procesar mensajes (ignorar ADDED_TO_SPACE, REMOVED_FROM_SPACE, etc.)
      if (event.type !== 'MESSAGE' || !event.message) {
        return NextResponse.json({ text: '👋' })
      }

      // Limpiar @menciones del texto
      const mensaje = event.message.text.replace(/@\w+/g, '').trim()
      if (!mensaje) {
        return NextResponse.json({ text: '¿En qué puedo ayudarte?' })
      }

      const email      = event.message.sender.email
      const chatUserId = event.message.sender.name // ej: "users/123"

      // Procesar con el core del bot
      const { respuesta, linkWebApp } = await procesarMensajeBot({
        chatUserId,
        chatEmail: email || null,
        plataforma: 'gchat',
        mensaje,
      })

      // Formatear respuesta para Google Chat
      if (linkWebApp) {
        // Usar Card v2 con botón cuando hay link
        return NextResponse.json({
          cardsV2: [{
            cardId: 'bot-response',
            card: {
              sections: [{
                widgets: [
                  {
                    textParagraph: { text: respuesta },
                  },
                  {
                    buttonList: {
                      buttons: [{
                        text: linkWebApp.texto,
                        onClick: {
                          openLink: { url: linkWebApp.url },
                        },
                      }],
                    },
                  },
                ],
              }],
            },
          }],
        })
      }

      // Respuesta de texto simple
      return NextResponse.json({ text: respuesta })

    } catch (err) {
      console.error('[gchat] Error procesando evento:', err)
      return NextResponse.json(
        { text: 'Ocurrió un error inesperado. Intentá de nuevo.' },
        { status: 200 } // Google Chat espera 200 siempre para no reintentar
      )
    }
  }
)
