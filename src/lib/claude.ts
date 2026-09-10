import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabaseService'

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
  /** Área del empleado — habilita capa de contenido específico de área */
  empleadoArea?: string | null
  /** Puesto del empleado — habilita capa de contenido específico de rol */
  empleadoPuesto?: string | null
  /** Instrucciones extra al inicio del prefijo estable (ej: modo agente) */
  prefijoInstrucciones?: string
  onChunk: (text: string) => void
  onDone: () => void
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  /** Modelo efectivamente usado (de app_config) — para registrar consumo */
  modelo: string
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

/** Metadata de un bloque de conocimiento (query liviana: índice + estimación de tamaño) */
interface BloqueIndice {
  modulo: string
  bloque: string
  titulo: string
  area?: string | null
  puesto?: string | null
  /** Columna generada por scripts/conocimiento_tokens.sql */
  tokens_estimados?: number | null
}

/** Fila completa de conocimiento usada para armar el prompt */
interface BloqueConocimiento extends BloqueIndice {
  contenido: string
  contenido_extraido?: string | null
}

// Fallback hardcodeado — solo se usa si app_config no es accesible.
// En condiciones normales, las instrucciones vienen de la DB.
const INSTRUCCIONES_FALLBACK = `Sos el asistente de onboarding de esta empresa. Tu rol es ayudar a los nuevos empleados a integrarse, respondiendo preguntas sobre cultura organizacional, procesos, herramientas y su rol.

Reglas de comportamiento:
- Responder SIEMPRE en español, con tono amigable y profesional
- Ser conciso; evitar respuestas extensas si no son necesarias
- Responder ÚNICAMENTE con base en el conocimiento provisto dentro de los tags <bloque>. Si la pregunta no está cubierta, decirlo honestamente: "No tengo esa información. Te recomiendo consultarlo con tu manager o buddy." — nunca inventar datos. Tu pregunta quedará registrada para que el equipo la responda y la sume al conocimiento.
- No hacer suposiciones sobre información que no está en el contexto
- Cuando sea útil, citar el título del bloque de donde proviene la información`

// ── Umbral del modo híbrido ──────────────────────────────────
// Si el conocimiento estimado supera este tamaño, en vez de inyectarlo
// completo se le da al modelo una tool de búsqueda full-text (FTS).
const UMBRAL_TOKENS_INLINE = 30_000

/** Estimación barata de tokens (~3.5 chars/token en español) */
function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 3.5)
}

