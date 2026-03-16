import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/claude'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    // Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { mensaje, conversacionId } = await request.json() as {
      mensaje: string
      conversacionId: string | null
    }

    if (!mensaje?.trim()) {
      return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
    }

    // Datos del empleado
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('nombre, puesto, empresa_id')
      .eq('id', user.id)
      .single()

    if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    // Conocimiento de la empresa como contexto
    const { data: conocimientos } = await supabase
      .from('conocimiento')
      .select('modulo, bloque, titulo, contenido')
      .eq('empresa_id', usuario.empresa_id)

    const contextoEmpresa = (conocimientos ?? [])
      .map(k => `## ${k.titulo}\n${k.contenido}`)
      .join('\n\n')

    // Historial de la conversación
    let historial: { role: 'user' | 'assistant'; content: string }[] = []
    let convId = conversacionId

    if (convId) {
      const { data: mensajes } = await supabase
        .from('mensajes_ia')
        .select('rol, contenido')
        .eq('conversacion_id', convId)
        .order('created_at', { ascending: true })
        .limit(20)

      historial = (mensajes ?? []).map(m => ({
        role: m.rol as 'user' | 'assistant',
        content: m.contenido,
      }))
    } else {
      // Crear nueva conversación
      const { data: nuevaConv } = await supabase
        .from('conversaciones_ia')
        .insert({ usuario_id: user.id, empresa_id: usuario.empresa_id })
        .select('id')
        .single()
      convId = nuevaConv?.id ?? null
    }

    // Guardar mensaje del usuario
    if (convId) {
      await supabase.from('mensajes_ia').insert({
        conversacion_id: convId,
        rol: 'user',
        contenido: mensaje,
      })
    }

    // System prompt con conocimiento de la empresa
    const systemPrompt = `Sos el asistente de onboarding de la empresa. Tu rol es ayudar a ${usuario.nombre}${usuario.puesto ? ` (${usuario.puesto})` : ''} a integrarse a la empresa respondiendo sus preguntas sobre cultura, procesos, herramientas y su rol.

Respondé siempre en español, de forma clara y concisa. Si la pregunta no está cubierta en el conocimiento disponible, decilo honestamente.

# Conocimiento de la empresa

${contextoEmpresa || 'No hay contenido cargado aún. Indicá al empleado que consulte con su manager.'}`

    // Streaming con Claude
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...historial,
        { role: 'user', content: mensaje },
      ],
    })

    // ReadableStream para el cliente
    let respuestaCompleta = ''
    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const chunk = event.delta.text
            respuestaCompleta += chunk
            controller.enqueue(encoder.encode(chunk))
          }
        }

        // Guardar respuesta del asistente
        if (convId && respuestaCompleta) {
          await supabase.from('mensajes_ia').insert({
            conversacion_id: convId,
            rol: 'assistant',
            contenido: respuestaCompleta,
          })

          // Marcar progreso M4
          await supabase.from('progreso_modulos').upsert({
            usuario_id: user.id,
            modulo: 'asistente',
            bloque: 'chat',
            completado: true,
            completado_at: new Date().toISOString(),
          }, { onConflict: 'usuario_id,modulo,bloque' })
        }

        // Enviar conversacionId al final (separador |--|)
        if (convId) {
          controller.enqueue(encoder.encode(`|--|${convId}`))
        }

        controller.close()
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
