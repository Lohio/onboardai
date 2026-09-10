-- ─────────────────────────────────────────────────────────────
-- indices_rendimiento.sql — Índices para los patrones de query más
-- frecuentes de la app (detectados en auditoría de rendimiento)
-- Ejecutar en Supabase SQL Editor (idempotente y a prueba de drift:
-- cada índice se crea solo si la tabla y sus columnas existen)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION crear_indice_si_existe(
  p_indice  text,
  p_tabla   text,
  p_cols    text[]
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  c text;
BEGIN
  IF to_regclass(p_tabla) IS NULL THEN
    RETURN p_indice || ': omitido (tabla ' || p_tabla || ' no existe)';
  END IF;
  FOREACH c IN ARRAY p_cols LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = p_tabla AND column_name = c
    ) THEN
      RETURN p_indice || ': omitido (columna ' || c || ' no existe)';
    END IF;
  END LOOP;
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (%s)',
    p_indice, p_tabla, array_to_string(p_cols, ', ')
  );
  RETURN p_indice || ': ok';
END;
$$;

-- Progreso por empleado y módulo (cultura, home, chat upsert, reportes)
SELECT crear_indice_si_existe('idx_progreso_modulos_usuario_modulo', 'progreso_modulos', ARRAY['usuario_id','modulo']);
-- Tareas por empleado (rol, reportes, detalle admin)
SELECT crear_indice_si_existe('idx_tareas_onboarding_usuario',        'tareas_onboarding', ARRAY['usuario_id']);
-- Usuarios por empresa y rol (dashboard, lista, helpers RLS get_my_rol)
SELECT crear_indice_si_existe('idx_usuarios_empresa_rol',             'usuarios',          ARRAY['empresa_id','rol']);
-- Conocimiento por empresa ordenado por módulo (system prompt del asistente)
SELECT crear_indice_si_existe('idx_conocimiento_empresa_modulo',      'conocimiento',      ARRAY['empresa_id','modulo']);
-- Herramientas y objetivos del rol por empresa
SELECT crear_indice_si_existe('idx_herramientas_rol_empresa',         'herramientas_rol',  ARRAY['empresa_id']);
SELECT crear_indice_si_existe('idx_objetivos_rol_empresa',            'objetivos_rol',     ARRAY['empresa_id']);
-- Accesos por empleado
SELECT crear_indice_si_existe('idx_accesos_herramientas_usuario',     'accesos_herramientas', ARRAY['usuario_id']);
-- Encuestas por empresa (reporte admin) — el índice por usuario ya existe
SELECT crear_indice_si_existe('idx_encuestas_pulso_empresa',          'encuestas_pulso',   ARRAY['empresa_id']);
-- Mensajes IA por fecha (métricas 24h / 7 días del panel dev)
SELECT crear_indice_si_existe('idx_mensajes_ia_created_at',           'mensajes_ia',       ARRAY['created_at']);

-- Cada SELECT de arriba devuelve una línea 'nombre: ok' u 'omitido (...)'
