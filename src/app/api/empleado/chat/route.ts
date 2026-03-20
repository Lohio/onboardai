import { NextResponse } from 'next/server'
import { streamChat, logMensaje } from '@/lib/claude'
import { createServerSupabaseClient } from '@/lib/supabase'
import { ApiError } from '@/lib/errors'

// Límite de mensajes de usuario por día (evita abuso de la API de Anthropic)
const RATE_LIMIT_DIARIO = 50

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    // ── Auth ──────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiError.unauthorized()

    const { mensaje, conversacionId } = await request.json() as {
      mensaje: string
      conversacionId: string | null
    }

    if (!mensaje?.trim()) {
      return ApiError.badRequest('Mensaje vacío')
    }

    if (mensaje.trim().length > 2000) {
      return ApiError.badRequest('El mensaje no puede superar los 2000 caracteres')
    }

    // ── Datos del empleado ────────────────────────────────────────
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('nombre, puesto, empresa_id, fecha_ingreso')
      .eq('id', user.id)
      .single()

    if (!usuario) return ApiError.notFound('Usuario')

    const { empresa_id: empresaId } = usuario

    // ── Rate limiting: máx. RATE_LIMIT_DIARIO mensajes por día ───
    const hoy = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const { count: mensajesHoy } = await supabase
      .from('mensajes_ia')
      .select('*', { count: 'exact', head: true })
      .eq('conversacion_id', conversacionId ?? '')
      .gte('created_at', `${hoy}T00:00:00.000Z`)

    // Si no hay conversacionId, contar por usuario en mensajes_chat
    let countHoy = mensajesHoy ?? 0
    if (!conversacionId) {
      const { count: countPorUsuario } = await supabase
        .from('mensajes_chat')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', user.id)
        .eq('rol', 'user')
        .gte('created_at', `${hoy}T00:00:00.000Z`)
      countHoy = countPorUsuario ?? 0
    }

    if (countHoy >= RATE_LIMIT_DIARIO) {
      return ApiError.tooManyRequests(
        `Alcanzaste el límite de ${RATE_LIMIT_DIARIO} mensajes por día. Volvé mañana.`
      )
    }

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
    let respuestaCompleta = ''

    // Contexto del empleado para personalizar el system prompt
    const diasOnboarding = usuario.fecha_ingreso
      ? Math.max(1, Math.ceil((Date.now() - new Date(usuario.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24)))
      : null

    const contextoEmpleado = [
      usuario.nombre ? `El empleado se llama ${usuario.nombre}.` : '',
      usuario.puesto ? `Su puesto es ${usuario.puesto}.` : '',
      diasOnboarding ? `Lleva ${diasOnboarding} día${diasOnboarding === 1 ? '' : 's'} en la empresa.` : '',
    ].filter(Boolean).join(' ')

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        try {
          await streamChat({
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
    return ApiError.internal()
  }
}


