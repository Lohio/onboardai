// botCore.ts — Lógica central del bot de Teams/GChat
// Usado por los endpoints /api/bot/gchat y /api/bot/teams
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

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

async function buildBotSystemPrompt(
  empresaId:    string,
  nombreEmpresa: string,
  plataforma:   'teams' | 'gchat'
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
Si no tenés la información, decilo honestamente: "No tengo esa información. Consultá con tu manager o buddy."`

  if (!bloques || bloques.length === 0) {
    return `${instrucciones}\n\nNo hay contenido cargado para esta empresa.`
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

  // 4. Cargar nombre de la empresa
  const { data: empresaData } = await supabase
    .from('empresas')
    .select('nombre')
    .eq('id', vinculacion.empresa_id)
    .maybeSingle()

  const nombreEmpresa = empresaData?.nombre ?? 'tu empresa'

  // 5. Construir system prompt con conocimiento de la empresa
  const systemPrompt = await buildBotSystemPrompt(
    vinculacion.empresa_id,
    nombreEmpresa,
    plataforma
  )

  // 6. Llamar a la Claude API
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001', // modelo rápido para el bot
    max_tokens: 512,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: mensaje }],
  })

  const respuesta = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')

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
