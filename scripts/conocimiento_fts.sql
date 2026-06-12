-- ─────────────────────────────────────────────────────────────
-- conocimiento_fts.sql — Texto extraído de archivos + búsqueda full-text
-- Ejecutar en Supabase SQL Editor (es idempotente)
-- Habilita: (1) que los PDFs/DOCX nutran al agente IA,
--           (2) búsqueda FTS para bases de conocimiento grandes
-- ─────────────────────────────────────────────────────────────

-- Texto extraído del archivo subido (PDF/DOCX) — lo llena el upload
ALTER TABLE conocimiento
  ADD COLUMN IF NOT EXISTS contenido_extraido TEXT;

-- Columna generada con el vector FTS en español sobre todo el texto del bloque
ALTER TABLE conocimiento
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(contenido, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(contenido_extraido, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_conocimiento_fts
  ON conocimiento USING gin(fts);

-- ── RPC de búsqueda para el agente IA ────────────────────────
-- SECURITY DEFINER: el agente busca server-side con el empresa_id
-- ya validado por la API (mismo nivel de confianza que la query
-- actual de buildSystemPrompt).
CREATE OR REPLACE FUNCTION buscar_conocimiento(
  p_empresa_id uuid,
  p_query      text,
  p_limit      integer DEFAULT 5
) RETURNS TABLE (
  modulo             text,
  titulo             text,
  contenido          text,
  contenido_extraido text,
  area               text,
  puesto             text,
  rank               real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.modulo,
    c.titulo,
    c.contenido,
    c.contenido_extraido,
    c.area,
    c.puesto,
    ts_rank(c.fts, websearch_to_tsquery('spanish', p_query)) AS rank
  FROM conocimiento c
  WHERE c.empresa_id = p_empresa_id
    AND c.fts @@ websearch_to_tsquery('spanish', p_query)
  ORDER BY rank DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 10);
$$;
