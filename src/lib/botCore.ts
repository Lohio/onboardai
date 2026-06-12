// botCore.ts — Lógica central del bot de Teams/GChat
// Usado por los endpoints /api/bot/gchat y /api/bot/teams
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { verificarCuotaIA, registrarUsoIA, MENSAJE_CUOTA_AGOTADA } from '@/lib/usoIA'
import { notificarUmbralCuotaIA } from '@/lib/emails/avisoCuotaIA'

// Modelo rápido y económico para respuestas async del bot
const BOT_MODEL = 'claude-haiku-4-5-20251001'

// Cliente con service role para el bot — bypasea RLS en lectura cross-empresa
function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export interface BotInput {
  chatUserId: string
  chatEmail:  string | null
  plataforma: 'teams' | 'gchat'
  mensaje:    string
}

export interface BotOutput {
  respuesta:   string
  linkWebApp:  { texto: string; url: string } | null
}

// ─────────────────────────────────────────────
// Palabras clave que disparan redirección a la web app
// ─────────────────────────────────────────────

const PALABRAS_REDIRECCION = [
  'modulo', 'módulo', 'cultura', 'perfil', 'progreso',
  'accesos', 'herramientas', 'encuesta', 'completar', 'ver mi',
  'rol', 'tarea', 'tareas', 'quiz',
]

// Mapa de palabras clave → ruta de la web app
function resolverUrl(mensaje: string): string {
  const lower = mensaje.toLowerCase()
  if (lower.includes('cultura'))                                  return '/empleado/cultura'
  if (lower.includes('perfil'))                                   return '/empleado/perfil'
  if (lower.includes('rol') || lower.includes('herramienta') ||
      lower.includes('tarea'))                                    return '/empleado/rol'
  return '/empleado/perfil'
}

function requiereRedireccion(mensaje: string): boolean {
  const lower = mensaje.toLowerCase()
  return PALABRAS_REDIRECCION.some(kw => lower.includes(kw))
}

// ─────────────────────────────────────────────
// Carga del conocimiento de la empresa
// (análogo a buildSystemPromptWithConfig en claude.ts pero
//  adaptado para texto plano sin markdown complejo)
// ─────────────────────────────────────────────

// Umbral del modo híbrido del bot (~30k tokens ≈ 105k chars):
// si el conocimiento es más grande, se busca por FTS con el mensaje
// del usuario y se inyectan solo los bloques relevantes.
const UMBRAL_CHARS_INLINE_BOT = 105_000

async function buildBotSystemPrompt(
  empresaId:    string,
  nombreEmpresa: string,
  plataforma:   'teams' | 'gchat',
  mensaje:      string,
): Promise<string> {
  const supabase = getAdminClient()

  const { data: bloques } = await supabase
    .from('conocimiento')
    .select('modulo, titulo, contenido')
    .eq('empresa_id', empresaId)
    .order('modulo', { ascending: true })

  const plataformaNombre = plataforma === 'teams' ? 'Microsoft Teams' : 'Google Chat'

  // Instrucciones específicas del bot (texto plano, sin markdown complejo)
  const instrucciones = `Sos el asistente de onboarding de ${nombreEmpresa} en ${plataformaNombre}.
Respondé preguntas sobre RRHH, cultura y procesos en máximo 3 párrafos cortos.
Usá formato de texto plano sin markdown complejo (Teams y GChat no renderizan todo el markdown).
Si el empleado necesita completar algo en la plataforma de onboarding, indicalo claramente.
Sé directo y conciso. Respondé siempre en español.
Respondé únicamente con base en el conocimiento provisto. Si no tenés la información, decilo honestamente: "No tengo esa información. Consultá con tu manager o buddy."`

  if (!bloques || bloques.length === 0) {
    return `${instrucciones}\n\nNo hay contenido cargado para esta empresa.`
  }

  const totalChars = bloques.reduce((acc, b) => acc + b.contenido.length, 0)

  // Base grande → recuperar solo los bloques relevantes via FTS
  // (el bot es de un solo turno: buscar con el mensaje del usuario alcanza)
  if (totalChars > UMBRAL_CHARS_INLINE_BOT) {
    const { data: relevantes, error } = await supabase.rpc('buscar_conocimiento', {
      p_empresa_id: empresaId,
      p_query: mensaje,
      p_limit: 5,
    })

    if (!error && relevantes && relevantes.length > 0) {
      const filas = relevantes as { modulo: string; titulo: string; contenido: string }[]
      const conocimiento = filas
        .map(b => `[${b.modulo.toUpperCase()}] ${b.titulo}: ${b.contenido.trim()}`)
        .join('\n\n')
      return `${instrucciones}\n\nCONOCIMIENTO RELEVANTE DE LA EMPRESA (resultados de búsqueda):\n${conocimiento}`
    }
    // Sin resultados o sin migración FTS: caer al inline completo (warn)
    if (error) console.warn('[botCore] buscar_conocimiento falló, usando inline:', error.message)
  }

  // Agrupar por módulo en texto plano
  const porModulo: Record<string, string[]> = {}
  for (const b of bloques) {
    if (!porModulo[b.modulo]) porModulo[b.modulo] = []
    porModulo[b.modulo].push(`${b.titulo}: ${b.contenido.trim()}`)
  }

  const conocimiento = Object.entries(porModulo)
    .map(([mod, items]) => `[${mod.toUpperCase()}]\n${items.join('\n')}`)
    .join('\n\n')

  return `${instrucciones}\n\nCONOCIMIENTO DE LA EMPRESA:\n${conocimiento}`
}

