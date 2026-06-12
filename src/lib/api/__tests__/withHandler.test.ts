// ─────────────────────────────────────────────
// Tests unitarios de withHandler — wrapper central de las API routes
// Cubre: auth (session/apiKey/cron), autorización por rol,
// validación Zod del body, rate limiting, manejo de errores y X-Request-Id
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'
import { createServerSupabaseClient } from '@/lib/supabase'
import { verifyApiKey, type ApiKeyRecord } from '@/lib/api/apiKeys'
import { checkRateLimit } from '@/lib/api/withRateLimit'
import { ApiError } from '@/lib/errors'
import type { ApiContext } from '@/types/api'

// ── Mocks de módulos ───────────────────────────────────────────────
vi.mock('@/lib/supabase', () => ({
  createServerSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/api/apiKeys', () => ({
  verifyApiKey: vi.fn(),
}))

vi.mock('@/lib/api/withRateLimit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('@/lib/api/logger', () => ({
  logRequest: vi.fn(),
}))

// ── Helpers ────────────────────────────────────────────────────────

interface MockSupabaseConfig {
  // Usuario autenticado retornado por supabase.auth.getUser()
  authUser?: { id: string } | null
  // Perfil retornado por from('usuarios').select().eq().single()
  perfil?: { empresa_id: string; rol: string } | null
}

// Construye un mock mínimo del cliente Supabase para los flujos de withHandler
function crearSupabaseMock(config: MockSupabaseConfig = {}): SupabaseClient {
  const { authUser = null, perfil = null } = config

  const single = vi.fn().mockResolvedValue(
    perfil
      ? { data: perfil, error: null }
      : { data: null, error: { message: 'perfil no encontrado' } }
  )

  const mock = {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        authUser
          ? { data: { user: authUser }, error: null }
          : { data: { user: null }, error: { message: 'sin sesión' } }
      ),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single })),
      })),
    })),
  }

  return mock as unknown as SupabaseClient
}

// Request básico sin body
function crearRequest(init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest('http://localhost/api/test', init)
}

// Request POST con body JSON
function crearRequestJson(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Handler genérico que responde 200 con un marcador
function handlerOk(): Promise<NextResponse> {
  return Promise.resolve(NextResponse.json({ ok: true }))
}

// Registro de API key de ejemplo
const apiKeyRecordFixture: ApiKeyRecord = {
  id: 'key-1',
  empresa_id: 'empresa-1',
  nombre: 'Key de prueba',
  key_prefix: 'oai_live_abc',
  scopes: ['empleados:read'],
  rate_limit: 100,
  activa: true,
  last_used: null,
  expires_at: null,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
}

const mockCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient)
const mockVerifyApiKey = vi.mocked(verifyApiKey)
const mockCheckRateLimit = vi.mocked(checkRateLimit)

