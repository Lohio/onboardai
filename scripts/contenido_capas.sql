-- Migración: capas de contenido por área, rol y notas del manager
-- Ejecutar en Supabase SQL Editor

ALTER TABLE conocimiento
  ADD COLUMN IF NOT EXISTS area   TEXT,
  ADD COLUMN IF NOT EXISTS puesto TEXT;

CREATE INDEX IF NOT EXISTS idx_conocimiento_capas
  ON conocimiento(empresa_id, area, puesto);

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS notas_ia TEXT;

-- Los registros existentes quedan con area=NULL y puesto=NULL → capa empresa (sin cambios)
