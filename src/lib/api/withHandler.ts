// ─────────────────────────────────────────────
// withHandler — wrapper central para todas las API routes
// Gestiona: autenticación, autorización, validación de body,
// logging estructurado y header X-Request-Id en la respuesta
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { ZodType, ZodError } from 'zod'
import { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase'
import { ApiError } from '@/lib/errors'
import { generateRequestId } from '@/lib/api/requestId'
import { logRequest } from '@/lib/api/logger'
import { UserRole } from '@/types'
import { ApiContext } from '@/types/api'

// ─────────────────────────────────────────────
// Opciones de configuración del handler
// ─────────────────────────────────────────────
interface HandlerOptions<TBody = unknown> {
  // Modo de autenticación
  auth: 'session' | 'cron' | 'webhook' | 'none'
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
      } else if (options.auth === 'cron') {
        // Verificación por secret compartido en el header Authorization
        const authHeader = req.headers.get('authorization')
        const expectedSecret = process.env.CRON_SECRET
        if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
          status = 401
          return ApiError.unauthorized(requestId)
        }
      }
      // 'webhook' y 'none': sin verificación en el wrapper

      // ── Autorización por rol ─────────────────────────────────────────
      if (options.rol !== undefined && user !== null) {
        const rolesPermitidos = Array.isArray(options.rol)
          ? options.rol
          : [options.rol]

        if (!rolesPermitidos.includes(user.rol)) {
          status = 403
          return ApiError.forbidden(requestId)
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
          return NextResponse.json(
            { error: 'Datos inválidos', details: parsed.error.issues, requestId },
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

      // Si el handler lanzó un NextResponse directamente, re-lanzar
      if (err instanceof NextResponse) {
        status = err.status
        throw err
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

      // Fallback: error interno
      status = 500
      if (process.env.NODE_ENV !== 'production' && err instanceof Error) {
        console.error(`[withHandler] Error interno [${requestId}]:`, err)
      }
      return ApiError.internal(undefined, requestId)
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