beforeEach(() => {
  vi.clearAllMocks()
  // Por defecto: cliente Supabase sin sesión y sin rate limit excedido
  mockCreateServerSupabaseClient.mockResolvedValue(crearSupabaseMock())
  mockCheckRateLimit.mockResolvedValue(null)
  // Silenciar logs internos del wrapper durante los tests
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────

describe("withHandler — auth: 'session'", () => {
  it('retorna 401 si no hay usuario autenticado', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(crearSupabaseMock({ authUser: null }))
    const handler = vi.fn(handlerOk)
    const route = withHandler({ auth: 'session' }, handler)

    const res = await route(crearRequest())

    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
    const json = (await res.json()) as { error: string; requestId: string }
    expect(json.error).toBe('No autorizado')
    expect(json.requestId).toBeTruthy()
  })

  it('retorna 401 si el usuario no tiene perfil en la tabla usuarios', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(
      crearSupabaseMock({ authUser: { id: 'user-1' }, perfil: null })
    )
    const handler = vi.fn(handlerOk)
    const route = withHandler({ auth: 'session' }, handler)

    const res = await route(crearRequest())

    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('pasa con usuario y perfil, y ctx.user trae id, empresaId y rol', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(
      crearSupabaseMock({
        authUser: { id: 'user-1' },
        perfil: { empresa_id: 'empresa-1', rol: 'admin' },
      })
    )
    let ctxRecibido: ApiContext | undefined
    const route = withHandler({ auth: 'session' }, async (ctx) => {
      ctxRecibido = ctx
      return NextResponse.json({ ok: true })
    })

    const res = await route(crearRequest())

    expect(res.status).toBe(200)
    expect(ctxRecibido?.user).toEqual({
      id: 'user-1',
      empresaId: 'empresa-1',
      rol: 'admin',
    })
  })
})

describe("withHandler — auth: 'session' + rol", () => {
  it('retorna 403 si el rol del usuario no está permitido', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(
      crearSupabaseMock({
        authUser: { id: 'user-1' },
        perfil: { empresa_id: 'empresa-1', rol: 'empleado' },
      })
    )
    const handler = vi.fn(handlerOk)
    const route = withHandler({ auth: 'session', rol: 'admin' }, handler)

    const res = await route(crearRequest())

    expect(res.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('Acceso denegado')
  })

  it('pasa si el rol del usuario está permitido (rol único)', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(
      crearSupabaseMock({
        authUser: { id: 'user-1' },
        perfil: { empresa_id: 'empresa-1', rol: 'admin' },
      })
    )
    const route = withHandler({ auth: 'session', rol: 'admin' }, handlerOk)

    const res = await route(crearRequest())

    expect(res.status).toBe(200)
  })

  it('pasa si el rol del usuario está dentro del array de roles permitidos', async () => {
    mockCreateServerSupabaseClient.mockResolvedValue(
      crearSupabaseMock({
        authUser: { id: 'user-1' },
        perfil: { empresa_id: 'empresa-1', rol: 'dev' },
      })
    )
    const route = withHandler({ auth: 'session', rol: ['admin', 'dev'] }, handlerOk)

    const res = await route(crearRequest())

    expect(res.status).toBe(200)
  })
})

describe("withHandler — auth: 'apiKey'", () => {
  it('retorna 401 si no hay header Authorization', async () => {
    const handler = vi.fn(handlerOk)
    const route = withHandler({ auth: 'apiKey' }, handler)

    const res = await route(crearRequest())

    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('API key requerida')
    expect(mockVerifyApiKey).not.toHaveBeenCalled()
  })

  it('retorna 401 si la key es inválida (verifyApiKey retorna null)', async () => {
    mockVerifyApiKey.mockResolvedValue(null)
    const handler = vi.fn(handlerOk)
    const route = withHandler({ auth: 'apiKey' }, handler)

    const res = await route(
      crearRequest({ headers: { Authorization: 'Bearer oai_live_invalida' } })
    )

    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('API key inválida o expirada')
    expect(mockVerifyApiKey).toHaveBeenCalledWith('oai_live_invalida')
  })

  it('pasa con key válida y setea ctx.apiKeyRecord (user queda null)', async () => {
    mockVerifyApiKey.mockResolvedValue({
      record: apiKeyRecordFixture,
      empresaId: 'empresa-1',
    })
    let ctxRecibido: ApiContext | undefined
    const route = withHandler({ auth: 'apiKey' }, async (ctx) => {
      ctxRecibido = ctx
      return NextResponse.json({ ok: true })
    })

    const res = await route(
      crearRequest({ headers: { Authorization: 'Bearer oai_live_valida123' } })
    )

    expect(res.status).toBe(200)
    expect(ctxRecibido?.apiKeyRecord).toEqual(apiKeyRecordFixture)
    expect(ctxRecibido?.user).toBeNull()
  })
})

