import { NextResponse } from 'next/server'
import { anthropic, buildSystemPromptWithConfig } from '@/lib/claude'
import { createServerSupabaseClient } from '@/lib/supabase'
import { ApiError } from '@/lib/errors'
import type { ChatMensaje } from '@/lib/claude'

// ─────────────────────────────────────────────
// POST /api/empleado/agente
// Streaming del agente flotante proactivo.
// Igual que /api/empleado/chat pero con system
// prompt orientado a guiar el onboarding paso a paso.
// No persiste conversación (historial en estado local).
// ─────────────────────────────────────────────

const INSTRUCCIONES_AGENTE = `Sos un guía de onboarding proactivo. Tu objetivo es ayudar al empleado a completar su proceso paso a paso. Cuando el empleado llegue al chat desde un módulo específico, orientá tu respuesta hacia ese módulo. Sé conciso, amigable y directo. Usá bullet points cuando hay múltiples puntos. Terminá siempre con una pregunta o próximo paso concreto.`

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    // ── Auth ──────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiError.unauthorized()

    const body = await request.json() as {
      mensaje: string
      modulo?: string
      contexto?: string
      historial?: ChatMensaje[]
    }

    const { mensaje, modulo, contexto, historial = [] } = body

    if (!mensaje?.trim()) return ApiError.badRequest('Mensaje vacío')
    if (mensaje.trim().length > 2000) return ApiError.badRequest('El mensaje no puede superar los 2000 caracteres')

    // ── Datos del empleado ────────────────────────────────────────
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('nombre, puesto, empresa_id, fecha_ingreso')
      .eq('id', user.id)
      .single()

    if (!usuario) return ApiError.notFound('Usuario')

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
      contextoEmpleado
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
  } catch (err) {
    console.error('[agente] Error inesperado:', err)
    return ApiError.internal()
  }
}
