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
  /**
   * Información contextual del empleado que chatea (nombre, puesto, días de onboarding).
   * Se inyecta al final del system prompt para personalizar las respuestas.
   */
  contextoEmpleado?: string
  onChunk: (text: string) => void
  onDone: () => void
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
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
  systemPromptInstrucciones: string
  claudeModel: string
  maxTokens: number
}

// Fallback hardcodeado — solo se usa si app_config no es accesible.
// En condiciones normales, las instrucciones vienen de la DB.
const INSTRUCCIONES_FALLBACK = `Sos el asistente de onboarding de esta empresa. Tu rol es ayudar a los nuevos empleados a integrarse, respondiendo preguntas sobre cultura organizacional, procesos, herramientas y su rol.

Reglas de comportamiento:
- Responder SIEMPRE en español, con tono amigable y profesional
- Ser conciso; evitar respuestas extensas si no son necesarias
- Si la pregunta no está cubierta en el conocimiento disponible, decirlo honestamente: "No tengo esa información. Te recomiendo consultarlo con tu manager o buddy." — nunca inventar datos
- No hacer suposiciones sobre información que no está en el contexto
- Cuando sea útil, indicar el módulo o sección de donde proviene la información`

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
      .select('clave, valor')
      .in('clave', [
        'system_prompt_base',
        'system_prompt_instrucciones',
        'claude_model',
        'max_tokens',
      ])

    if (error) throw error

    const map: Record<string, string> = {}
    for (const row of (data ?? [])) map[row.clave] = row.valor ?? ''

    return {
      systemPromptBase: map['system_prompt_base'] ?? '',
      systemPromptInstrucciones: map['system_prompt_instrucciones'] ?? INSTRUCCIONES_FALLBACK,
      claudeModel: map['claude_model'] || 'claude-sonnet-4-6',
      maxTokens: Math.max(256, parseInt(map['max_tokens'] ?? '1024', 10) || 1024),
    }
  } catch {
    return {
      systemPromptBase: '',
      systemPromptInstrucciones: INSTRUCCIONES_FALLBACK,
      claudeModel: 'claude-sonnet-4-6',
      maxTokens: 1024,
    }
  }
}

// ─────────────────────────────────────────────
// buildSystemPromptWithConfig
// Construye el system prompt y devuelve también la config
// para evitar una segunda query a app_config en streamChat.
// ─────────────────────────────────────────────

interface SystemPromptResult {
  systemPrompt: string
  config: ResolvedConfig
}

export async function buildSystemPromptWithConfig(
  empresaId: string,
  contextoEmpleado?: string
): Promise<SystemPromptResult> {
  const supabase = createClient()

  // Cargar conocimiento, config global y prompt de empresa en paralelo
  const [{ data: bloques }, config, { data: empresa }] = await Promise.all([
    supabase
      .from('conocimiento')
      .select('modulo, bloque, titulo, contenido')
      .eq('empresa_id', empresaId)
      .order('modulo', { ascending: true })
      .order('bloque', { ascending: true }),
    getAppConfig(),
    supabase
      .from('empresas')
      .select('prompt_personalizado')
      .eq('id', empresaId)
      .single(),
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

  // ── Ensamblar el prompt final ─────────────────────────────────
  // Orden: base global (dev) → instrucciones (dev, editables) →
  //        personalización empresa (admin) → conocimiento → contexto empleado
  const partes: string[] = []

  if (config.systemPromptBase.trim()) {
    partes.push(config.systemPromptBase.trim())
  }

  partes.push(config.systemPromptInstrucciones.trim())

  // Personalización por empresa (override del admin)
  const promptEmpresa = empresa?.prompt_personalizado?.trim()
  if (promptEmpresa) {
    partes.push(`# Instrucciones específicas de esta empresa\n\n${promptEmpresa}`)
  }

  partes.push(`# Conocimiento de la empresa\n\n${seccionesConocimiento}`)

  if (contextoEmpleado?.trim()) {
    partes.push(`# Contexto del empleado\n\n${contextoEmpleado.trim()}`)
  }

  return { systemPrompt: partes.join('\n\n'), config }
}

/**
 * @deprecated Usar buildSystemPromptWithConfig para evitar doble query a app_config.
 * Se mantiene por compatibilidad con código externo.
 */
export async function buildSystemPrompt(empresaId: string): Promise<string> {
  const { systemPrompt } = await buildSystemPromptWithConfig(empresaId)
  return systemPrompt
}

// ─────────────────────────────────────────────
// streamChat
// Hace streaming real con la Claude API usando el contexto de la empresa.
// Lanza errores para que el caller los catchee.
// ─────────────────────────────────────────────

export async function streamChat({
  empresaId,
  contextoEmpleado,
  mensajes,
  onChunk,
  onDone,
}: StreamChatParams): Promise<TokenUsage> {
  // buildSystemPromptWithConfig devuelve el prompt Y la config en una sola llamada
  // (evita la doble query a app_config que existía antes)
  const { systemPrompt, config } = await buildSystemPromptWithConfig(empresaId, contextoEmpleado)

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

  // Capturar uso de tokens del mensaje final
  const finalMsg = await stream.finalMessage()
  const usage: TokenUsage = {
    inputTokens: finalMsg.usage.input_tokens,
    outputTokens: finalMsg.usage.output_tokens,
  }

  onDone()
  return usage
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
