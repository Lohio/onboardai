-- ─────────────────────────────────────────────────────────────
-- pagos_idempotencia.sql — Dedup de webhooks de pago
-- Ejecutar en Supabase SQL Editor (es idempotente)
-- Stripe y MercadoPago reentregan webhooks: sin esto, cada
-- reintento duplica la fila en `pagos`.
-- ─────────────────────────────────────────────────────────────

-- NULLs siguen permitidos (pagos sin id externo no se deduplican)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagos_proveedor_pago_id
  ON pagos(proveedor, proveedor_pago_id);
