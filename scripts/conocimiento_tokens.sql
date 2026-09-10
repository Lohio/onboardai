-- ─────────────────────────────────────────────────────────────
-- conocimiento_tokens.sql — Estimación de tokens por bloque de conocimiento
-- Ejecutar en Supabase SQL Editor (es idempotente)
-- Habilita que el asistente IA decida el modo (inline vs búsqueda) con una
-- query liviana de metadata, sin bajar contenido + contenido_extraido de
-- TODOS los bloques en cada turno (ver buildSystemPromptWithConfig en
-- src/lib/claude.ts). Sin esta migración el código cae al comportamiento
-- anterior con un console.warn.
-- Requiere: conocimiento_fts.sql (columna contenido_extraido).
-- ─────────────────────────────────────────────────────────────

-- Misma heurística que estimarTokens() en claude.ts: ~3.5 chars/token en español
ALTER TABLE conocimiento
  ADD COLUMN IF NOT EXISTS tokens_estimados integer
  GENERATED ALWAYS AS (
    ceil((length(coalesce(contenido, '')) + length(coalesce(contenido_extraido, ''))) / 3.5)
  ) STORED;

-- Índice por empresa_id para el filtro de la query de índice.
-- contenido_capas.sql ya crea idx_conocimiento_capas(empresa_id, area, puesto),
-- cuya columna inicial sirve; solo se crea uno simple si no hay ninguno que arranque
-- en empresa_id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'conocimiento'
      AND indexdef ~ '\(empresa_id[,)]'
  ) THEN
    CREATE INDEX idx_conocimiento_empresa ON conocimiento(empresa_id);
  END IF;
END $$;
