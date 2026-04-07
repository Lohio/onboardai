-- ─────────────────────────────────────────────────────────────
-- rls_gaps.sql — Tablas faltantes + políticas RLS incompletas
-- Ejecutar en Supabase SQL Editor (es idempotente)
-- Complementa roles.sql — no lo reemplaza
-- ─────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════
-- 1. CREAR TABLAS FALTANTES
-- ══════════════════════════════════════════════════════════════

-- conversaciones_ia
CREATE TABLE IF NOT EXISTS conversaciones_ia (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid        NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
  empresa_id  uuid        NOT NULL REFERENCES empresas(id)  ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversaciones_ia_usuario
  ON conversaciones_ia(usuario_id, created_at DESC);

-- mensajes_ia
CREATE TABLE IF NOT EXISTS mensajes_ia (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id  uuid        NOT NULL REFERENCES conversaciones_ia(id) ON DELETE CASCADE,
  rol              text        NOT NULL CHECK (rol IN ('user', 'assistant')),
  contenido        text        NOT NULL,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_ia_conversacion
  ON mensajes_ia(conversacion_id, created_at ASC);

-- alertas_conocimiento
CREATE TABLE IF NOT EXISTS alertas_conocimiento (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid        NOT NULL REFERENCES empresas(id)  ON DELETE CASCADE,
  usuario_id  uuid        NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
  pregunta    text        NOT NULL,
  resuelta    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_empresa
  ON alertas_conocimiento(empresa_id, resuelta, created_at DESC);

-- equipo_relaciones
CREATE TABLE IF NOT EXISTS equipo_relaciones (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid        NOT NULL REFERENCES empresas(id)  ON DELETE CASCADE,
  empleado_id  uuid        NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
  relacionado_id uuid      NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
  tipo         text        NOT NULL CHECK (tipo IN ('manager', 'buddy', 'companero')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE(empleado_id, relacionado_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_equipo_empleado
  ON equipo_relaciones(empleado_id);

-- encuestas_pulso (en roles.sql sección 13, pero puede no haberse ejecutado)
CREATE TABLE IF NOT EXISTS encuestas_pulso (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid        REFERENCES empresas(id)  ON DELETE CASCADE,
  usuario_id      uuid        REFERENCES usuarios(id)  ON DELETE CASCADE,
  dia_onboarding  integer     NOT NULL,
  pregunta_1      text        NOT NULL,
  respuesta_1     integer     CHECK (respuesta_1 BETWEEN 1 AND 5),
  pregunta_2      text        NOT NULL,
  respuesta_2     integer     CHECK (respuesta_2 BETWEEN 1 AND 5),
  pregunta_3      text        NOT NULL,
  respuesta_3     integer     CHECK (respuesta_3 BETWEEN 1 AND 5),
  comentario      text,
  completada      boolean     NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  respondida_at   timestamptz
);


-- ══════════════════════════════════════════════════════════════
-- 2. HABILITAR RLS EN TODAS LAS TABLAS NUEVAS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE conversaciones_ia    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes_ia          ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_conocimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipo_relaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE encuestas_pulso      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits          ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════
-- 3. progreso_modulos — falta UPDATE para empleado
--    UPSERT del chat requiere INSERT + UPDATE
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "progreso_empleado_update" ON progreso_modulos;

CREATE POLICY "progreso_empleado_update" ON progreso_modulos
  FOR UPDATE
  USING  (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());


-- ══════════════════════════════════════════════════════════════
-- 4. encuestas_pulso — políticas completas
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "encuestas_empleado_select" ON encuestas_pulso;
DROP POLICY IF EXISTS "encuestas_empleado_update" ON encuestas_pulso;
DROP POLICY IF EXISTS "encuestas_empleado_insert" ON encuestas_pulso;
DROP POLICY IF EXISTS "encuestas_admin_select"    ON encuestas_pulso;
DROP POLICY IF EXISTS "encuestas_dev_all"         ON encuestas_pulso;

CREATE POLICY "encuestas_empleado_select" ON encuestas_pulso
  FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "encuestas_empleado_insert" ON encuestas_pulso
  FOR INSERT WITH CHECK (
    usuario_id = auth.uid()
    AND empresa_id = get_my_empresa_id()
  );

CREATE POLICY "encuestas_empleado_update" ON encuestas_pulso
  FOR UPDATE
  USING  (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "encuestas_admin_select" ON encuestas_pulso
  FOR SELECT USING (
    get_my_rol() IN ('admin', 'dev')
    AND empresa_id = get_my_empresa_id()
  );

CREATE POLICY "encuestas_dev_all" ON encuestas_pulso
  FOR ALL
  USING  (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');


-- ══════════════════════════════════════════════════════════════
-- 5. conversaciones_ia — políticas
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "conversaciones_empleado_select" ON conversaciones_ia;
DROP POLICY IF EXISTS "conversaciones_empleado_insert" ON conversaciones_ia;
DROP POLICY IF EXISTS "conversaciones_empleado_update" ON conversaciones_ia;
DROP POLICY IF EXISTS "conversaciones_admin_select"    ON conversaciones_ia;
DROP POLICY IF EXISTS "conversaciones_dev_all"         ON conversaciones_ia;

CREATE POLICY "conversaciones_empleado_select" ON conversaciones_ia
  FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "conversaciones_empleado_insert" ON conversaciones_ia
  FOR INSERT WITH CHECK (
    usuario_id = auth.uid()
    AND empresa_id = get_my_empresa_id()
  );

CREATE POLICY "conversaciones_empleado_update" ON conversaciones_ia
  FOR UPDATE
  USING  (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "conversaciones_admin_select" ON conversaciones_ia
  FOR SELECT USING (
    get_my_rol() = 'admin'
    AND usuario_id IN (
      SELECT id FROM usuarios WHERE empresa_id = get_my_empresa_id()
    )
  );

CREATE POLICY "conversaciones_dev_all" ON conversaciones_ia
  FOR ALL
  USING  (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');


-- ══════════════════════════════════════════════════════════════
-- 6. mensajes_ia — políticas (via conversacion_id)
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "mensajes_ia_empleado_select" ON mensajes_ia;
DROP POLICY IF EXISTS "mensajes_ia_empleado_insert" ON mensajes_ia;
DROP POLICY IF EXISTS "mensajes_ia_admin_select"    ON mensajes_ia;
DROP POLICY IF EXISTS "mensajes_ia_dev_all"         ON mensajes_ia;

CREATE POLICY "mensajes_ia_empleado_select" ON mensajes_ia
  FOR SELECT USING (
    conversacion_id IN (
      SELECT id FROM conversaciones_ia WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY "mensajes_ia_empleado_insert" ON mensajes_ia
  FOR INSERT WITH CHECK (
    conversacion_id IN (
      SELECT id FROM conversaciones_ia WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY "mensajes_ia_admin_select" ON mensajes_ia
  FOR SELECT USING (
    get_my_rol() = 'admin'
    AND conversacion_id IN (
      SELECT c.id FROM conversaciones_ia c
      JOIN usuarios u ON u.id = c.usuario_id
      WHERE u.empresa_id = get_my_empresa_id()
    )
  );

CREATE POLICY "mensajes_ia_dev_all" ON mensajes_ia
  FOR ALL
  USING  (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');


-- ══════════════════════════════════════════════════════════════
-- 7. alertas_conocimiento — políticas
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "alertas_empleado_insert" ON alertas_conocimiento;
DROP POLICY IF EXISTS "alertas_empleado_select" ON alertas_conocimiento;
DROP POLICY IF EXISTS "alertas_admin_all"        ON alertas_conocimiento;
DROP POLICY IF EXISTS "alertas_dev_all"          ON alertas_conocimiento;

CREATE POLICY "alertas_empleado_insert" ON alertas_conocimiento
  FOR INSERT WITH CHECK (
    usuario_id = auth.uid()
    AND empresa_id = get_my_empresa_id()
  );

CREATE POLICY "alertas_empleado_select" ON alertas_conocimiento
  FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "alertas_admin_all" ON alertas_conocimiento
  FOR ALL
  USING (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  )
  WITH CHECK (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  );

CREATE POLICY "alertas_dev_all" ON alertas_conocimiento
  FOR ALL
  USING  (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');


-- ══════════════════════════════════════════════════════════════
-- 8. equipo_relaciones — políticas
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "equipo_empleado_select" ON equipo_relaciones;
DROP POLICY IF EXISTS "equipo_admin_all"        ON equipo_relaciones;
DROP POLICY IF EXISTS "equipo_dev_all"          ON equipo_relaciones;

CREATE POLICY "equipo_empleado_select" ON equipo_relaciones
  FOR SELECT USING (empleado_id = auth.uid());

CREATE POLICY "equipo_admin_all" ON equipo_relaciones
  FOR ALL
  USING (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  )
  WITH CHECK (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  );

CREATE POLICY "equipo_dev_all" ON equipo_relaciones
  FOR ALL
  USING  (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');


-- ══════════════════════════════════════════════════════════════
-- 9. rate_limits — solo service role (sin políticas = bloqueado)
-- ══════════════════════════════════════════════════════════════
-- Sin políticas explícitas = solo service role accede.
-- El RPC increment_rate_limit es SECURITY DEFINER, no necesita política.


-- ══════════════════════════════════════════════════════════════
-- VERIFICACIÓN — descomentar y ejecutar para confirmar
-- ══════════════════════════════════════════════════════════════

/*
SELECT
  tablename,
  rowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename) AS policies
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN (
    'usuarios', 'empresas', 'conocimiento', 'tareas_onboarding',
    'progreso_modulos', 'app_config', 'mensajes_chat',
    'herramientas_rol', 'objetivos_rol', 'encuestas_pulso',
    'accesos_herramientas', 'bot_vinculaciones', 'api_keys',
    'conversaciones_ia', 'mensajes_ia', 'alertas_conocimiento',
    'equipo_relaciones', 'rate_limits'
  )
ORDER BY tablename;
*/
