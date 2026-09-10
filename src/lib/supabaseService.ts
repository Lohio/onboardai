import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────
// Cliente con service role — SOLO server-side.
// Bypassa RLS: usar únicamente en código que corre en el servidor
// (API routes, libs de servidor) y SIEMPRE filtrando explícitamente
// por empresa_id validado desde la sesión. Nunca importar en Client
// Components.
//
// Única fábrica de cliente service-role del proyecto: las API routes,
// webhooks, bots y libs de servidor la importan desde acá. La instancia
// se cachea por proceso, así que NUNCA llamar signIn*/setSession sobre
// ella (dejaría el cliente actuando como ese usuario para el resto de
// las requests del proceso).
// ─────────────────────────────────────────────

let cached: SupabaseClient | null = null

export function createServiceClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada en el servidor')
  }
  cached = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
