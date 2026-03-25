// src/lib/api-error.ts
// Clasificación de errores externos (Anthropic, Supabase, red).
// Usado por withHandler y dentro de ReadableStreams donde
// el catch estándar no alcanza.

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export type ExternalErrorSource = 'anthropic' | 'supabase' | 'network' | 'unknown'

export interface ClassifiedError {
  source: ExternalErrorSource
  status: number       // HTTP status a devolver al cliente
  message: string      // mensaje seguro para el cliente (sin internals)
  logMessage: string   // mensaje completo para el log interno
  retryable: boolean   // ¿el cliente puede reintentar?
}

// ─────────────────────────────────────────────
// Clasificador principal
// ─────────────────────────────────────────────

export function classifyError(err: unknown): ClassifiedError {
  const message = err instanceof Error ? err.message : String(err)
  const lowerMsg = message.toLowerCase()

  // ── Errores de Anthropic ───────────────────
  if (isAnthropicError(err)) {
    const status = getAnthropicStatus(err)

    if (status === 429) {
      return {
        source: 'anthropic',
        status: 503,
        message: 'El asistente está temporalmente ocupado. Intentá en unos segundos.',
        logMessage: `Anthropic rate limit: ${message}`,
        retryable: true,
      }
    }
    if (status === 401 || status === 403) {
      return {
        source: 'anthropic',
        status: 500,
        message: 'Error de configuración del asistente.',
        logMessage: `Anthropic auth error (${status}): ${message}`,
        retryable: false,
      }
    }
    if (status >= 500) {
      return {
        source: 'anthropic',
        status: 503,
        message: 'El asistente está temporalmente no disponible.',
        logMessage: `Anthropic server error (${status}): ${message}`,
        retryable: true,
      }
    }
    return {
      source: 'anthropic',
      status: 500,
      message: 'Error al procesar tu consulta.',
      logMessage: `Anthropic error (${status}): ${message}`,
      retryable: false,
    }
  }

  // ── Errores de Supabase / PostgreSQL ───────
  if (isSupabaseError(err)) {
    // Timeout de statement
    if (lowerMsg.includes('statement timeout') || lowerMsg.includes('canceling statement')) {
      return {
        source: 'supabase',
        status: 504,
        message: 'La operación tardó demasiado. Intentá nuevamente.',
        logMessage: `Supabase timeout: ${message}`,
        retryable: true,
      }
    }
    // Conexión cerrada / pool exhausto
    if (lowerMsg.includes('connection') || lowerMsg.includes('econnrefused')) {
      return {
        source: 'supabase',
        status: 503,
        message: 'Error temporal de base de datos. Intentá en unos segundos.',
        logMessage: `Supabase connection error: ${message}`,
        retryable: true,
      }
    }
    // Violación de constraint (unique, FK)
    if (lowerMsg.includes('duplicate') || lowerMsg.includes('unique') || lowerMsg.includes('23505')) {
      return {
        source: 'supabase',
        status: 409,
        message: 'Ya existe un registro con esos datos.',
        logMessage: `Supabase constraint violation: ${message}`,
        retryable: false,
      }
    }
    return {
      source: 'supabase',
      status: 500,
      message: 'Error de base de datos.',
      logMessage: `Supabase error: ${message}`,
      retryable: false,
    }
  }

  // ── Errores de red genéricos ───────────────
  if (lowerMsg.includes('fetch failed') || lowerMsg.includes('econnreset') || lowerMsg.includes('etimedout')) {
    return {
      source: 'network',
      status: 503,
      message: 'Error de conectividad temporal. Intentá nuevamente.',
      logMessage: `Network error: ${message}`,
      retryable: true,
    }
  }

  // ── Fallback ───────────────────────────────
  return {
    source: 'unknown',
    status: 500,
    message: 'Error interno del servidor.',
    logMessage: `Unclassified error: ${message}`,
    retryable: false,
  }
}

// ─────────────────────────────────────────────
// Helper: logging estructurado para streams
// (dentro de ReadableStream el try/catch no llega a withHandler)
// ─────────────────────────────────────────────

export function logStreamError(
  context: string,
  err: unknown,
  requestId?: string
): ClassifiedError {
  const classified = classifyError(err)
  const prefix = requestId ? `[${requestId}]` : ''
  console.error(
    `[stream-error]${prefix} ${context} — source=${classified.source} status=${classified.status}:`,
    classified.logMessage,
    process.env.NODE_ENV !== 'production' && err instanceof Error ? err.stack : ''
  )
  return classified
}

// ─────────────────────────────────────────────
// Detectores de tipo de error
// ─────────────────────────────────────────────

function isAnthropicError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  // El SDK de Anthropic lanza errores con nombre 'APIError' o con propiedad 'status'
  return (
    err.constructor.name === 'APIError' ||
    err.constructor.name.includes('Anthropic') ||
    ('status' in err && 'error' in err) // forma del SDK: { status, error, headers }
  )
}

function getAnthropicStatus(err: unknown): number {
  if (err instanceof Error && 'status' in err) {
    return (err as Error & { status: number }).status
  }
  return 500
}

function isSupabaseError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return (
    err.constructor.name === 'PostgrestError' ||
    ('code' in err && 'details' in err && 'hint' in err) || // forma de PostgrestError
    ('code' in err && typeof (err as { code: unknown }).code === 'string' &&
      /^[0-9A-Z]{5}$/.test((err as { code: string }).code)) // código SQL SQLSTATE
  )
}
