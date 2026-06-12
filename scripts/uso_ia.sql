-- ─────────────────────────────────────────────────────────────
-- uso_ia.sql — Medición de consumo del asistente IA
-- Ejecutar en Supabase SQL Editor (es idempotente)
-- Detalle por llamada + agregado mensual para chequeo de cuota
-- ─────────────────────────────────────────────────────────────

-- ── Detalle por llamada (análisis de margen, debugging) ──────
CREATE TABLE IF NOT EXISTS uso_ia (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id            uuid        REFERENCES usuarios(id) ON DELETE SET NULL,
  -- Origen de la llamada: chat | agente | bot | reporte | resumen
  fuente                text        NOT NULL,
  modelo                text        NOT NULL,
  input_tokens          integer     NOT NULL DEFAULT 0,
  output_tokens         integer     NOT NULL DEFAULT 0,
  cache_read_tokens     integer     NOT NULL DEFAULT 0,
  cache_creation_tokens integer     NOT NULL DEFAULT 0,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uso_ia_empresa
  ON uso_ia(empresa_id, created_at DESC);

-- ── Agregado mensual (1 fila por empresa/mes — chequeo de cuota rápido) ──
CREATE TABLE IF NOT EXISTS uso_mensual_ia (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  -- Primer día del mes (ej: 2026-06-01)
  mes                date        NOT NULL,
  consultas          integer     NOT NULL DEFAULT 0,
  input_tokens       bigint      NOT NULL DEFAULT 0,
  output_tokens      bigint      NOT NULL DEFAULT 0,
  cache_read_tokens  bigint      NOT NULL DEFAULT 0,
  aviso_80_enviado   boolean     NOT NULL DEFAULT false,
  aviso_100_enviado  boolean     NOT NULL DEFAULT false,
  updated_at         timestamptz DEFAULT now(),
  UNIQUE(empresa_id, mes)
);

CREATE INDEX IF NOT EXISTS idx_uso_mensual_ia_empresa
  ON uso_mensual_ia(empresa_id, mes DESC);

-- ── RPC atómico: registra detalle + actualiza agregado ───────
-- SECURITY DEFINER para poder llamarlo con el cliente de sesión
-- (el empleado no tiene permisos directos de escritura en estas tablas).
-- p_cuenta_consulta: false para usos que no consumen cuota (reportes admin).
CREATE OR REPLACE FUNCTION registrar_uso_ia(
  p_empresa_id            uuid,
  p_usuario_id            uuid,
  p_fuente                text,
  p_modelo                text,
  p_input_tokens          integer,
  p_output_tokens         integer,
  p_cache_read_tokens     integer DEFAULT 0,
  p_cache_creation_tokens integer DEFAULT 0,
  p_cuenta_consulta       boolean DEFAULT true
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO uso_ia (
    empresa_id, usuario_id, fuente, modelo,
    input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens
  ) VALUES (
    p_empresa_id, p_usuario_id, p_fuente, p_modelo,
    p_input_tokens, p_output_tokens, p_cache_read_tokens, p_cache_creation_tokens
  );

  INSERT INTO uso_mensual_ia (empresa_id, mes, consultas, input_tokens, output_tokens, cache_read_tokens)
  VALUES (
    p_empresa_id,
    date_trunc('month', now())::date,
    CASE WHEN p_cuenta_consulta THEN 1 ELSE 0 END,
    p_input_tokens,
    p_output_tokens,
    p_cache_read_tokens
  )
  ON CONFLICT (empresa_id, mes) DO UPDATE SET
    consultas         = uso_mensual_ia.consultas + (CASE WHEN p_cuenta_consulta THEN 1 ELSE 0 END),
    input_tokens      = uso_mensual_ia.input_tokens + p_input_tokens,
    output_tokens     = uso_mensual_ia.output_tokens + p_output_tokens,
    cache_read_tokens = uso_mensual_ia.cache_read_tokens + p_cache_read_tokens,
    updated_at        = now();
END;
$$;

-- ── RPC: marcar aviso de cuota enviado (80% / 100%) ──────────
-- Retorna true solo si el flag estaba apagado (evita emails duplicados
-- ante llamadas concurrentes).
CREATE OR REPLACE FUNCTION marcar_aviso_uso_ia(
  p_empresa_id uuid,
  p_umbral     integer  -- 80 o 100
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actualizado integer;
BEGIN
  IF p_umbral = 80 THEN
    UPDATE uso_mensual_ia SET aviso_80_enviado = true, updated_at = now()
    WHERE empresa_id = p_empresa_id
      AND mes = date_trunc('month', now())::date
      AND aviso_80_enviado = false;
  ELSIF p_umbral = 100 THEN
    UPDATE uso_mensual_ia SET aviso_100_enviado = true, updated_at = now()
    WHERE empresa_id = p_empresa_id
      AND mes = date_trunc('month', now())::date
      AND aviso_100_enviado = false;
  ELSE
    RETURN false;
  END IF;

  GET DIAGNOSTICS actualizado = ROW_COUNT;
  RETURN actualizado > 0;
END;
$$;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE uso_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE uso_mensual_ia ENABLE ROW LEVEL SECURITY;

-- Lectura: admin de la propia empresa o dev. Escritura solo via RPC (definer).
DROP POLICY IF EXISTS uso_ia_select ON uso_ia;
CREATE POLICY uso_ia_select ON uso_ia
  FOR SELECT TO authenticated
  USING (
    empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('admin', 'dev')
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'dev'
  );

DROP POLICY IF EXISTS uso_mensual_ia_select ON uso_mensual_ia;
CREATE POLICY uso_mensual_ia_select ON uso_mensual_ia
  FOR SELECT TO authenticated
  USING (
    empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'dev'
  );
