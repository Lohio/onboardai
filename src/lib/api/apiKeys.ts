// ─────────────────────────────────────────────
// apiKeys — generación y verificación de API Keys para acceso externo
// Las keys tienen formato: oai_live_{32-char-hex}
// Se almacenan como hash SHA-256 en la tabla api_keys
// ─────────────────────────────────────────────

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Scopes disponibles para las API keys
export const API_KEY_SCOPES = [
  'empleados:read',
  'empleados:write',
  'progreso:read',
  'encuestas:read',
  'webhooks:write',
] as const

export type ApiKeyScope = typeof API_KEY_SCOPES[number]

// Registro completo de una API key (sin el hash, nunca se expone)
export interface ApiKeyRecord {
  id: string
  empresa_id: string
  nombre: string
  key_prefix: string
  scopes: ApiKeyScope[]
  rate_limit: number
  activa: boolean
  last_used: string | null
  expires_at: string | null
  created_by: string | null
  created_at: string
}

// Genera una nueva API key en texto plano (se muestra una sola vez al crear)
export function generateApiKey(): string {
  const random = crypto.randomBytes(16).toString('hex') // 32 chars hex
  return `oai_live_${random}`
}

// Hashea una API key para almacenamiento seguro
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

// Regex para validar que el sufijo de la key sea exactamente 32 caracteres hex en minúsculas
const HEX_RE = /^[0-9a-f]{32}$/

// Verifica una API key y retorna el registro y empresa_id, o null si es inválida.
// Usa service role para bypassear RLS (acceso de solo lectura controlado).
export async function verifyApiKey(
  rawKey: string
): Promise<{ record: ApiKeyRecord; empresaId: string } | null> {
  // Validar formato: oai_live_ (9 chars) + 32 hex chars en minúsculas
  if (!rawKey.startsWith('oai_live_') || !HEX_RE.test(rawKey.slice(9))) {
    return null
  }

  const keyHash = hashApiKey(rawKey)

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null

  const sa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await sa
    .from('api_keys')
    .select('id, empresa_id, nombre, key_prefix, scopes, rate_limit, activa, last_used, expires_at, created_by, created_at')
    .eq('key_hash', keyHash)
    .eq('activa', true)
    .single()

  if (error || !data) return null

  // Verificar expiración
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null
  }

  // Actualizar last_used en background (fire and forget, no bloquea la respuesta)
  sa.from('api_keys')
    .update({ last_used: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return {
    record: data as ApiKeyRecord,
    empresaId: data.empresa_id,
  }
}

// Verifica si un registro de API key tiene el scope requerido
export function hasScope(record: ApiKeyRecord, scope: ApiKeyScope): boolean {
  return record.scopes.includes(scope)
}
