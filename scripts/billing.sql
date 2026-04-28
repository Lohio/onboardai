-- ─────────────────────────────────────────────────────────────────────────────
-- billing.sql — Schema para suscripciones y pagos
-- Ejecutar en Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Columnas en tabla empresas
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS plan              TEXT    NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS plan_empleados    INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_subscription_id     TEXT,
  ADD COLUMN IF NOT EXISTS suscripcion_estado     TEXT    NOT NULL DEFAULT 'activa',
  ADD COLUMN IF NOT EXISTS suscripcion_inicio      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suscripcion_fin         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proveedor_pago          TEXT    DEFAULT 'stripe';

-- 2. Tabla historial de pagos
CREATE TABLE IF NOT EXISTS pagos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  proveedor        TEXT NOT NULL,          -- 'stripe' | 'mercadopago'
  proveedor_pago_id TEXT,                  -- charge/payment id externo
  monto            NUMERIC(10,2) NOT NULL,
  moneda           TEXT NOT NULL DEFAULT 'usd',
  estado           TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | completado | fallido | reembolsado
  plan             TEXT,
  descripcion      TEXT,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_pagos_empresa ON pagos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresas_stripe_customer ON empresas(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_empresas_mp_sub ON empresas(mp_subscription_id) WHERE mp_subscription_id IS NOT NULL;

-- 4. RLS
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas (idempotente)
DROP POLICY IF EXISTS pagos_dev_select ON pagos;
DROP POLICY IF EXISTS pagos_admin_select ON pagos;
DROP POLICY IF EXISTS pagos_service_insert ON pagos;
-- Nombres alternativos de versiones anteriores
DROP POLICY IF EXISTS billing_dev_select ON pagos;
DROP POLICY IF EXISTS billing_admin_select ON pagos;
DROP POLICY IF EXISTS billing_service_insert ON pagos;
-- Por si existía tabla billing_history
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'billing_history') THEN
    DROP POLICY IF EXISTS billing_admin_select ON billing_history;
    DROP POLICY IF EXISTS billing_dev_select ON billing_history;
    DROP POLICY IF EXISTS billing_service_insert ON billing_history;
  END IF;
END $$;

-- Solo dev puede leer todos los pagos
CREATE POLICY pagos_dev_select ON pagos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.rol = 'dev'
    )
  );

-- Admin puede leer pagos de su empresa
CREATE POLICY pagos_admin_select ON pagos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.rol = 'admin' AND u.empresa_id = pagos.empresa_id
    )
  );

-- Solo service role puede insertar (desde webhooks)
CREATE POLICY pagos_service_insert ON pagos FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
