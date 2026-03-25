import { NextResponse } from 'next/server'
import { streamChat, logMensaje } from '@/lib/claude'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { chatSchema } from '@/lib/schemas/empleado'

// ─────────────────────────────────────────────
// POST /api/empleado/chat
// Chat con el asistente IA (streaming).
// Rate limiting gestionado por withHandler (RATE_LIMITS.chat).
// ─────────────────────────────────────────────

export const POST = withHandler(
  {
    auth: 'session',
    schema: chatSchema,
    streaming: true,
    rateLimit: RATE_LIMITS.chat,
  },
  async ({ body, supabase, user }) => {
    const { mensaje, conversacionId } = body

    // ── Datos del empleado ────────────────────────────────────────
    const { data: usuario } = await supabase!
      .from('usuarios')
      .select('nombre, puesto, empresa_id, fecha_ingreso')
      .eq('id', user!.id)
      .single()

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const { empresa_id: empresaId } = usuario

    // ── Gestión de conversación ───────────────────────────────────
    let historial: { role: 'user' | 'assistant'; content: string }[] = []
    let convId = conversacionId ?? null

    if (convId) {
      // Cargar historial existente (últimas 20 interacciones)
      const { data: mensajesHistorial } = await supabase!
        .from('mensajes_ia')
        .select('rol, contenido')
        .eq('conversacion_id', convId)
        .order('created_at', { ascending: true })
        .limit(20)

      historial = (mensajesHistorial ?? []).map(m => ({
        role: m.rol as 'user' | 'assistant',
        content: m.contenido,
      }))
    } else {
      // Crear nueva conversación
      const { data: nuevaConv } = await supabase!
        .from('conversaciones_ia')
        .insert({ usuario_id: user!.id, empresa_id: empresaId })
        .select('id')
        .single()
      convId = nuevaConv?.id ?? null
    }

    // Guardar mensaje del usuario en el historial persistente
    if (convId) {
      await supabase!.from('mensajes_ia').insert({
        conversacion_id: convId,
        rol: 'user',
        contenido: mensaje,
      })
    }

    // Log de auditoría (mensajes_chat) — fire and forget
    logMensaje({ usuarioId: user!.id, empresaId, rol: 'user', contenido: mensaje })

    // ── Streaming ────────────────────────────────────────────────
    let respuestaCompleta = ''
    let tokenUsage = { inputTokens: 0, outputTokens: 0 }

    // Contexto del empleado para personalizar el system prompt
    const diasOnboarding = usuario.fecha_ingreso
      ? Math.max(1, Math.ceil((Date.now() - new Date(usuario.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24)))
      : null

    const contextoEmpleado = [
      usuario.nombre ? `El empleado se llama ${usuario.nombre}.` : '',
      usuario.puesto ? `Su puesto es ${usuario.puesto}.` : '',
      diasOnboarding ? `Lleva ${diasOnboarding} día${diasOnboarding === 1 ? '' : 's'} en la empresa.` : '',
    ].filter(Boolean).join(' ')

    // Capturar referencias para uso dentro del ReadableStream
    const supabaseRef = supabase!
    const userId = user!.id

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        try {
          tokenUsage = await streamChat({
            empresaId,
            contextoEmpleado,
            mensajes: [
              ...historial,
              { role: 'user', content: mensaje },
            ],
            onChunk: (text) => {
              respuestaCompleta += text
              controller.enqueue(encoder.encode(text))
            },
            onDone: () => {
              // streamChat resuelve acá; el trabajo post-stream
              // se hace después del await en el bloque de abajo
            },
          })

          // ── Trabajo post-stream ───────────────────────────────
          if (convId && respuestaCompleta) {
            // Persistir respuesta del asistente
            await supabaseRef.from('mensajes_ia').insert({
              conversacion_id: convId,
              rol: 'assistant',
              contenido: respuestaCompleta,
            })

            // Marcar progreso M4 — primer uso del asistente
            await supabaseRef.from('progreso_modulos').upsert({
              usuario_id: userId,
              modulo: 'asistente',
              bloque: 'chat',
              completado: true,
              completado_at: new Date().toISOString(),
            }, { onConflict: 'usuario_id,modulo,bloque' })

            // Log de auditoría de la respuesta
            logMensaje({
              usuarioId: userId,
              empresaId,
              rol: 'assistant',
              contenido: respuestaCompleta,
            })

            // Registro de uso de tokens (visible en logs de Vercel/servidor)
            console.log('[chat:tokens]', JSON.stringify({
              usuario_id: userId,
              empresa_id: empresaId,
              input_tokens: tokenUsage.inputTokens,
              output_tokens: tokenUsage.outputTokens,
              total_tokens: tokenUsage.inputTokens + tokenUsage.outputTokens,
            }))
          }


        } catch (err) {
          console.error('Error durante streaming de chat:', err)
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Conversation-Id': convId ?? '',
      },
    })
  }
)
