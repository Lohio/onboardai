// Tests del metering de uso IA: cuota mensual por plan y registro de consumo

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { verificarCuotaIA, registrarUsoIA } from '@/lib/usoIA'
import { cuotaIA, PLANES } from '@/lib/billing'

// ── Mock mínimo del cliente Supabase ─────────────────────────

function crearSupabaseMock(opts: {
  consultas?: number | null
  errorSelect?: boolean
  errorRpc?: boolean
}): { mock: SupabaseClient; rpcSpy: ReturnType<typeof vi.fn> } {
  const maybeSingle = vi.fn().mockResolvedValue(
    opts.errorSelect
      ? { data: null, error: { message: 'tabla no existe' } }
      : { data: opts.consultas != null ? { consultas: opts.consultas } : null, error: null }
  )

  const rpcSpy = vi.fn().mockResolvedValue(
    opts.errorRpc ? { error: { message: 'rpc falló' } } : { error: null }
  )

  const mock = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    })),
    rpc: rpcSpy,
  } as unknown as SupabaseClient

  return { mock, rpcSpy }
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── cuotaIA (helper de planes) ───────────────────────────────

describe('cuotaIA', () => {
  it('devuelve la cuota de cada plan', () => {
    expect(cuotaIA('trial')).toBe(PLANES.trial.consultasIA)
    expect(cuotaIA('pro')).toBe(PLANES.pro.consultasIA)
    expect(cuotaIA('enterprise')).toBe(PLANES.enterprise.consultasIA)
  })

  it('cae a trial con plan nulo o desconocido', () => {
    expect(cuotaIA(null)).toBe(PLANES.trial.consultasIA)
    expect(cuotaIA('inexistente')).toBe(PLANES.trial.consultasIA)
  })
})

// ── verificarCuotaIA ─────────────────────────────────────────

describe('verificarCuotaIA', () => {
  it('permite cuando las consultas usadas están bajo el límite', async () => {
    const { mock } = crearSupabaseMock({ consultas: 5 })
    const r = await verificarCuotaIA(mock, 'empresa-1', 'trial')
    expect(r).toEqual({ permitido: true, usadas: 5, limite: PLANES.trial.consultasIA })
  })

  it('bloquea cuando se alcanzó el límite del plan', async () => {
    const { mock } = crearSupabaseMock({ consultas: PLANES.trial.consultasIA })
    const r = await verificarCuotaIA(mock, 'empresa-1', 'trial')
    expect(r.permitido).toBe(false)
    expect(r.usadas).toBe(PLANES.trial.consultasIA)
  })

  it('permite con 0 usadas cuando no hay fila del mes (empresa sin uso)', async () => {
    const { mock } = crearSupabaseMock({ consultas: null })
    const r = await verificarCuotaIA(mock, 'empresa-1', 'pro')
    expect(r).toEqual({ permitido: true, usadas: 0, limite: PLANES.pro.consultasIA })
  })

  it('fail-open: permite si la query falla (tabla no migrada)', async () => {
    const { mock } = crearSupabaseMock({ errorSelect: true })
    const r = await verificarCuotaIA(mock, 'empresa-1', 'pro')
    expect(r.permitido).toBe(true)
    expect(console.warn).toHaveBeenCalled()
  })
})

// ── registrarUsoIA ───────────────────────────────────────────

describe('registrarUsoIA', () => {
  it('llama al RPC registrar_uso_ia con los parámetros correctos', async () => {
    const { mock, rpcSpy } = crearSupabaseMock({})
    await registrarUsoIA({
      supabase: mock,
      empresaId: 'empresa-1',
      usuarioId: 'user-1',
      fuente: 'chat',
      modelo: 'claude-sonnet-4-6',
      inputTokens: 1000,
      outputTokens: 200,
      cacheReadTokens: 800,
    })

    expect(rpcSpy).toHaveBeenCalledWith('registrar_uso_ia', {
      p_empresa_id: 'empresa-1',
      p_usuario_id: 'user-1',
      p_fuente: 'chat',
      p_modelo: 'claude-sonnet-4-6',
      p_input_tokens: 1000,
      p_output_tokens: 200,
      p_cache_read_tokens: 800,
      p_cache_creation_tokens: 0,
      p_cuenta_consulta: true,
    })
  })

  it('los reportes de admin no consumen cuota (p_cuenta_consulta=false)', async () => {
    const { mock, rpcSpy } = crearSupabaseMock({})
    await registrarUsoIA({
      supabase: mock,
      empresaId: 'empresa-1',
      fuente: 'reporte',
      modelo: 'claude-sonnet-4-6',
      inputTokens: 500,
      outputTokens: 100,
      cuentaConsulta: false,
    })

    const args = rpcSpy.mock.calls[0][1] as Record<string, unknown>
    expect(args.p_cuenta_consulta).toBe(false)
    expect(args.p_usuario_id).toBeNull()
  })

  it('nunca lanza aunque el RPC falle (fire-and-forget)', async () => {
    const { mock } = crearSupabaseMock({ errorRpc: true })
    await expect(registrarUsoIA({
      supabase: mock,
      empresaId: 'empresa-1',
      fuente: 'bot',
      modelo: 'claude-haiku-4-5-20251001',
      inputTokens: 1,
      outputTokens: 1,
    })).resolves.toBeUndefined()
    expect(console.warn).toHaveBeenCalled()
  })
})
