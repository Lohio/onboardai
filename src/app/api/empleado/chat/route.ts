import { NextResponse } from 'next/server'
import { streamChat, logMensaje } from '@/lib/claude'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { chatSchema } from '@/lib/schemas/empleado'
import { logStreamError } from '@/lib/api-error'
import { reservarConsultaIA, registrarUsoIA, MENSAJE_CUOTA_AGOTADA } from '@/lib/usoIA'
import { notificarUmbralCuotaIA } from '@/lib/emails/avisoCuotaIA'

// ─────────────────────────────────────────────
// POST /api/empleado/chat
// Chat con el asistente IA (streaming).
// Rate limiting gestionado por withHandler (RATE_LIMITS.chat).
// ─────────────────────────────────────────────

export const POST = withHandler(
  {
    auth: 'session',
    rol: 'empleado',
    schema: chatSchema,
    streaming: true,
    rateLimit: RATE_LIMITS.chat,
  },
  async ({ body, supabase, user, requestId }) => {
    const { mensaje, conversacionId } = body

    // ── Datos del empleado (+ plan de la empresa via join), ownership de la
    //    conversación e historial: independientes entre sí → en paralelo ──
    const [{ data: usuario }, { data: conv }, { data: mensajesHistorial }] = await Promise.all([
      supabase!
        .from('usuarios')
        .select('nombre, puesto, area, empresa_id, fecha_ingreso, notas_ia, empresas(plan)')
        .eq('id', user!.id)
        .single(),
      // Verificar ownership antes de usar la conversación
      conversacionId
        ? supabase!
            .from('conversaciones_ia')
            .select('id')
            .eq('id', conversacionId)
            .eq('usuario_id', user!.id)
            .single()
        : Promise.resolve({ data: null }),
      // Historial existente: los 20 MÁS RECIENTES (desc + limit) y luego
      // invertir para mantener el orden cronológico que espera Claude.
      // Con asc+limit se traían los 20 más viejos y el modelo perdía los turnos recientes.
      conversacionId
        ? supabase!
            .from('mensajes_ia')
            .select('rol, contenido')
            .eq('conversacion_id', conversacionId)
            .order('created_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: null }),
    ])

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const { empresa_id: empresaId } = usuario
    // El join puede venir como objeto o como array según la FK detectada
    const empresa = Array.isArray(usuario.empresas) ? usuario.empresas[0] : usuario.empresas

    // ── Cuota mensual de consultas IA (por empresa, según plan) ───
    // Reserva atómica: DEBE ocurrir antes de llamar a Claude
    const cuota = await reservarConsultaIA(supabase!, empresaId, empresa?.plan)
    if (!cuota.permitido) {
      // Responder como mensaje normal del asistente para no romper la UX del chat
      return new NextResponse(MENSAJE_CUOTA_AGOTADA, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Cuota-Agotada': '1',
        },
      })
    }

    // ── Gestión de conversación ───────────────────────────────────
    // Si la conversación no es del usuario se descarta (sin crear una nueva)
    const convValida = Boolean(conversacionId && conv)
    let convId: string | null = convValida ? conversacionId! : null

    const historial: { role: 'user' | 'assistant'; content: string }[] = convValida
      ? (mensajesHistorial ?? []).reverse().map(m => ({
          role: m.rol as 'user' | 'assistant',
          content: m.contenido,
        }))
      : []

    if (!conversacionId) {
      // Crear nueva conversación
      const { data: nuevaConv } = await supabase!
        .from('conversaciones_ia')
        .insert({ usuario_id: user!.id, empresa_id: empresaId })
        .select('id')
        .single()
      convId = nuevaConv?.id ?? null
    }

    // Guardar mensaje del usuario en el historial persistente — no bloquea
    // el stream; se espera antes de insertar la respuesta del asistente para
    // preservar el orden created_at (user → assistant) del historial.
    const guardarMensajeUsuario: PromiseLike<void> = convId
      ? supabase!
          .from('mensajes_ia')
          .insert({ conversacion_id: convId, rol: 'user', contenido: mensaje })
          .then(
            ({ error }) => {
              if (error) console.warn('[chat] No se pudo guardar el mensaje del usuario:', error.message)
            },
            (err: unknown) => console.warn('[chat] No se pudo guardar el mensaje del usuario:', err),
          )
      : Promise.resolve()

    // Log de auditoría (mensajes_chat) — fire and forget
    logMensaje({ usuarioId: user!.id, empresaId, rol: 'user', contenido: mensaje })

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
      usuario.notas_ia?.trim() ? `Notas del manager para este empleado: ${usuario.notas_ia.trim()}` : '',
    ].filter(Boolean).join(' ')

    // Capturar referencias para uso dentro del ReadableStream
    const supabaseRef = supabase!
    const userId = user!.id
    const capturedRequestId = requestId

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        try {
          const tokenUsage = await streamChat({
            empresaId,
            contextoEmpleado,
            empleadoArea: usuario.area ?? null,
            empleadoPuesto: usuario.puesto ?? null,
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
            // Asegurar que el mensaje del usuario quedó antes (orden created_at)
            await guardarMensajeUsuario

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

            // Registro de uso de tokens (solo en desarrollo)
            if (process.env.NODE_ENV !== 'production') {
              console.log('[chat:tokens]', {
                input: tokenUsage.inputTokens,
                output: tokenUsage.outputTokens,
                cacheRead: tokenUsage.cacheReadTokens,
                cacheCreation: tokenUsage.cacheCreationTokens,
              })
            }
          }

          // ── Metering: registrar tokens (la consulta ya se contó en
          //    la reserva atómica) + avisos de umbral ─────────────
          await registrarUsoIA({
            supabase: supabaseRef,
            empresaId,
            usuarioId: userId,
            fuente: 'chat',
            modelo: tokenUsage.modelo,
            inputTokens: tokenUsage.inputTokens,
            outputTokens: tokenUsage.outputTokens,
            cacheReadTokens: tokenUsage.cacheReadTokens,
            cacheCreationTokens: tokenUsage.cacheCreationTokens,
            cuentaConsulta: false,
          })
          notificarUmbralCuotaIA({
            supabase: supabaseRef,
            empresaId,
            usadas: cuota.usadas,
            limite: cuota.limite,
          })


        } catch (err) {
          logStreamError('chat-stream', err, capturedRequestId)
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
