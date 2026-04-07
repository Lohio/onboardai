-- Migración: UNIQUE constraint en encuestas_pulso
-- Previene la creación duplicada de encuestas para el mismo usuario y día
-- (race condition si dos requests llegan simultáneamente en el día de corte)
--
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- 1. Eliminar duplicados existentes (si los hay) antes de agregar la constraint
--    Conserva el registro más reciente por (usuario_id, dia)
DELETE FROM encuestas_pulso
WHERE id NOT IN (
  SELECT DISTINCT ON (usuario_id, dia) id
  FROM encuestas_pulso
  ORDER BY usuario_id, dia, created_at DESC
);

-- 2. Agregar constraint UNIQUE
ALTER TABLE encuestas_pulso
  ADD CONSTRAINT encuestas_pulso_usuario_dia_unique
  UNIQUE (usuario_id, dia);

-- 3. Índice de soporte para queries por usuario
CREATE INDEX IF NOT EXISTS idx_encuestas_pulso_usuario_dia
  ON encuestas_pulso (usuario_id, dia);
