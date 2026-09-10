import type { SupabaseClient } from '@supabase/supabase-js'

/** Datos mínimos del usuario autenticado que usan middleware, API routes y páginas */
export interface UsuarioSesion {
  id: string
  email?: string
}

/**
 * Obtiene el usuario de la sesión verificando el JWT LOCALMENTE (firma + expiración)
 * con getClaims(), sin round-trip a Supabase Auth en cada request. Requiere que el
 * proyecto use JWT signing keys asimétricas (ECC P-256); con el legacy secret HS256
 * getClaims() cae a una llamada de red, así que no rompe, solo no ahorra.
 *
 * Trade-off conocido: un JWT ya emitido sigue siendo válido hasta su expiración
 * (~1 h) aunque la sesión se revoque server-side. Aceptable para este uso; para
 * operaciones especialmente sensibles usar supabase.auth.getUser().
 */
export async function getUsuarioSesion(supabase: SupabaseClient): Promise<UsuarioSesion | null> {
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : undefined,
  }
}
