import { NextResponse } from 'next/server'
import { anthropic, buildSystemPromptWithConfig } from '@/lib/claude'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { agenteSchema } from '@/lib/schemas/empleado'
import type { ChatMensaje } from '@/lib/claude'

// ─────────────────────────────────────────────
// POST /api/empleado/agente
// Streaming del agente flotante proactivo.
// Igual que /api/empleado/chat pero con system
// prompt orientado a guiar el onboarding paso a paso.
// No persiste conversación (historial en estado local).
// ─────────────────────────────────────────────

const INSTRUCCIONES_AGENTE = `Sos un guía de onboarding proactivo. Tu objetivo es ayudar al empleado a completar su proceso paso a paso. Cuando el empleado llegue al chat desde un módulo específico, orientá tu respuesta hacia ese módulo. Sé conciso, amigable y directo. Usá bullet points cuando hay múltiples puntos. Terminá siempre con una pregunta o próximo paso concreto.`

export const POST = withHandler(
  {
    auth: 'session',
    schema: agenteSchema,
    streaming: true,
    rateLimit: RATE_LIMITS.agente,
  },
  async ({ body, supabase, user }) => {
    const { mensaje, modulo, contexto, historial = [] } = body

    // ── Datos del empleado ────────────────────────────────────────
    const { data: usuario } = await supabase!
      .from('usuarios')
      .select('nombre, puesto, area, empresa_id, fecha_ingreso')
      .eq('id', user!.id)
      .single()

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const diasOnboarding = usuario.fecha_ingreso
      ? Math.max(1, Math.ceil((Date.now() - new Date(usuario.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24)))
      : null

    // Contexto del empleado enriquecido con módulo actual
    const contextoEmpleado = [
      usuario.nombre ? `El empleado se llama ${usuario.nombre}.` : '',
      usuario.puesto ? `Su puesto es ${usuario.puesto}.` : '',
      diasOnboarding ? `Lleva ${diasOnboarding} día${diasOnboarding === 1 ? '' : 's'} en la empresa.` : '',
      modulo ? `Está actualmente en el módulo: ${modulo}.` : '',
      contexto?.trim() ? contexto.trim() : '',
    ].filter(Boolean).join(' ')

    // ── System prompt: instrucciones agente + conocimiento empresa ─
    const { systemPrompt, config } = await buildSystemPromptWithConfig(
      usuario.empresa_id,
      contextoEmpleado,
      usuario.area ?? null,
      usuario.puesto ?? null,
    )
    const systemPromptAgente = `${INSTRUCCIONES_AGENTE}\n\n${systemPrompt}`

    // ── Streaming ─────────────────────────────────────────────────
    const mensajesCompletos: ChatMensaje[] = [
      ...historial,
      { role: 'user', content: mensaje },
    ]

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const stream = anthropic.messages.stream({
            model: config.claudeModel,
            max_tokens: config.maxTokens,
            system: systemPromptAgente,
            messages: mensajesCompletos,
          })

          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
        } catch (err) {
          console.error('[agente] Error en streaming:', err)
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  }
)
