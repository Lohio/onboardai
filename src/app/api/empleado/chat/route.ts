import { NextResponse } from 'next/server'
import { streamChat, logMensaje } from '@/lib/claude'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    // ── Auth ──────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { mensaje, conversacionId } = await request.json() as {
      mensaje: string
      conversacionId: string | null
    }

    if (!mensaje?.trim()) {
      return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
    }

    // ── Datos del empleado ────────────────────────────────────────
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('nombre, puesto, empresa_id')
      .eq('id', user.id)
      .single()

    if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const { empresa_id: empresaId } = usuario

    // ── Gestión de conversación ───────────────────────────────────
    let historial: { role: 'user' | 'assistant'; content: string }[] = []
    let convId = conversacionId

    if (convId) {
      // Cargar historial existente (últimas 20 interacciones)
      const { data: mensajesHistorial } = await supabase
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
      const { data: nuevaConv } = await supabase
        .from('conversaciones_ia')
        .insert({ usuario_id: user.id, empresa_id: empresaId })
        .select('id')
        .single()
      convId = nuevaConv?.id ?? null
    }

    // Guardar mensaje del usuario en el historial persistente
    if (convId) {
      await supabase.from('mensajes_ia').insert({
        conversacion_id: convId,
        rol: 'user',
        contenido: mensaje,
      })
    }

    // Log de auditoría (mensajes_chat) — fire and forget
    logMensaje({ usuarioId: user.id, empresaId, rol: 'user', contenido: mensaje })

    // ── Streaming ────────────────────────────────────────────────
    // Se usa streamChat que internamente llama buildSystemPrompt
    // y lee model/max_tokens de app_config.
    let respuestaCompleta = ''

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        try {
          await streamChat({
            empresaId,
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
            await supabase.from('mensajes_ia').insert({
              conversacion_id: convId,
              rol: 'assistant',
              contenido: respuestaCompleta,
            })

            // Marcar progreso M4 — primer uso del asistente
            await supabase.from('progreso_modulos').upsert({
              usuario_id: user.id,
              modulo: 'asistente',
              bloque: 'chat',
              completado: true,
              completado_at: new Date().toISOString(),
            }, { onConflict: 'usuario_id,modulo,bloque' })

            // Log de auditoría de la respuesta
            logMensaje({
              usuarioId: user.id,
              empresaId,
              rol: 'assistant',
              contenido: respuestaCompleta,
            })
          }

          // Enviar conversacionId al final del stream (parseado por el cliente)
          if (convId) {
            controller.enqueue(encoder.encode(`|--|${convId}`))
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
  } catch (err) {
    console.error('Error en chat API:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
