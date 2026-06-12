-- ─────────────────────────────────────────────────────────────
-- auditoria.sql — Registro de accesos a datos sensibles
-- Ejecutar en Supabase SQL Editor (es idempotente)
-- Primer uso: auditar accesos de admins a passwords de empleados
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auditoria_accesos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  actor_id    uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  -- Tipo de evento auditado (extensible: passwords_acceso, export_datos, etc.)
  evento      text        NOT NULL,
  -- Sobre qué recurso/usuario se actuó (nullable: no todo evento tiene target)
  target_id   uuid,
  detalle     jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_accesos_empresa
  ON auditoria_accesos(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_accesos_actor
  ON auditoria_accesos(actor_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE auditoria_accesos ENABLE ROW LEVEL SECURITY;

-- El actor solo puede insertar eventos propios, de su propia empresa
DROP POLICY IF EXISTS auditoria_insert_propio ON auditoria_accesos;
CREATE POLICY auditoria_insert_propio ON auditoria_accesos
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

-- Lectura: solo rol dev (panel interno). Los registros no se editan ni borran.
DROP POLICY IF EXISTS auditoria_select_dev ON auditoria_accesos;
CREATE POLICY auditoria_select_dev ON auditoria_accesos
  FOR SELECT TO authenticated
  USING (
    (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'dev'
  );
