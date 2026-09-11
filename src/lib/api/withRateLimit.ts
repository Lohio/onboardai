// ─────────────────────────────────────────────
// withRateLimit — rate limiting DB-based compatible con Vercel serverless
// Usa la función atómica increment_rate_limit en Supabase para evitar race conditions
// Estrategia: fail open (si falla el check, se permite la request)
// ─────────────────────────────────────────────

import { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { ApiError } from '@/lib/errors'

export interface RateLimitOptions {
  // Número máximo de requests permitidos en la ventana
  max: number
  // Duración de la ventana en milisegundos
  windowMs: number
  // Tipo de key para identificar al solicitante
  keyType: 'user' | 'ip' | 'empresa'
  // Si la RPC de rate limit falla: false (default) permite la request (fail-open),
  // true la rechaza (fail-closed). Usar true en endpoints de auth para que un
  // fallo de la tabla no abra la puerta a fuerza bruta.
  failClosed?: boolean
}

export interface RateLimitContext {
  supabase: SupabaseClient
  userId?: string
  empresaId?: string
  ip?: string
  // Nombre del endpoint para construir la key (ej: 'chat', 'login')
  endpoint: string
}

/**
 * Verifica el rate limit para un request.
 * Retorna null si está permitido, o un NextResponse 429 si se excedió.
 */
export async function checkRateLimit(
  options: RateLimitOptions,
  ctx: RateLimitContext,
  requestId?: string
): Promise<NextResponse | null> {
  // Construir la key de rate limiting
  let keyValue: string | undefined
  switch (options.keyType) {
    case 'user':
      keyValue = ctx.userId
      break
    case 'empresa':
      keyValue = ctx.empresaId
      break
    case 'ip':
      keyValue = ctx.ip
      break
  }

  // Si no hay valor para la key, saltar el rate limiting
  // (ej: usuario no autenticado en endpoints que lo requieren)
  if (!keyValue) return null

  const key = `${ctx.endpoint}:${options.keyType}:${keyValue}`

  // Calcular el inicio de la ventana temporal (truncar al windowMs)
  const now = Date.now()
  const windowStart = new Date(Math.floor(now / options.windowMs) * options.windowMs)

  // Llamar a la función atómica en Supabase
  const { data, error } = await ctx.supabase.rpc('increment_rate_limit', {
    p_key: key,
    p_window: windowStart.toISOString(),
    p_max: options.max,
  })

  if (error) {
    console.warn('[withRateLimit] Error al verificar rate limit:', error.message)
    if (options.failClosed) {
      // Endpoints sensibles (auth): si no podemos garantizar el límite, rechazar
      const response = ApiError.tooManyRequests(
        'Servicio de límite de solicitudes no disponible. Intentá nuevamente en unos momentos.',
        requestId
      )
      response.headers.set('Retry-After', '30')
      return response
    }
    // Resto: fail-open para no tirar abajo la app por un fallo transitorio del check
    return null
  }

  if (data === false) {
    // Calcular cuándo se resetea la ventana
    const resetAt = new Date(Math.floor(now / options.windowMs) * options.windowMs + options.windowMs)
    const retryAfterSeconds = Math.ceil((resetAt.getTime() - now) / 1000)

    const response = ApiError.tooManyRequests(
      `Límite de solicitudes excedido. Intentá nuevamente en ${retryAfterSeconds} segundos.`,
      requestId
    )
    // Agregar header Retry-After estándar
    response.headers.set('Retry-After', String(retryAfterSeconds))
    return response
  }

  return null
}

// Constantes de configuración por ruta (para uso en withHandler)
export const RATE_LIMITS = {
  // Auth — fail-closed: un fallo del check no debe habilitar fuerza bruta
  login:    { max: 10,  windowMs: 15 * 60 * 1000, keyType: 'ip', failClosed: true } as RateLimitOptions,
  register: { max: 5,   windowMs: 60 * 60 * 1000, keyType: 'ip', failClosed: true } as RateLimitOptions,
  // Admin
  crearEmpleado: { max: 20, windowMs: 60 * 60 * 1000, keyType: 'user' } as RateLimitOptions,
  reporte:       { max: 10, windowMs: 60 * 60 * 1000, keyType: 'user' } as RateLimitOptions,
  passwords:     { max: 15, windowMs: 60 * 60 * 1000, keyType: 'user', failClosed: true } as RateLimitOptions,
  // API pública v1 (keyType 'empresa': la cuota es compartida por todas las keys de la empresa)
  apiV1Read:     { max: 300, windowMs: 60 * 60 * 1000, keyType: 'empresa' } as RateLimitOptions,
  apiV1Write:    { max: 60,  windowMs: 60 * 60 * 1000, keyType: 'empresa' } as RateLimitOptions,
  upload:        { max: 30, windowMs: 60 * 60 * 1000, keyType: 'user' } as RateLimitOptions,
  // Empleado
  chat:         { max: 50,  windowMs: 24 * 60 * 60 * 1000, keyType: 'user' } as RateLimitOptions,
  agente:       { max: 100, windowMs: 24 * 60 * 60 * 1000, keyType: 'user' } as RateLimitOptions,
  encuesta:     { max: 20,  windowMs: 60 * 60 * 1000,      keyType: 'user' } as RateLimitOptions,
  // Bot
  bot:          { max: 100, windowMs: 60 * 60 * 1000, keyType: 'ip' } as RateLimitOptions,
} as const
