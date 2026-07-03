// ─────────────────────────────────────────────
// usoIA — medición y cuota mensual del asistente IA
// La cuota se mide en consultas/mes por empresa (según plan);
// los tokens se registran por detrás para análisis de margen.
// Requiere scripts/uso_ia.sql ejecutado en Supabase.
// ─────────────────────────────────────────────

import { SupabaseClient } from '@supabase/supabase-js'
import { cuotaIA } from '@/lib/billing'

export type FuenteUsoIA = 'chat' | 'agente' | 'bot' | 'reporte' | 'resumen'

export interface EstadoCuotaIA {
  permitido: boolean
  usadas: number
  limite: number
}

export interface RegistrarUsoParams {
  supabase: SupabaseClient
  empresaId: string
  usuarioId?: string | null
  fuente: FuenteUsoIA
  modelo: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  /** false para usos que no consumen cuota de consultas (reportes admin) */
  cuentaConsulta?: boolean
}

/**
 * Reserva UNA consulta de la cuota mensual de forma ATÓMICA (incremento
 * condicional en un solo statement vía RPC), evitando el TOCTOU de
 * "leer y después incrementar". Contá la consulta ANTES del stream; los
 * tokens se registran después con `cuentaConsulta: false`.
 *
 * Devuelve `usadas` = valor YA incrementado (post-reserva).
 * Fail-open: ante error de DB permite la consulta (con warn) — la cuota
 * no debe tirar el chat por un fallo transitorio (en ese caso la consulta
 * no queda contada, consistente con el comportamiento previo).
 */
export async function reservarConsultaIA(
  supabase: SupabaseClient,
  empresaId: string,
  plan: string | null | undefined,
): Promise<EstadoCuotaIA> {
  const limite = cuotaIA(plan)

  try {
    const { data, error } = await supabase.rpc('reservar_consulta_ia', {
      p_empresa_id: empresaId,
      p_limite: limite,
    })

    if (error) throw new Error(error.message)

    // La RPC devuelve un array con una fila { permitido, usadas }
    const fila = Array.isArray(data) ? data[0] : data
    return {
      permitido: fila?.permitido ?? true,
      usadas: fila?.usadas ?? 0,
      limite,
    }
  } catch (err) {
    console.warn('[usoIA] No se pudo reservar la cuota (fail-open):',
      err instanceof Error ? err.message : err)
    return { permitido: true, usadas: 0, limite }
  }
}

/**
 * Registra el consumo de una llamada IA (detalle + agregado mensual).
 * Fire-and-forget: nunca lanza ni bloquea el flujo principal.
 */
export async function registrarUsoIA({
  supabase,
  empresaId,
  usuarioId = null,
  fuente,
  modelo,
  inputTokens,
  outputTokens,
  cacheReadTokens = 0,
  cacheCreationTokens = 0,
  cuentaConsulta = true,
}: RegistrarUsoParams): Promise<void> {
  try {
    const { error } = await supabase.rpc('registrar_uso_ia', {
      p_empresa_id: empresaId,
      p_usuario_id: usuarioId,
      p_fuente: fuente,
      p_modelo: modelo,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_cache_read_tokens: cacheReadTokens,
      p_cache_creation_tokens: cacheCreationTokens,
      p_cuenta_consulta: cuentaConsulta,
    })
    if (error) {
      console.warn('[usoIA] No se pudo registrar el uso:', error.message)
    }
  } catch (err) {
    console.warn('[usoIA] Error inesperado registrando uso:',
      err instanceof Error ? err.message : err)
  }
}

/** Mensaje que ve el empleado cuando la empresa agotó su cuota mensual */
export const MENSAJE_CUOTA_AGOTADA =
  'El asistente alcanzó el límite de consultas de este mes para tu empresa. ' +
  'Avisale a tu administrador para ampliar el plan — mientras tanto podés ' +
  'consultar a tu manager o buddy. 🙌'
