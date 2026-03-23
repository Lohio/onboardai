-- ─────────────────────────────────────────────
-- Tabla api_keys — autenticación de empresas externas via API Keys
-- Las keys se almacenan como hash SHA-256, nunca en texto plano
-- ─────────────────────────────────────────────

CREATE TABLE api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,         -- SHA-256 de la key completa
  key_prefix TEXT NOT NULL,              -- primeros 8 chars para identificación en UI
  scopes TEXT[] NOT NULL DEFAULT '{}',
  rate_limit INT NOT NULL DEFAULT 1000,  -- requests/día
  activa BOOLEAN NOT NULL DEFAULT true,
  last_used TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,               -- NULL = no expira
  created_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para lookup por hash (el caso más frecuente en verificación)
CREATE INDEX api_keys_key_hash_idx ON api_keys(key_hash) WHERE activa = true;

-- RLS: solo service role puede leer/escribir (las API keys se verifican server-side)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
-- Sin políticas explícitas = solo service role accede
