import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/claude'
import { withHandler } from '@/lib/api/withHandler'
import { RATE_LIMITS } from '@/lib/api/withRateLimit'
import { ApiError } from '@/lib/errors'

export const POST = withHandler(
  {
    auth: 'session',
    rol: 'admin',
    streaming: true,
    rateLimit: RATE_LIMITS.reporte,
    bodyType: 'none',
  },
  async ({ supabase, user, params }) => {
    const empleadoId = params.id

  // 2. Cargar datos del empleado
  const [empleadoRes, progresoRes, tareasRes, culturaCntRes] = await Promise.all([
    supabase
      .from('usuarios')
      .select('nombre, puesto, area, fecha_ingreso')
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
  ])

  const empleado = empleadoRes.data
  if (!empleado) return ApiError.notFound('Empleado')

  // Obtener últimas preguntas al asistente IA (tabla puede no existir aún)
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

  // 3. Calcular métricas
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
  const pctRol = progresoRows.some(p => p.modulo === 'rol' && p.completado) ? 100 : 0

  const tareas = tareasRes.data ?? []
  const tareasCompletadas = tareas.filter(t => t.completada).length
  const tareasPendientes = tareas
    .filter(t => !t.completada)
    .map(t => `- ${t.titulo} (semana ${t.semana})`)

  // 4. Construir prompt
  const prompt = `Sos un asistente de RRHH. Generá un reporte ejecutivo del proceso de onboarding.

DATOS DEL EMPLEADO:
- Nombre: ${empleado.nombre}
- Puesto: ${empleado.puesto ?? 'No especificado'}
- Área: ${empleado.area ?? 'No especificada'}
- Días en la empresa: ${dias}
- Progreso módulo Cultura: ${pctCultura}%
- Progreso módulo Rol: ${pctRol}%
- Tareas completadas: ${tareasCompletadas} de ${tareas.length}
- Tareas pendientes:
${tareasPendientes.join('\n') || '  Ninguna'}
- Últimas preguntas al asistente IA:
${ultimasPreguntas.join('\n') || '  Sin preguntas registradas'}

Generá el reporte con estas secciones exactas (usá ## como encabezado de cada una):
## Resumen Ejecutivo
## Avances Destacados
## Áreas de Atención
## Recomendaciones

Extensión: 300-400 palabras. Idioma: español rioplatense. Tono: profesional pero cercano.`

  // 5. Streamear respuesta
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const msgStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
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
