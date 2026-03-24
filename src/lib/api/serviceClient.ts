// ─────────────────────────────────────────────
// serviceClient.ts — Cliente Supabase con service role para la API pública /api/v1/*
// Bypasea RLS; usar solo en rutas de servidor que ya validaron la API key.
// ─────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

// Crea cliente Supabase con service role (necesario para bypassear RLS en API pública)
export function makeServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
