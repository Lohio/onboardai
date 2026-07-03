import { NextResponse } from 'next/server'
import { streamChat } from '@/lib/claude'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { agenteSchema } from '@/lib/schemas/empleado'
import { reservarConsultaIA, registrarUsoIA, MENSAJE_CUOTA_AGOTADA } from '@/lib/usoIA'
import { notificarUmbralCuotaIA } from '@/lib/emails/avisoCuotaIA'
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

    // ── Cuota mensual de consultas IA (por empresa, según plan) ───
    const { data: empresa } = await supabase!
      .from('empresas')
      .select('plan')
      .eq('id', usuario.empresa_id)
      .single()

    const cuota = await reservarConsultaIA(supabase!, usuario.empresa_id, empresa?.plan)
    if (!cuota.permitido) {
      return new NextResponse(MENSAJE_CUOTA_AGOTADA, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Cuota-Agotada': '1',
        },
      })
    }

    const diasOnboarding = usuario.fecha_ingreso
      ? Math.max(1, Math.ceil((Date.now() - new Date(usuario.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24)))
      : null

    // Contexto del empleado enriquecido con módulo actual.
    // El `contexto` libre del body NO entra acá: es texto controlado por el
    // cliente y no debe ir en el system prompt — va en el turno del usuario.
    const contextoEmpleado = [
      usuario.nombre ? `El empleado se llama ${usuario.nombre}.` : '',
      usuario.puesto ? `Su puesto es ${usuario.puesto}.` : '',
      diasOnboarding ? `Lleva ${diasOnboarding} día${diasOnboarding === 1 ? '' : 's'} en la empresa.` : '',
      modulo ? `Está actualmente en el módulo: ${modulo}.` : '',
    ].filter(Boolean).join(' ')

    // ── Streaming via streamChat ──────────────────────────────────
    // Las instrucciones del agente entran al prefijo estable (cacheado);
    // streamChat maneja el modo híbrido (tool de búsqueda en bases grandes).
    const mensajeConContexto = contexto?.trim()
      ? `[Contexto de la pantalla actual: ${contexto.trim()}]\n\n${mensaje}`
      : mensaje

    const mensajesCompletos: ChatMensaje[] = [
      ...historial,
      { role: 'user', content: mensajeConContexto },
    ]

    // Capturar referencias para uso dentro del ReadableStream
    const supabaseRef = supabase!
    const userId = user!.id
    const empresaId = usuario.empresa_id

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const tokenUsage = await streamChat({
            empresaId,
            contextoEmpleado,
            empleadoArea: usuario.area ?? null,
            empleadoPuesto: usuario.puesto ?? null,
            prefijoInstrucciones: INSTRUCCIONES_AGENTE,
            mensajes: mensajesCompletos,
            onChunk: (text) => controller.enqueue(encoder.encode(text)),
            onDone: () => {},
          })

          // ── Metering: registrar tokens (la consulta ya se contó en
          //    la reserva atómica) + avisos de umbral ─────────────
          await registrarUsoIA({
            supabase: supabaseRef,
            empresaId,
            usuarioId: userId,
            fuente: 'agente',
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
