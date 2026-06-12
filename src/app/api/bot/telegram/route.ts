import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { procesarBienvenida, BOTONES_BIENVENIDA } from '@/lib/bienvenidaCore'

function replyKeyboard() {
  return {
    keyboard: [
      [{ text: BOTONES_BIENVENIDA[0] }, { text: BOTONES_BIENVENIDA[1] }],
      [{ text: BOTONES_BIENVENIDA[2] }, { text: BOTONES_BIENVENIDA[3] }],
    ],
    resize_keyboard: true,
  }
}

export const POST = withHandler(
  {
    auth:      'webhook',
    bodyType:  'none',
    rateLimit: RATE_LIMITS.bot,
  },
  async ({ req }) => {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Telegram no configurado' }, { status: 503 })
    }

    // Comparación en tiempo constante (consistente con Teams/MP/cron)
    const headerSecret = req.headers.get('x-telegram-bot-api-secret-token') ?? ''
    const coincide =
      headerSecret.length === secret.length &&
      crypto.timingSafeEqual(Buffer.from(headerSecret), Buffer.from(secret))
    if (!coincide) {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
    }

    try {
      const update = (await req.json()) as {
        message?: {
          text?: string
          chat?: { id: number }
          from?: { id: number }
        }
      }

      const msg        = update.message
      const text       = (msg?.text ?? '').trim()
      const chatId     = msg?.chat?.id
      const chatUserId = msg?.from?.id != null ? String(msg.from.id) : ''

      if (!chatId || !chatUserId || !text) {
        return NextResponse.json({ ok: true })
      }

      const { texto, mostrarBotones } = await procesarBienvenida({
        chatUserId,
        plataforma: 'telegram',
        mensaje:    text,
      })

      return NextResponse.json({
        method:  'sendMessage',
        chat_id: chatId,
        text:    texto,
        ...(mostrarBotones ? { reply_markup: replyKeyboard() } : {}),
      })
    } catch (err) {
      console.error('[telegram] Error procesando update:', err)
      return NextResponse.json({ ok: true })
    }
  }
)