// ─────────────────────────────────────────────
// procesarMensajeBot — función principal
// ─────────────────────────────────────────────

export async function procesarMensajeBot(input: BotInput): Promise<BotOutput> {
  const { chatUserId, chatEmail, plataforma, mensaje } = input
  const supabase = getAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://heero.app'

  // 1. Buscar vinculación por chatUserId + plataforma
  let vinculacion: { usuario_id: string; empresa_id: string } | null = null

  const { data: vinPorId } = await supabase
    .from('bot_vinculaciones')
    .select('usuario_id, empresa_id')
    .eq('chat_user_id', chatUserId)
    .eq('plataforma', plataforma)
    .maybeSingle()

  vinculacion = vinPorId

  // 2. Si no hay vinculación por ID, intentar por email en tabla usuarios
  if (!vinculacion && chatEmail) {
    const { data: usuarioPorEmail } = await supabase
      .from('usuarios')
      .select('id, empresa_id')
      .eq('email', chatEmail.toLowerCase())
      .maybeSingle()

    if (usuarioPorEmail) {
      // Crear vinculación automática
      await supabase.from('bot_vinculaciones').upsert({
        usuario_id:   usuarioPorEmail.id,
        empresa_id:   usuarioPorEmail.empresa_id,
        plataforma,
        chat_user_id: chatUserId,
        chat_email:   chatEmail.toLowerCase(),
      }, { onConflict: 'plataforma,chat_user_id' })

      vinculacion = {
        usuario_id: usuarioPorEmail.id,
        empresa_id: usuarioPorEmail.empresa_id,
      }
    }
  }

  // 3. Sin cuenta vinculada → responder con link de vinculación
  if (!vinculacion) {
    return {
      respuesta: `No encontré tu cuenta en Heero. Ingresá a la plataforma para vincular tu perfil:\n${appUrl}/empleado/perfil`,
      linkWebApp: {
        texto: 'Vincular mi cuenta en Heero',
        url:   `${appUrl}/empleado/perfil`,
      },
    }
  }

  // 4. Cargar nombre y plan de la empresa
  const { data: empresaData } = await supabase
    .from('empresas')
    .select('nombre, plan')
    .eq('id', vinculacion.empresa_id)
    .maybeSingle()

  const nombreEmpresa = empresaData?.nombre ?? 'tu empresa'

  // 4b. Cuota mensual de consultas IA (por empresa, según plan)
  const cuota = await verificarCuotaIA(supabase, vinculacion.empresa_id, empresaData?.plan)
  if (!cuota.permitido) {
    return {
      respuesta: MENSAJE_CUOTA_AGOTADA,
      linkWebApp: null,
    }
  }

  // 5. Construir system prompt con conocimiento de la empresa
  const systemPrompt = await buildBotSystemPrompt(
    vinculacion.empresa_id,
    nombreEmpresa,
    plataforma,
    mensaje
  )

  // 6. Llamar a la Claude API
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // El system prompt del bot es estable por empresa+plataforma →
  // breakpoint de cache para abaratar mensajes repetidos del equipo
  const response = await anthropic.messages.create({
    model:      BOT_MODEL,
    max_tokens: 512,
    system:     [{
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' },
    }],
    messages:   [{ role: 'user', content: mensaje }],
  })

  const respuesta = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')

  // Metering: registrar consumo + avisos de umbral (fire-and-forget)
  await registrarUsoIA({
    supabase,
    empresaId: vinculacion.empresa_id,
    usuarioId: vinculacion.usuario_id,
    fuente: 'bot',
    modelo: BOT_MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
  })
  notificarUmbralCuotaIA({
    supabase,
    empresaId: vinculacion.empresa_id,
    usadas: cuota.usadas + 1,
    limite: cuota.limite,
  })

  // 7. Determinar si requiere redirección
  const necesitaLink = requiereRedireccion(mensaje)
  const linkWebApp = necesitaLink
    ? {
        texto: 'Abrir en Heero',
        url:   `${appUrl}${resolverUrl(mensaje)}`,
      }
    : null

  return { respuesta, linkWebApp }
}
