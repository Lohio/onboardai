// ─────────────────────────────────────────────
// withHandler — wrapper central para todas las API routes
// Gestiona: autenticación, autorización, validación de body,
// logging estructurado y header X-Request-Id en la respuesta
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { ZodType, ZodError } from 'zod'
import { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase'
import { ApiError } from '@/lib/errors'
import { classifyError } from '@/lib/api-error'
import { generateRequestId } from '@/lib/api/requestId'
import { logRequest } from '@/lib/api/logger'
import { UserRole } from '@/types'
import { ApiContext } from '@/types/api'
import { RateLimitOptions, checkRateLimit } from '@/lib/api/withRateLimit'
import { verifyApiKey, type ApiKeyRecord } from '@/lib/api/apiKeys'

// ─────────────────────────────────────────────
// Opciones de configuración del handler
// ─────────────────────────────────────────────
interface HandlerOptions<TBody = unknown> {
  // Modo de autenticación
  auth: 'session' | 'apiKey' | 'cron' | 'webhook' | 'none'
  // Rol mínimo requerido (solo para auth: 'session')
  rol?: UserRole | UserRole[]
  // Schema Zod para validar el body
  schema?: ZodType<TBody>
  // ¿El handler retorna un ReadableStream?
  streaming?: boolean
  // Tipo de body a parsear ('none' omite el parseo)
  bodyType?: 'json' | 'formdata' | 'none'
  // CORS (para API pública, fase 2)
  cors?: boolean
  // Configuración de rate limiting (DB-based, compatible con Vercel serverless)
  rateLimit?: RateLimitOptions
}

// ─────────────────────────────────────────────
// Firma pública de withHandler
// ─────────────────────────────────────────────
export function withHandler<TBody = unknown>(
  options: HandlerOptions<TBody>,
  handler: (ctx: ApiContext<TBody>) => Promise<NextResponse>
): (
  req: NextRequest,
  routeCtx?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> {
  return async (
    req: NextRequest,
    routeCtx?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const requestId = generateRequestId()
    const startMs = Date.now()

    // Resolvemos params (Next.js 14 App Router los entrega como Promise)
    const resolvedParams = routeCtx?.params ? await routeCtx.params : {}

    let status = 500
    let userId: string | undefined
    let empresaId: string | undefined
    let apiKeyRecord: ApiKeyRecord | undefined

    try {
      // ── Supabase client ──────────────────────────────────────────────
      // Se crea siempre para que el handler pueda usarlo independientemente del modo de auth
      const supabase: SupabaseClient = await createServerSupabaseClient()

      // ── Autenticación ────────────────────────────────────────────────
      let user: ApiContext<TBody>['user'] = null

      if (options.auth === 'session') {
        const { data: { user: authUser }, error: authError } =
          await supabase.auth.getUser()

        if (authError || !authUser) {
          status = 401
          return ApiError.unauthorized(requestId)
        }

        // Obtener empresa_id y rol desde la tabla usuarios
        const { data: perfil, error: perfilError } = await supabase
          .from('usuarios')
          .select('empresa_id, rol')
          .eq('id', authUser.id)
          .single()

        if (perfilError || !perfil) {
          status = 401
          return ApiError.unauthorized(requestId)
        }

        userId = authUser.id
        empresaId = perfil.empresa_id as string

        user = {
          id: authUser.id,
          empresaId: perfil.empresa_id as string,
          rol: perfil.rol as UserRole,
        }
      } else if (options.auth === 'apiKey') {
        // Verificación por API Key en el header Authorization: Bearer oai_live_...
        const authHeader = req.headers.get('Authorization')
        const rawKey = authHeader?.startsWith('Bearer ')
          ? authHeader.slice(7)
          : null

        if (!rawKey) {
          status = 401
          return ApiError.unauthorized('API key requerida', requestId)
        }

        const keyResult = await verifyApiKey(rawKey)
        if (!keyResult) {
          status = 401
          return ApiError.unauthorized('API key inválida o expirada', requestId)
        }

        // Para apiKey auth, user es null (acceso de máquina, no de usuario humano)
        // La empresa_id proviene de la API key
        empresaId = keyResult.empresaId
        apiKeyRecord = keyResult.record
      } else if (options.auth === 'cron') {
        // Verificación por secret compartido — comparación en tiempo constante
        // para prevenir timing attacks
        const authHeader = req.headers.get('authorization') ?? ''
        const expectedSecret = process.env.CRON_SECRET
        if (!expectedSecret) {
          status = 401
          return ApiError.unauthorized(requestId)
        }
        const expected = `Bearer ${expectedSecret}`
        const match =
          authHeader.length === expected.length &&
          crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
        if (!match) {
          status = 401
          return ApiError.unauthorized(requestId)
        }
      }
      // 'webhook' y 'none': sin verificación en el wrapper

      // ── Autorización por rol ─────────────────────────────────────────
      // Solo se puede verificar rol con auth: 'session'
      if (options.rol !== undefined) {
        if (options.auth !== 'session' && options.auth !== 'apiKey') {
          // Error de configuración del desarrollador
          if (process.env.NODE_ENV !== 'production') {
            throw new Error(`[withHandler] La opción 'rol' solo aplica con auth: 'session', pero se recibió auth: '${options.auth}'`)
          }
        } else if (user !== null) {
          // Verificar que el rol del usuario está permitido
          const rolesPermitidos = Array.isArray(options.rol) ? options.rol : [options.rol]
          if (!rolesPermitidos.includes(user.rol)) {
            status = 403
            return ApiError.forbidden(requestId)
          }
        }
      }

      // ── Rate limiting ────────────────────────────────────────────────
      if (options.rateLimit) {
        const ip =
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          req.headers.get('x-real-ip') ??
          'unknown'

        const rateLimitResponse = await checkRateLimit(
          options.rateLimit,
          {
            supabase,
            userId,
            empresaId,
            ip,
            endpoint: new URL(req.url).pathname,
          },
          requestId
        )

        if (rateLimitResponse) {
          status = 429
          return rateLimitResponse
        }
      }

      // ── Parseo y validación del body ─────────────────────────────────
      let body: TBody = undefined as unknown as TBody

      const bodyType = options.bodyType ?? 'json'

      if (bodyType !== 'none' && options.schema) {
        let rawBody: unknown

        if (bodyType === 'formdata') {
          rawBody = await req.formData()
        } else {
          // json (default)
          try {
            rawBody = await req.json()
          } catch {
            status = 400
            return NextResponse.json(
              { error: 'JSON inválido en el body', requestId },
              { status: 400 }
            )
          }
        }

        const parsed = options.schema.safeParse(rawBody)
        if (!parsed.success) {
          status = 400
          console.log('[withHandler] Datos inválidos:', {
            path: new URL(req.url).pathname,
            // rawBody omitido — puede contener datos sensibles (passwords, tokens)
            issues: parsed.error.issues,
          })
          return NextResponse.json(
            {
              error: 'Datos inválidos',
              ...(process.env.NODE_ENV !== 'production' && { details: parsed.error.issues }),
              requestId,
            },
            { status: 400 }
          )
        }

        body = parsed.data
      }

      // ── Ejecutar el handler ──────────────────────────────────────────
      const ctx: ApiContext<TBody> = {
        req,
        body,
        user,
        supabase,
        requestId,
        params: resolvedParams,
        apiKeyRecord,
      }

      const response = await handler(ctx)
      status = response.status

      // Para streaming no modificamos la respuesta (el stream ya inició)
      if (options.streaming) {
        return response
      }

      // Agregar X-Request-Id como header de correlación
      const headers = new Headers(response.headers)
      headers.set('X-Request-Id', requestId)

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    } catch (err: unknown) {
      // ── Manejo de errores ────────────────────────────────────────────

      // Si el handler lanzó una NextResponse (o Response), retornarla directamente
      // NextResponse extiende Response, así que verificar instanceof Response es suficiente
      if (err instanceof Response) {
        status = err.status
        return err as NextResponse
      }

      // ZodError atrapado fuera del parseo (ej: en el handler)
      if (err instanceof ZodError) {
        status = 400
        return NextResponse.json(
          { error: 'Datos inválidos', details: err.issues, requestId },
          { status: 400 }
        )
      }

      // Error con propiedad .status (convención de algunos helpers)
      if (err instanceof Error && 'status' in err) {
        const httpErr = err as Error & { status: number }
        status = httpErr.status
        return NextResponse.json(
          { error: httpErr.message, requestId },
          { status: httpErr.status }
        )
      }

      // Fallback: clasificar el error para dar respuesta precisa
      const classified = classifyError(err)
      status = classified.status

      console.error(
        `[withHandler][${requestId}] ${classified.source} — ${classified.logMessage}`,
        process.env.NODE_ENV !== 'production' && err instanceof Error ? err.stack : ''
      )

      return NextResponse.json(
        {
          error: classified.message,
          retryable: classified.retryable,
          requestId,
        },
        { status: classified.status }
      )
    } finally {
      // ── Log estructurado ─────────────────────────────────────────────
      logRequest({
        timestamp: new Date().toISOString(),
        requestId,
        level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
        method: req.method,
        path: new URL(req.url).pathname,
        status,
        durationMs: Date.now() - startMs,
        userId,
        empresaId,
        userAgent: req.headers.get('user-agent') ?? undefined,
        ip: req.headers.get('x-forwarded-for') ?? undefined,
      })
    }
  }
}
