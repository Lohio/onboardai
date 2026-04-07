import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withHandler } from '@/lib/api/withHandler'
import { crearApiKeySchema } from '@/lib/schemas/admin'
import { generateApiKey, hashApiKey } from '@/lib/api/apiKeys'
import { ApiError } from '@/lib/errors'

// ─────────────────────────────────────────────
// GET /api/admin/api-keys
// Lista las API keys de la empresa (sin key_hash)
// ─────────────────────────────────────────────

export const GET = withHandler(
  {
    auth: 'session',
    rol: ['admin', 'dev'],
    bodyType: 'none',
  },
  async ({ user }) => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return ApiError.internal()
    }

    const sa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // dev puede ver todas las keys; admin solo las de su empresa
    let query = sa
      .from('api_keys')
      .select('id, nombre, key_prefix, scopes, rate_limit, activa, last_used, expires_at, created_at, created_by')
      .order('created_at', { ascending: false })

    if (user!.rol !== 'dev') {
      query = query.eq('empresa_id', user!.empresaId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[GET api-keys] Error consultando:', error)
      return ApiError.internal()
    }

    return NextResponse.json({ keys: data ?? [] })
  }
)

// ─────────────────────────────────────────────
// POST /api/admin/api-keys
// Crea una nueva API key — retorna la key completa UNA sola vez
// ─────────────────────────────────────────────

export const POST = withHandler(
  {
    auth: 'session',
    rol: ['admin', 'dev'],
    schema: crearApiKeySchema,
  },
  async ({ body, user }) => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return ApiError.internal()
    }

    const sa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Generar y hashear la key
    const rawKey = generateApiKey()
    const keyHash = hashApiKey(rawKey)
    const keyPrefix = rawKey.slice(0, 12) // "oai_live_a1b"

    // Calcular fecha de expiración
    let expiresAt: string | null = null
    if (body.expiresInDays) {
      const d = new Date()
      d.setDate(d.getDate() + body.expiresInDays)
      expiresAt = d.toISOString()
    }

    const { data, error } = await sa
      .from('api_keys')
      .insert({
        empresa_id: user!.empresaId,
        nombre: body.nombre,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: body.scopes,
        rate_limit: 100, // valor por defecto
        activa: true,
        expires_at: expiresAt,
        created_by: user!.id,
      })
      .select('id, nombre, key_prefix, scopes, rate_limit, activa, last_used, expires_at, created_at')
      .single()

    if (error) {
      console.error('[POST api-keys] Error creando key:', error)
      return ApiError.internal()
    }

    // La key completa se retorna UNA SOLA VEZ aquí
    return NextResponse.json({ key: rawKey, record: data }, { status: 201 })
  }
)
