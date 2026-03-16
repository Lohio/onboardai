import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// Singleton del cliente Anthropic
// Solo usar en Server Components y API routes
// ─────────────────────────────────────────────

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ─────────────────────────────────────────────
// Tipos exportados
// ─────────────────────────────────────────────

export interface ChatMensaje {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamChatParams {
  empresaId: string
  /** Historial completo, ya incluye el último mensaje del usuario */
  mensajes: ChatMensaje[]
  onChunk: (text: string) => void
  onDone: () => void
}

export interface LogMensajeParams {
  usuarioId: string
  empresaId: string
  rol: 'user' | 'assistant'
  contenido: string
}

// ─────────────────────────────────────────────
// Tipo interno para la config leída de Supabase
// ─────────────────────────────────────────────

interface ResolvedConfig {
  systemPromptBase: string
  claudeModel: string
  maxTokens: number
}

// ─────────────────────────────────────────────
// getAppConfig
// Lee model, max_tokens y system_prompt_base de app_config.
// Si la tabla no existe o hay un error de RLS, retorna defaults.
// ─────────────────────────────────────────────

async function getAppConfig(): Promise<ResolvedConfig> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['system_prompt_base', 'claude_model', 'max_tokens'])

    if (error) throw error

    const map: Record<string, string> = {}
    for (const row of (data ?? [])) map[row.key] = row.value ?? ''

    return {
      systemPromptBase: map['system_prompt_base'] ?? '',
      claudeModel: map['claude_model'] || 'claude-sonnet-4-6',
      maxTokens: Math.max(256, parseInt(map['max_tokens'] ?? '1024', 10) || 1024),
    }
  } catch {
    // La tabla app_config no existe o no es accesible → defaults seguros
    return {
      systemPromptBase: '',
      claudeModel: 'claude-sonnet-4-6',
      maxTokens: 1024,
    }
  }
}

// ─────────────────────────────────────────────
// buildSystemPrompt
// Construye el system prompt para el asistente de onboarding
// combinando: base de app_config + instrucciones fijas + conocimiento de la empresa
// ─────────────────────────────────────────────

export async function buildSystemPrompt(empresaId: string): Promise<string> {
  const supabase = createClient()

  // Cargar conocimiento y config en paralelo
  const [{ data: bloques }, config] = await Promise.all([
    supabase
      .from('conocimiento')
      .select('modulo, bloque, titulo, contenido')
      .eq('empresa_id', empresaId)
      .order('modulo', { ascending: true })
      .order('bloque',  { ascending: true }),
    getAppConfig(),
  ])

  // ── Organizar bloques por módulo ──────────────────────────────
  const porModulo: Record<string, { titulo: string; contenido: string }[]> = {}
  for (const item of (bloques ?? [])) {
    if (!porModulo[item.modulo]) porModulo[item.modulo] = []
    porModulo[item.modulo].push({ titulo: item.titulo, contenido: item.contenido })
  }

  const seccionesConocimiento =
    Object.keys(porModulo).length > 0
      ? Object.entries(porModulo)
          .map(([modulo, items]) => {
            const cuerpo = items
              .map(i => `### ${i.titulo}\n${i.contenido.trim()}`)
              .join('\n\n')
            return `## ${modulo.charAt(0).toUpperCase() + modulo.slice(1)}\n\n${cuerpo}`
          })
          .join('\n\n---\n\n')
      : 'No hay contenido cargado para esta empresa. Indicá al empleado que consulte con su manager o buddy.'

  // ── Instrucciones base del asistente ─────────────────────────
  const instrucciones = `Sos el asistente de onboarding de esta empresa. Tu rol es ayudar a los nuevos empleados a integrarse, respondiendo preguntas sobre cultura organizacional, procesos, herramientas y su rol.

Reglas de comportamiento:
- Responder SIEMPRE en español, con tono amigable y profesional
- Ser conciso; evitar respuestas extensas si no son necesarias
- Si la pregunta no está cubierta en el conocimiento disponible, decirlo honestamente: "No tengo esa información. Te recomiendo consultarlo con tu manager o buddy." — nunca inventar datos
- No hacer suposiciones sobre información que no está en el contexto
- Cuando sea útil, indicar el módulo o sección de donde proviene la información`

  // ── Ensamblar el prompt final ─────────────────────────────────
  // Orden: base personalizable (dev) → instrucciones fijas → conocimiento
  const partes: string[] = []

  if (config.systemPromptBase.trim()) {
    partes.push(config.systemPromptBase.trim())
  }

  partes.push(instrucciones)
  partes.push(`# Conocimiento de la empresa\n\n${seccionesConocimiento}`)

  return partes.join('\n\n')
}

// ─────────────────────────────────────────────
// streamChat
// Hace streaming real con la Claude API usando el contexto de la empresa.
// Lanza errores para que el caller los catchee.
// ─────────────────────────────────────────────

export async function streamChat({
  empresaId,
  mensajes,
  onChunk,
  onDone,
}: StreamChatParams): Promise<void> {
  // Construir contexto y leer config en paralelo
  const [systemPrompt, config] = await Promise.all([
    buildSystemPrompt(empresaId),
    getAppConfig(),
  ])

  const stream = anthropic.messages.stream({
    model: config.claudeModel,
    max_tokens: config.maxTokens,
    system: systemPrompt,
    messages: mensajes,
  })

  // Iterar eventos del stream y notificar cada fragmento de texto
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      onChunk(event.delta.text)
    }
  }

  onDone()
  // Los errores del stream se propagan naturalmente al caller
}

// ─────────────────────────────────────────────
// logMensaje
// Guarda un mensaje en la tabla mensajes_chat para auditoría.
// El log es fire-and-forget: nunca bloquea ni lanza errores al flujo principal.
// ─────────────────────────────────────────────

export async function logMensaje({
  usuarioId,
  empresaId,
  rol,
  contenido,
}: LogMensajeParams): Promise<void> {
  try {
    const supabase = createClient()
    await supabase.from('mensajes_chat').insert({
      usuario_id: usuarioId,
      empresa_id: empresaId,
      rol,
      contenido,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Silencioso: el log nunca debe interrumpir el flujo de chat
  }
}