/** Escapa comillas para atributos de los tags <bloque> */
function escaparAttr(valor: string): string {
  return valor.replace(/"/g, '&quot;')
}

/**
 * Neutraliza tags <bloque>/</bloque> dentro del cuerpo de un bloque para
 * que contenido subido por el admin (ej: texto extraído de un PDF) no pueda
 * cerrar el encuadre XML e inyectar instrucciones al asistente.
 */
function neutralizarDelimitadores(texto: string): string {
  return texto.replace(/<\s*\/?\s*bloque/gi, '&lt;bloque')
}

/** Renderiza un bloque de conocimiento con metadata estructurada */
function renderBloqueXML(b: {
  modulo: string
  titulo: string
  contenido: string
  contenido_extraido?: string | null
  area?: string | null
  puesto?: string | null
}): string {
  const attrs = [
    `modulo="${escaparAttr(b.modulo)}"`,
    `titulo="${escaparAttr(b.titulo)}"`,
    b.area ? `area="${escaparAttr(b.area)}"` : null,
    b.puesto ? `puesto="${escaparAttr(b.puesto)}"` : null,
  ].filter(Boolean).join(' ')

  const cuerpo = [
    b.contenido.trim(),
    b.contenido_extraido?.trim()
      ? `[Contenido del archivo adjunto]\n${b.contenido_extraido.trim()}`
      : null,
  ].filter(Boolean).join('\n\n')

  return `<bloque ${attrs}>\n${neutralizarDelimitadores(cuerpo)}\n</bloque>`
}

// ─────────────────────────────────────────────
// getAppConfig
// Lee model, max_tokens y system_prompt_base de app_config.
// Si la tabla no existe o hay un error de RLS, retorna defaults.
// Es config global: se memoiza en memoria del módulo con TTL de 60 s
// para no pagar un round-trip a Supabase en cada turno del chat.
// ─────────────────────────────────────────────

const APP_CONFIG_TTL_MS = 60_000
let appConfigCache: { valor: ResolvedConfig; expira: number } | null = null

async function getAppConfig(): Promise<ResolvedConfig> {
  if (appConfigCache && appConfigCache.expira > Date.now()) {
    return appConfigCache.valor
  }

  try {
    const supabase = createServiceClient()
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

    const valor: ResolvedConfig = {
      systemPromptBase: map['system_prompt_base'] ?? '',
      systemPromptInstrucciones: map['system_prompt_instrucciones'] ?? INSTRUCCIONES_FALLBACK,
      claudeModel: map['claude_model'] || 'claude-sonnet-4-6',
      maxTokens: Math.max(256, parseInt(map['max_tokens'] ?? '1024', 10) || 1024),
    }
    // Solo se cachea una lectura exitosa: el fallback se reintenta en cada turno
    appConfigCache = { valor, expira: Date.now() + APP_CONFIG_TTL_MS }
    return valor
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
  /** @deprecated Preferir systemBlocks (habilitan prompt caching) */
  systemPrompt: string
  /**
   * System prompt como bloques para la API: el prefijo estable
   * (instrucciones + conocimiento, compartido por empresa/área/puesto)
   * lleva cache_control; el contexto del empleado va después del
   * breakpoint para no invalidar el cache. NUNCA poner timestamps
   * ni IDs por-request en el bloque estable.
   */
  systemBlocks: Anthropic.TextBlockParam[]
  /**
   * 'inline': el conocimiento completo va en el prompt (cacheado).
   * 'busqueda': el conocimiento es grande — el prompt lleva solo un
   * índice y el modelo usa la tool buscar_conocimiento (FTS).
   */
  modoConocimiento: 'inline' | 'busqueda'
  config: ResolvedConfig
}

/**
 * Separa los bloques en las 3 capas que aplican al empleado.
 * Orden determinístico (modulo, bloque) heredado de la query — es lo que
 * hace que el prefijo cacheado sea idéntico entre requests.
 */
function filtrarCapas<T extends BloqueIndice>(
  bloques: T[],
  empleadoArea?: string | null,
  empleadoPuesto?: string | null,
): { empresaBloques: T[]; areaBloques: T[]; rolBloques: T[] } {
  return {
    // Capa 1: empresa (sin area ni puesto) — comportamiento original
    empresaBloques: bloques.filter(b => !b.area && !b.puesto),
    // Capa 2: área del empleado
    areaBloques: empleadoArea
      ? bloques.filter(b => b.area === empleadoArea && !b.puesto)
      : [],
    // Capa 3: puesto/rol del empleado
    rolBloques: empleadoPuesto
      ? bloques.filter(b => b.puesto === empleadoPuesto)
      : [],
  }
}

/**
 * Trae los bloques completos (contenido + contenido_extraido) de la empresa.
 * Fallback: la migración de contenido_extraido (conocimiento_fts.sql) puede
 * no estar ejecutada todavía — reintentar sin esa columna.
 */
async function cargarBloquesCompletos(
  supabase: ReturnType<typeof createServiceClient>,
  empresaId: string,
): Promise<BloqueConocimiento[]> {
  const { data, error } = await supabase
    .from('conocimiento')
    .select('modulo, bloque, titulo, contenido, contenido_extraido, area, puesto')
    .eq('empresa_id', empresaId)
    .order('modulo', { ascending: true })
    .order('bloque', { ascending: true })

  if (!error) return (data ?? []) as BloqueConocimiento[]

  console.warn('[claude] Query de conocimiento con contenido_extraido falló, reintentando:', error.message)
  const { data: basicos } = await supabase
    .from('conocimiento')
    .select('modulo, bloque, titulo, contenido, area, puesto')
    .eq('empresa_id', empresaId)
    .order('modulo', { ascending: true })
    .order('bloque', { ascending: true })
  return ((basicos ?? []) as BloqueConocimiento[]).map(b => ({ ...b, contenido_extraido: null }))
}

export async function buildSystemPromptWithConfig(
  empresaId: string,
  contextoEmpleado?: string,
  empleadoArea?: string | null,
  empleadoPuesto?: string | null,
  /** Instrucciones extra que entran al prefijo estable (ej: modo agente) */
  prefijoInstrucciones?: string,
): Promise<SystemPromptResult> {
  const supabase = createServiceClient()

  // Cargar índice de conocimiento (liviano: sin contenido), config global y
  // prompt de empresa en paralelo. El contenido completo solo se baja si el
  // conocimiento relevante entra inline — en modo búsqueda el índice alcanza.
  const [indiceRes, config, { data: empresa }] = await Promise.all([
    supabase
      .from('conocimiento')
      .select('modulo, bloque, titulo, area, puesto, tokens_estimados')
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

  // ── Modo híbrido por tamaño ───────────────────────────────────
  // Si el conocimiento relevante para este empleado supera el umbral,
  // en vez de inyectarlo completo se le da al modelo la tool de búsqueda.
  let modoConocimiento: 'inline' | 'busqueda'
  let indiceBloques: BloqueIndice[]
  let bloquesCompletos: BloqueConocimiento[] = []

  if (indiceRes.error) {
    // Fallback: la migración de tokens_estimados (conocimiento_tokens.sql)
    // puede no estar ejecutada — comportamiento anterior: traer todo y estimar
    console.warn('[claude] Query de índice con tokens_estimados falló, trayendo conocimiento completo:', indiceRes.error.message)
    bloquesCompletos = await cargarBloquesCompletos(supabase, empresaId)
    indiceBloques = bloquesCompletos

    const capas = filtrarCapas(bloquesCompletos, empleadoArea, empleadoPuesto)
    const textoConocimiento = [...capas.empresaBloques, ...capas.areaBloques, ...capas.rolBloques]
      .map(renderBloqueXML)
      .join('\n\n')
    modoConocimiento = estimarTokens(textoConocimiento) > UMBRAL_TOKENS_INLINE ? 'busqueda' : 'inline'
  } else {
    indiceBloques = (indiceRes.data ?? []) as BloqueIndice[]

    const capas = filtrarCapas(indiceBloques, empleadoArea, empleadoPuesto)
    const tokensRelevantes = [...capas.empresaBloques, ...capas.areaBloques, ...capas.rolBloques]
      .reduce((acc, b) => acc + (b.tokens_estimados ?? 0), 0)
    modoConocimiento = tokensRelevantes > UMBRAL_TOKENS_INLINE ? 'busqueda' : 'inline'

    if (modoConocimiento === 'inline') {
      bloquesCompletos = await cargarBloquesCompletos(supabase, empresaId)
    }
  }

  const { empresaBloques, areaBloques, rolBloques } = filtrarCapas(
    bloquesCompletos,
    empleadoArea,
    empleadoPuesto,
  )

  // ── Renderizar conocimiento con tags <bloque> (anti-alucinación) ──
  const seccionesEmpresa =
    empresaBloques.length > 0
      ? empresaBloques.map(renderBloqueXML).join('\n\n')
      : 'No hay contenido cargado para esta empresa. Indicá al empleado que consulte con su manager o buddy.'

  // ── Ensamblar el prompt final ─────────────────────────────────
  // Orden: [prefijo extra] → base global → instrucciones → personalización
  // empresa → conocimiento empresa → capa área → capa rol  (PREFIJO ESTABLE)
  // → contexto empleado  (VOLÁTIL, después del breakpoint de cache)
  const partesEstables: string[] = []

  if (prefijoInstrucciones?.trim()) {
    partesEstables.push(prefijoInstrucciones.trim())
  }

  if (config.systemPromptBase.trim()) {
    partesEstables.push(config.systemPromptBase.trim())
  }

  partesEstables.push(config.systemPromptInstrucciones.trim())

  const promptEmpresa = empresa?.prompt_personalizado?.trim()
  if (promptEmpresa) {
    partesEstables.push(`# Instrucciones específicas de esta empresa\n\n${promptEmpresa}`)
  }

  if (modoConocimiento === 'inline') {
    partesEstables.push(`# Conocimiento de la empresa\n\n${seccionesEmpresa}`)

    if (areaBloques.length > 0) {
      partesEstables.push(
        `# Información del área: ${empleadoArea}\n\n${areaBloques.map(renderBloqueXML).join('\n\n')}`
      )
    }

    if (rolBloques.length > 0) {
      partesEstables.push(
        `# Información del rol: ${empleadoPuesto}\n\n${rolBloques.map(renderBloqueXML).join('\n\n')}`
      )
    }
  } else {
    // Base de conocimiento grande: solo índice + tool de búsqueda.
    // El índice da contexto global sin pagar el contenido completo.
    const indice = indiceBloques
      .map(b => {
        const capas = [b.area ? `área: ${b.area}` : null, b.puesto ? `puesto: ${b.puesto}` : null]
          .filter(Boolean).join(', ')
        return `- [${b.modulo}] ${b.titulo}${capas ? ` (${capas})` : ''}`
      })
      .join('\n')

    partesEstables.push(
      `# Conocimiento de la empresa

La base de conocimiento de esta empresa es extensa, por lo que NO está incluida acá.
Este es el índice de temas disponibles:

${indice}

# Cómo acceder al conocimiento

ANTES de responder cualquier pregunta sobre la empresa, sus procesos, herramientas,
beneficios, cultura o el rol del empleado, usá la herramienta buscar_conocimiento
con términos de búsqueda relevantes. Si la primera búsqueda no trae resultados útiles,
reintentá con sinónimos o términos más generales (máximo 2 búsquedas más).
Respondé ÚNICAMENTE con base en los bloques recuperados — si no encontrás la
respuesta, decilo honestamente y sugerí consultar con el manager o buddy.`
    )
  }

  const textoEstable = partesEstables.join('\n\n')
  const textoContexto = contextoEmpleado?.trim()
    ? `# Contexto del empleado\n\n${contextoEmpleado.trim()}`
    : null

  // El breakpoint va en el bloque estable: todos los empleados de la misma
  // empresa/área/puesto comparten el prefijo cacheado (~90% más barato).
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: textoEstable,
      cache_control: { type: 'ephemeral' },
    },
    ...(textoContexto
      ? [{ type: 'text' as const, text: textoContexto }]
      : []),
  ]

  const systemPrompt = textoContexto
    ? `${textoEstable}\n\n${textoContexto}`
    : textoEstable

  return { systemPrompt, systemBlocks, modoConocimiento, config }
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

// Tool de búsqueda FTS — solo se expone en modo 'busqueda'
const TOOL_BUSCAR_CONOCIMIENTO: Anthropic.Tool = {
  name: 'buscar_conocimiento',
  description:
    'Busca en la base de conocimiento de la empresa (cultura, procesos, ' +
    'herramientas, beneficios, información del rol). Llamala ANTES de responder ' +
    'cualquier pregunta sobre la empresa o el trabajo del empleado.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Términos de búsqueda en español (palabras clave, no oraciones largas)',
      },
    },
    required: ['query'],
  },
}

