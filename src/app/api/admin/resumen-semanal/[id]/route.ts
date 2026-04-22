import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/claude'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { ApiError } from '@/lib/errors'
import { logStreamError } from '@/lib/api-error'

export const POST = withHandler(
  {
    auth: 'session',
    rol: 'admin',
    streaming: true,
    rateLimit: RATE_LIMITS.reporte,
    bodyType: 'none',
  },
  async ({ supabase, user, params, requestId }) => {
    const empleadoId = params.id
    const capturedRequestId = requestId

    // Cargar datos del empleado
    const [empleadoRes, progresoRes, tareasRes, culturaCntRes, encuestasRes] = await Promise.all([
      supabase
        .from('usuarios')
        .select('nombre, puesto, area, fecha_ingreso, empresa_id')
        .eq('id', empleadoId)
        .single(),
      supabase
        .from('progreso_modulos')
        .select('modulo, bloque, completado')
        .eq('usuario_id', empleadoId),
      supabase
        .from('tareas_onboarding')
        .select('titulo, semana, completada')
        .eq('usuario_id', empleadoId),
      supabase
        .from('conocimiento')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', user!.empresaId)
        .eq('modulo', 'cultura'),
      supabase
        .from('encuestas_pulso')
        .select('dia_onboarding, respuesta_1, respuesta_2, respuesta_3, comentario, completada')
        .eq('usuario_id', empleadoId)
        .eq('completada', true)
        .order('dia_onboarding', { ascending: true }),
    ])

    const empleado = empleadoRes.data
    if (!empleado) return ApiError.notFound('Empleado')
    if (empleado.empresa_id !== user!.empresaId) return ApiError.forbidden()

    // Últimas preguntas al asistente IA
    let ultimasPreguntas: string[] = []
    try {
      const { data: convs } = await supabase
        .from('conversaciones_ia')
        .select('id')
        .eq('usuario_id', empleadoId)
        .order('updated_at', { ascending: false })
        .limit(5)

      if (convs && convs.length > 0) {
        const convIds = convs.map(c => c.id)
        const { data: msgs } = await supabase
          .from('mensajes_ia')
          .select('contenido, role')
          .in('conversacion_id', convIds)
          .eq('role', 'user')
          .order('created_at', { ascending: false })
          .limit(5)
        ultimasPreguntas = (msgs ?? []).map(m => `- ${m.contenido}`)
      }
    } catch {
      // tabla no existe todavía
    }

    // Calcular métricas
    const dias = empleado.fecha_ingreso
      ? Math.ceil((Date.now() - new Date(empleado.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24))
      : 0

    const progresoRows = progresoRes.data ?? []
    const totalBloquesCultura = culturaCntRes.count ?? 0
    const pctCultura =
      totalBloquesCultura > 0
        ? Math.round(
            (progresoRows.filter(p => p.modulo === 'cultura' && p.completado).length /
              totalBloquesCultura) *
              100
          )
        : 0
    const bloqueRolTotal = progresoRows.filter(p => p.modulo === 'rol').length
    const pctRol =
      bloqueRolTotal > 0
        ? Math.round(
            (progresoRows.filter(p => p.modulo === 'rol' && p.completado).length / bloqueRolTotal) * 100
          )
        : 0

    const tareas = tareasRes.data ?? []
    const tareasCompletadas = tareas.filter(t => t.completada).length

    // Tareas pendientes de la semana actual (y la anterior)
    const semanaActual = Math.max(1, Math.ceil(dias / 7))
    const tareasPendientesSemana = tareas
      .filter(t => !t.completada && (t.semana === semanaActual || t.semana === semanaActual - 1))
      .map(t => `- ${t.titulo} (semana ${t.semana})`)

    // Encuestas de pulso completadas
    const encuestas = encuestasRes.data ?? []
    const encuestasResumen = encuestas.length > 0
      ? encuestas
          .map(e => {
            const prom = ((e.respuesta_1 + e.respuesta_2 + e.respuesta_3) / 3).toFixed(1)
            const coment = e.comentario ? ` — comentario: "${e.comentario.slice(0, 120)}"` : ''
            return `  - Día ${e.dia_onboarding}: promedio ${prom}/5${coment}`
          })
          .join('\n')
      : ''

    // Prompt orientado a resumen semanal
    const prompt = `Sos un asistente de RRHH. Generá un RESUMEN SEMANAL corto sobre el estado de onboarding de un empleado, para que su manager lo lea en 10 segundos antes de un 1:1.

DATOS DEL EMPLEADO:
- Nombre: ${empleado.nombre}
- Puesto: ${empleado.puesto ?? 'No especificado'}
- Días en la empresa: ${dias}
- Progreso módulo Cultura: ${pctCultura}%
- Progreso módulo Rol: ${pctRol}%
- Tareas completadas: ${tareasCompletadas} de ${tareas.length}
- Tareas pendientes esta semana:
${tareasPendientesSemana.join('\n') || '  Ninguna'}
- Encuestas de pulso completadas:
${encuestasResumen || '  Aún sin encuestas completadas'}
- Últimas preguntas al asistente IA (señales de lo que le preocupa):
${ultimasPreguntas.join('\n') || '  Sin preguntas registradas'}

Generá UN SOLO PÁRRAFO de 120-180 palabras, en español rioplatense, tono profesional y cercano.

Estructura del párrafo (sin títulos ni viñetas, todo corrido):
1. Frase inicial con días de onboarding + avance general.
2. Qué está avanzando bien (tareas, módulos).
3. Qué señales de atención aparecen (pulso bajo, preguntas recurrentes, tareas trabadas).
4. Una recomendación concreta para el manager ("sugerimos que...").

Importante:
- NO uses encabezados, NO uses viñetas, NO uses markdown. Solo texto plano corrido.
- Sé específico con números y nombres de tareas/módulos cuando sea relevante.
- Si no hay datos suficientes (ej: empleado con <3 días), decilo honestamente en vez de inventar.`

    // Streaming
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const msgStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 512,
            messages: [{ role: 'user', content: prompt }],
          })

          for await (const event of msgStream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
        } catch (err) {
          logStreamError('admin/resumen-semanal', err, capturedRequestId)
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  }
)