describe("withHandler — auth: 'cron'", () => {
  it('retorna 401 si CRON_SECRET no está configurado en el entorno', async () => {
    vi.stubEnv('CRON_SECRET', undefined)
    const handler = vi.fn(handlerOk)
    const route = withHandler({ auth: 'cron' }, handler)

    const res = await route(
      crearRequest({ headers: { authorization: 'Bearer cualquier-cosa' } })
    )

    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('retorna 401 si el secret es incorrecto', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto-correcto')
    const handler = vi.fn(handlerOk)
    const route = withHandler({ auth: 'cron' }, handler)

    const res = await route(
      crearRequest({ headers: { authorization: 'Bearer secreto-equivocado' } })
    )

    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('pasa con "Bearer <secret>" correcto', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto-correcto')
    const route = withHandler({ auth: 'cron' }, handlerOk)

    const res = await route(
      crearRequest({ headers: { authorization: 'Bearer secreto-correcto' } })
    )

    expect(res.status).toBe(200)
  })
})

describe('withHandler — validación con schema Zod', () => {
  const schema = z.object({
    nombre: z.string(),
    edad: z.number(),
  })

  it('retorna 400 con body inválido e incluye details fuera de producción', async () => {
    const handler = vi.fn(handlerOk)
    const route = withHandler({ auth: 'none', schema }, handler)

    const res = await route(crearRequestJson({ nombre: 123 }))

    expect(res.status).toBe(400)
    expect(handler).not.toHaveBeenCalled()
    const json = (await res.json()) as { error: string; details?: unknown[]; requestId: string }
    expect(json.error).toBe('Datos inválidos')
    expect(Array.isArray(json.details)).toBe(true)
    expect(json.requestId).toBeTruthy()
  })

  it('retorna 400 sin details cuando NODE_ENV es production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const route = withHandler({ auth: 'none', schema }, handlerOk)

    const res = await route(crearRequestJson({ nombre: 123 }))

    expect(res.status).toBe(400)
    const json = (await res.json()) as Record<string, unknown>
    expect(json.error).toBe('Datos inválidos')
    expect('details' in json).toBe(false)
  })

  it('pasa con body válido y ctx.body trae los datos parseados', async () => {
    let bodyRecibido: { nombre: string; edad: number } | undefined
    const route = withHandler({ auth: 'none', schema }, async (ctx) => {
      bodyRecibido = ctx.body
      return NextResponse.json({ ok: true })
    })

    const res = await route(crearRequestJson({ nombre: 'Sofía', edad: 28 }))

    expect(res.status).toBe(200)
    expect(bodyRecibido).toEqual({ nombre: 'Sofía', edad: 28 })
  })

  it('retorna 400 con JSON malformado en el body', async () => {
    const handler = vi.fn(handlerOk)
    const route = withHandler({ auth: 'none', schema }, handler)

    const res = await route(
      new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ esto no es json',
      })
    )

    expect(res.status).toBe(400)
    expect(handler).not.toHaveBeenCalled()
    const json = (await res.json()) as { error: string }
    expect(json.error).toBe('JSON inválido en el body')
  })
})

describe('withHandler — rate limiting', () => {
  it('devuelve la respuesta 429 que retorna checkRateLimit', async () => {
    const respuesta429 = ApiError.tooManyRequests('Límite excedido', 'req-test')
    mockCheckRateLimit.mockResolvedValue(respuesta429)
    const handler = vi.fn(handlerOk)
    const route = withHandler(
      { auth: 'none', rateLimit: { max: 10, windowMs: 60_000, keyType: 'ip' } },
      handler
    )

    const res = await route(crearRequest())

    expect(res.status).toBe(429)
    expect(res).toBe(respuesta429)
    expect(handler).not.toHaveBeenCalled()
  })

  it('ejecuta el handler si checkRateLimit retorna null', async () => {
    mockCheckRateLimit.mockResolvedValue(null)
    const route = withHandler(
      { auth: 'none', rateLimit: { max: 10, windowMs: 60_000, keyType: 'ip' } },
      handlerOk
    )

    const res = await route(crearRequest())

    expect(res.status).toBe(200)
    expect(mockCheckRateLimit).toHaveBeenCalledOnce()
  })
})

describe('withHandler — manejo de errores y headers', () => {
  it('si el handler lanza una NextResponse, se retorna tal cual', async () => {
    const lanzada = NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const route = withHandler({ auth: 'none' }, async () => {
      throw lanzada
    })

    const res = await route(crearRequest())

    expect(res).toBe(lanzada)
    expect(res.status).toBe(404)
  })

  it('agrega el header X-Request-Id en respuestas no-streaming', async () => {
    const route = withHandler({ auth: 'none' }, handlerOk)

    const res = await route(crearRequest())

    expect(res.status).toBe(200)
    const requestId = res.headers.get('X-Request-Id')
    expect(requestId).toBeTruthy()
    // El requestId del header coincide con un UUID v4
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })
})