/** Máximo de iteraciones de tool-use por consulta (controla costo y latencia) */
const MAX_ITERACIONES_TOOL = 3

/** Ejecuta la búsqueda FTS y formatea los bloques recuperados */
async function ejecutarBusquedaConocimiento(
  empresaId: string,
  query: string,
): Promise<string> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('buscar_conocimiento', {
      p_empresa_id: empresaId,
      p_query: query,
      p_limit: 5,
    })

    if (error) throw new Error(error.message)
    const filas = (data ?? []) as BloqueConocimiento[]
    if (filas.length === 0) {
      return 'Sin resultados para esa búsqueda. Probá con otros términos.'
    }

    return filas
      .map(b => renderBloqueXML({
        ...b,
        // Acotar el texto extraído por resultado para no inflar el contexto
        contenido_extraido: b.contenido_extraido?.slice(0, 4_000) ?? null,
      }))
      .join('\n\n')
  } catch (err) {
    console.warn('[claude] buscar_conocimiento falló:',
      err instanceof Error ? err.message : err)
    return 'La búsqueda no está disponible en este momento. Respondé que no tenés esa información y sugerí consultar con el manager o buddy.'
  }
}

export async function streamChat({
  empresaId,
  contextoEmpleado,
  empleadoArea,
  empleadoPuesto,
  prefijoInstrucciones,
  mensajes,
  onChunk,
  onDone,
}: StreamChatParams): Promise<TokenUsage> {
  const { systemBlocks, modoConocimiento, config } = await buildSystemPromptWithConfig(
    empresaId,
    contextoEmpleado,
    empleadoArea,
    empleadoPuesto,
    prefijoInstrucciones,
  )

  const usage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    modelo: config.claudeModel,
  }

  // Loop manual de tool-use: en modo 'busqueda' el modelo puede llamar a
  // buscar_conocimiento; los resultados vuelven como tool_result y se
  // continúa hasta que responde con texto (o se agotan las iteraciones).
  //
  // Segundo breakpoint de cache en el ÚLTIMO mensaje del historial recibido:
  // cachea system + historial completo, así las iteraciones de tool-use y el
  // turno siguiente reutilizan ese prefijo. Los mensajes que agrega el loop
  // NO llevan breakpoint (máx. 4 por request — acá quedan 2).
  const mensajesLoop: Anthropic.MessageParam[] = mensajes.map((m, i) => {
    if (i !== mensajes.length - 1) return m
    const bloque: Anthropic.TextBlockParam = {
      type: 'text',
      text: m.content,
      cache_control: { type: 'ephemeral' },
    }
    return { role: m.role, content: [bloque] }
  })

  for (let iteracion = 0; iteracion <= MAX_ITERACIONES_TOOL; iteracion++) {
    const stream = anthropic.messages.stream({
      model: config.claudeModel,
      max_tokens: config.maxTokens,
      system: systemBlocks,
      messages: mensajesLoop,
      ...(modoConocimiento === 'busqueda' && {
        tools: [TOOL_BUSCAR_CONOCIMIENTO],
      }),
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

    // Acumular uso de tokens de cada iteración (incluye actividad de cache)
    const finalMsg = await stream.finalMessage()
    usage.inputTokens += finalMsg.usage.input_tokens
    usage.outputTokens += finalMsg.usage.output_tokens
    usage.cacheReadTokens += finalMsg.usage.cache_read_input_tokens ?? 0
    usage.cacheCreationTokens += finalMsg.usage.cache_creation_input_tokens ?? 0

    if (finalMsg.stop_reason !== 'tool_use' || iteracion === MAX_ITERACIONES_TOOL) {
      break
    }

    // Ejecutar las búsquedas pedidas y continuar el loop
    const toolUses = finalMsg.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )

    const resultados: Anthropic.ToolResultBlockParam[] = []
    for (const tu of toolUses) {
      const query = (tu.input as { query?: string }).query ?? ''
      const resultado = await ejecutarBusquedaConocimiento(empresaId, query)
      resultados.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: resultado,
      })
    }

    mensajesLoop.push({ role: 'assistant', content: finalMsg.content })
    mensajesLoop.push({ role: 'user', content: resultados })
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
    const supabase = createServiceClient()
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
