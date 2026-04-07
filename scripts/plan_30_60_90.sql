-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla: plan_30_60_90
-- Descripción: Ítems del plan de onboarding 30-60-90 días por empleado.
--              Incluye objetivos (checkbox), check-ins (reuniones) y logros.
-- Ejecutar en: Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plan_30_60_90 (
  id            uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id    uuid         NOT NULL REFERENCES empresas(id)  ON DELETE CASCADE,
  usuario_id    uuid         NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
  fase          text         NOT NULL CHECK (fase IN ('30', '60', '90')),
  tipo          text         NOT NULL CHECK (tipo IN ('objetivo', 'checkin', 'logro')),
  titulo        text         NOT NULL,
  descripcion   text,
  completado    boolean      NOT NULL DEFAULT false,
  completado_at timestamptz,
  fecha_target  date,
  orden         integer      NOT NULL DEFAULT 0,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS plan_30_60_90_usuario_id_idx
  ON plan_30_60_90 (usuario_id);

CREATE INDEX IF NOT EXISTS plan_30_60_90_empresa_fase_idx
  ON plan_30_60_90 (empresa_id, fase);

CREATE INDEX IF NOT EXISTS plan_30_60_90_usuario_fase_idx
  ON plan_30_60_90 (usuario_id, fase);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE plan_30_60_90 ENABLE ROW LEVEL SECURITY;

-- Empleado: lectura de sus propios ítems
CREATE POLICY "empleado_read_own_plan" ON plan_30_60_90
  FOR SELECT
  USING (auth.uid() = usuario_id);

-- Empleado: puede marcar completado (solo actualiza completado + completado_at)
CREATE POLICY "empleado_update_own_plan" ON plan_30_60_90
  FOR UPDATE
  USING  (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- Admin: CRUD completo sobre ítems de su empresa
CREATE POLICY "admin_manage_plan" ON plan_30_60_90
  FOR ALL
  USING (
    empresa_id IN (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  );
