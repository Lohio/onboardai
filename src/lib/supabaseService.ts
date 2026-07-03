import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────
// Cliente con service role — SOLO server-side.
// Bypassa RLS: usar únicamente en código que corre en el servidor
// (API routes, libs de servidor) y SIEMPRE filtrando explícitamente
// por empresa_id validado desde la sesión. Nunca importar en Client
// Components.
//
// Necesario porque las lecturas de conocimiento/empresas/app_config
// desde el asistente IA corren server-side sin cookies de sesión: un
// cliente anon tendría auth.uid() = NULL y RLS devolvería vacío.
// ─────────────────────────────────────────────

let cached: SupabaseClient | null = null

export function createServiceClient(): SupabaseClient {
  if (cached) return cached
  cached = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  return cached
}
