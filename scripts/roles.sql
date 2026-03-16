-- ─────────────────────────────────────────────────────────────
-- OnboardAI: Políticas RLS completas por rol
-- Roles: empleado | admin | dev
-- Ejecutar en el SQL Editor de Supabase (es idempotente, se puede re-ejecutar)
-- ─────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════
-- 0. COLUMNA ROL
-- ══════════════════════════════════════════════════════════════

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol TEXT NOT NULL DEFAULT 'empleado'
  CHECK (rol IN ('empleado', 'admin', 'dev'));


-- ══════════════════════════════════════════════════════════════
-- 1. FUNCIONES HELPER (SECURITY DEFINER)
--    Evitan recursión infinita al leer la tabla usuarios dentro
--    de sus propias políticas RLS.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_my_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT empresa_id FROM usuarios WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_rol()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT rol FROM usuarios WHERE id = auth.uid() LIMIT 1;
$$;


-- ══════════════════════════════════════════════════════════════
-- 2. HABILITAR RLS EN TODAS LAS TABLAS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE conocimiento        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas_onboarding   ENABLE ROW LEVEL SECURITY;
ALTER TABLE progreso_modulos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes_chat       ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════
-- 3. TABLA: usuarios
-- ══════════════════════════════════════════════════════════════

-- Limpiar políticas previas
DROP POLICY IF EXISTS "usuarios_empleado_select"  ON usuarios;
DROP POLICY IF EXISTS "usuarios_empleado_update"  ON usuarios;
DROP POLICY IF EXISTS "usuarios_admin_select"     ON usuarios;
DROP POLICY IF EXISTS "usuarios_admin_insert"     ON usuarios;
DROP POLICY IF EXISTS "usuarios_admin_update"     ON usuarios;
DROP POLICY IF EXISTS "usuarios_dev_all"          ON usuarios;

-- Empleado: solo ve su propia fila
CREATE POLICY "usuarios_empleado_select" ON usuarios
  FOR SELECT USING (
    id = auth.uid()
  );

-- Empleado: puede actualizar su propia fila (nombre, foto, etc.)
CREATE POLICY "usuarios_empleado_update" ON usuarios
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin: ve todos los usuarios de su empresa
CREATE POLICY "usuarios_admin_select" ON usuarios
  FOR SELECT USING (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  );

-- Admin: puede crear usuarios en su empresa (sin poder asignar rol 'dev')
CREATE POLICY "usuarios_admin_insert" ON usuarios
  FOR INSERT
  WITH CHECK (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
    AND rol <> 'dev'
  );

-- Admin: puede modificar usuarios de su empresa, pero no puede escalar rol a 'dev'
CREATE POLICY "usuarios_admin_update" ON usuarios
  FOR UPDATE
  USING (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  )
  WITH CHECK (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
    AND rol <> 'dev'
  );

-- Dev: acceso total sin restricciones
CREATE POLICY "usuarios_dev_all" ON usuarios
  FOR ALL
  USING (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');


-- ══════════════════════════════════════════════════════════════
-- 4. TABLA: conocimiento
--    Contiene el contenido institucional que nutre la IA (M1, M2, M3)
-- ══════════════════════════════════════════════════════════════

-- Limpiar políticas previas
DROP POLICY IF EXISTS "conocimiento_empleado_select" ON conocimiento;
DROP POLICY IF EXISTS "conocimiento_admin_select"    ON conocimiento;
DROP POLICY IF EXISTS "conocimiento_admin_insert"    ON conocimiento;
DROP POLICY IF EXISTS "conocimiento_admin_update"    ON conocimiento;
DROP POLICY IF EXISTS "conocimiento_admin_delete"    ON conocimiento;
DROP POLICY IF EXISTS "conocimiento_dev_all"         ON conocimiento;

-- Empleado: solo lectura del contenido de su empresa
CREATE POLICY "conocimiento_empleado_select" ON conocimiento
  FOR SELECT USING (
    empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

-- Admin: lectura del contenido de su empresa
CREATE POLICY "conocimiento_admin_select" ON conocimiento
  FOR SELECT USING (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  );

-- Admin: puede agregar contenido a su empresa
CREATE POLICY "conocimiento_admin_insert" ON conocimiento
  FOR INSERT
  WITH CHECK (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  );

-- Admin: puede editar contenido de su empresa
CREATE POLICY "conocimiento_admin_update" ON conocimiento
  FOR UPDATE
  USING (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  )
  WITH CHECK (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  );

-- Admin: puede eliminar contenido de su empresa
CREATE POLICY "conocimiento_admin_delete" ON conocimiento
  FOR DELETE USING (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  );

-- Dev: acceso total a todas las empresas
CREATE POLICY "conocimiento_dev_all" ON conocimiento
  FOR ALL
  USING (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');


-- ══════════════════════════════════════════════════════════════
-- 5. TABLA: tareas_onboarding
-- ══════════════════════════════════════════════════════════════

-- Limpiar políticas previas
DROP POLICY IF EXISTS "tareas_empleado_select"  ON tareas_onboarding;
DROP POLICY IF EXISTS "tareas_empleado_update"  ON tareas_onboarding;
DROP POLICY IF EXISTS "tareas_admin_select"     ON tareas_onboarding;
DROP POLICY IF EXISTS "tareas_admin_insert"     ON tareas_onboarding;
DROP POLICY IF EXISTS "tareas_admin_update"     ON tareas_onboarding;
DROP POLICY IF EXISTS "tareas_admin_delete"     ON tareas_onboarding;
DROP POLICY IF EXISTS "tareas_dev_all"          ON tareas_onboarding;

-- Empleado: ve sus propias tareas
CREATE POLICY "tareas_empleado_select" ON tareas_onboarding
  FOR SELECT USING (
    usuario_id = auth.uid()
  );

-- Empleado: puede marcar sus tareas como completadas (solo campo 'completada')
-- La restricción de campo se maneja en la app; aquí solo limitamos la fila
CREATE POLICY "tareas_empleado_update" ON tareas_onboarding
  FOR UPDATE
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Admin: ve todas las tareas de empleados de su empresa
CREATE POLICY "tareas_admin_select" ON tareas_onboarding
  FOR SELECT USING (
    get_my_rol() = 'admin'
    AND usuario_id IN (
      SELECT id FROM usuarios
      WHERE empresa_id = get_my_empresa_id()
    )
  );

-- Admin: puede crear tareas para empleados de su empresa
CREATE POLICY "tareas_admin_insert" ON tareas_onboarding
  FOR INSERT
  WITH CHECK (
    get_my_rol() = 'admin'
    AND usuario_id IN (
      SELECT id FROM usuarios
      WHERE empresa_id = get_my_empresa_id()
    )
  );

-- Admin: puede modificar tareas de empleados de su empresa
CREATE POLICY "tareas_admin_update" ON tareas_onboarding
  FOR UPDATE
  USING (
    get_my_rol() = 'admin'
    AND usuario_id IN (
      SELECT id FROM usuarios
      WHERE empresa_id = get_my_empresa_id()
    )
  )
  WITH CHECK (
    get_my_rol() = 'admin'
    AND usuario_id IN (
      SELECT id FROM usuarios
      WHERE empresa_id = get_my_empresa_id()
    )
  );

-- Admin: puede eliminar tareas de empleados de su empresa
CREATE POLICY "tareas_admin_delete" ON tareas_onboarding
  FOR DELETE USING (
    get_my_rol() = 'admin'
    AND usuario_id IN (
      SELECT id FROM usuarios
      WHERE empresa_id = get_my_empresa_id()
    )
  );

-- Dev: acceso total
CREATE POLICY "tareas_dev_all" ON tareas_onboarding
  FOR ALL
  USING (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');


-- ══════════════════════════════════════════════════════════════
-- 6. TABLA: progreso_modulos
-- ══════════════════════════════════════════════════════════════

-- Limpiar políticas previas
DROP POLICY IF EXISTS "progreso_empleado_select"    ON progreso_modulos;
DROP POLICY IF EXISTS "progreso_empleado_write"     ON progreso_modulos;
DROP POLICY IF EXISTS "progreso_admin_select"       ON progreso_modulos;
DROP POLICY IF EXISTS "progreso_admin_delete"       ON progreso_modulos;
DROP POLICY IF EXISTS "progreso_dev_all"            ON progreso_modulos;

-- Empleado: ve su propio progreso
CREATE POLICY "progreso_empleado_select" ON progreso_modulos
  FOR SELECT USING (
    usuario_id = auth.uid()
  );

-- Empleado: puede registrar e actualizar su propio progreso
CREATE POLICY "progreso_empleado_write" ON progreso_modulos
  FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

-- Nota: UPDATE de progreso propio también está permitido vía la política de empleado_select + trigger,
-- o se puede agregar una política UPDATE separada si es necesario:
-- CREATE POLICY "progreso_empleado_update" ON progreso_modulos
--   FOR UPDATE USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

-- Admin: ve el progreso de todos los empleados de su empresa
CREATE POLICY "progreso_admin_select" ON progreso_modulos
  FOR SELECT USING (
    get_my_rol() = 'admin'
    AND usuario_id IN (
      SELECT id FROM usuarios
      WHERE empresa_id = get_my_empresa_id()
    )
  );

-- Admin: puede resetear (eliminar) el progreso de empleados de su empresa
CREATE POLICY "progreso_admin_delete" ON progreso_modulos
  FOR DELETE USING (
    get_my_rol() = 'admin'
    AND usuario_id IN (
      SELECT id FROM usuarios
      WHERE empresa_id = get_my_empresa_id()
    )
  );

-- Dev: acceso total
CREATE POLICY "progreso_dev_all" ON progreso_modulos
  FOR ALL
  USING (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');


-- ══════════════════════════════════════════════════════════════
-- 7. TABLA: app_config
--    Configuración global de la aplicación.
--    Solo dev puede acceder — ni empleado ni admin tienen permisos.
-- ══════════════════════════════════════════════════════════════

-- Limpiar políticas previas
DROP POLICY IF EXISTS "app_config_dev_select" ON app_config;
DROP POLICY IF EXISTS "app_config_dev_insert" ON app_config;
DROP POLICY IF EXISTS "app_config_dev_update" ON app_config;

-- Dev: puede leer la configuración global
CREATE POLICY "app_config_dev_select" ON app_config
  FOR SELECT USING (
    get_my_rol() = 'dev'
  );

-- Dev: puede insertar nuevas entradas de configuración
CREATE POLICY "app_config_dev_insert" ON app_config
  FOR INSERT
  WITH CHECK (get_my_rol() = 'dev');

-- Dev: puede modificar la configuración existente
CREATE POLICY "app_config_dev_update" ON app_config
  FOR UPDATE
  USING (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');


-- ══════════════════════════════════════════════════════════════
-- 8. TABLA: mensajes_chat
--    Historial de conversaciones con el asistente IA (M4)
-- ══════════════════════════════════════════════════════════════

-- Limpiar políticas previas
DROP POLICY IF EXISTS "mensajes_empleado_select" ON mensajes_chat;
DROP POLICY IF EXISTS "mensajes_empleado_insert" ON mensajes_chat;
DROP POLICY IF EXISTS "mensajes_admin_select"    ON mensajes_chat;
DROP POLICY IF EXISTS "mensajes_dev_all"         ON mensajes_chat;

-- Empleado: ve solo sus propios mensajes
CREATE POLICY "mensajes_empleado_select" ON mensajes_chat
  FOR SELECT USING (
    usuario_id = auth.uid()
  );

-- Empleado: puede enviar sus propios mensajes
CREATE POLICY "mensajes_empleado_insert" ON mensajes_chat
  FOR INSERT
  WITH CHECK (usuario_id = auth.uid());

-- Admin: puede leer los mensajes de todos los empleados de su empresa
--        (útil para monitorear qué preguntan y detectar problemas)
CREATE POLICY "mensajes_admin_select" ON mensajes_chat
  FOR SELECT USING (
    get_my_rol() = 'admin'
    AND usuario_id IN (
      SELECT id FROM usuarios
      WHERE empresa_id = get_my_empresa_id()
    )
  );

-- Dev: acceso total
CREATE POLICY "mensajes_dev_all" ON mensajes_chat
  FOR ALL
  USING (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');


-- ══════════════════════════════════════════════════════════════
-- 9. TABLA: empresas
--    Cualquier usuario autenticado puede leer su propia empresa.
--    Solo admin/dev pueden actualizar.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresas_select"       ON empresas;
DROP POLICY IF EXISTS "empresas_admin_update" ON empresas;
DROP POLICY IF EXISTS "empresas_dev_all"      ON empresas;

-- Todos los roles: leen su propia empresa
CREATE POLICY "empresas_select" ON empresas
  FOR SELECT USING (id = get_my_empresa_id());

-- Admin: puede actualizar datos de su empresa
CREATE POLICY "empresas_admin_update" ON empresas
  FOR UPDATE
  USING  (get_my_rol() IN ('admin', 'dev') AND id = get_my_empresa_id())
  WITH CHECK (get_my_rol() IN ('admin', 'dev') AND id = get_my_empresa_id());

-- Dev: acceso total
CREATE POLICY "empresas_dev_all" ON empresas
  FOR ALL
  USING  (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');


-- ══════════════════════════════════════════════════════════════
-- 10. MIGRACIONES: columnas del perfil de empleado
-- ══════════════════════════════════════════════════════════════

-- Modalidad de trabajo (columna canónica: modalidad)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS modalidad TEXT
  CHECK (modalidad IN ('presencial', 'hibrido', 'remoto'));

-- Biografía / descripción personal editable por el empleado
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Contactos IT y RRHH por empleado (cada empleado puede tener sus propios contactos asignados)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS contacto_it_nombre   TEXT,
  ADD COLUMN IF NOT EXISTS contacto_it_email    TEXT,
  ADD COLUMN IF NOT EXISTS contacto_rrhh_nombre TEXT,
  ADD COLUMN IF NOT EXISTS contacto_rrhh_email  TEXT;

-- Herramienta de comunicación configurada por empresa
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS herramienta_contacto TEXT NOT NULL DEFAULT 'email'
  CHECK (herramienta_contacto IN ('email', 'teams', 'slack', 'whatsapp', 'meet'));


-- ══════════════════════════════════════════════════════════════
-- 11. TABLAS: M3 — Rol y Herramientas
-- ══════════════════════════════════════════════════════════════

-- Tareas de onboarding por semana
CREATE TABLE IF NOT EXISTS tareas_onboarding (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id  uuid NOT NULL,
  usuario_id  uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  semana      int  NOT NULL CHECK (semana BETWEEN 1 AND 4),
  orden       int  NOT NULL DEFAULT 0,
  titulo      text NOT NULL,
  completada  boolean DEFAULT false,
  completada_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- Herramientas del rol con guía en JSONB
CREATE TABLE IF NOT EXISTS herramientas_rol (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  nombre     text NOT NULL,
  url        text,
  icono      text,
  guia       jsonb,
  orden      int  DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Objetivos del mes por semana (solo lectura para empleado)
CREATE TABLE IF NOT EXISTS objetivos_rol (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id  uuid NOT NULL,
  semana      int  NOT NULL CHECK (semana BETWEEN 1 AND 4),
  titulo      text NOT NULL,
  descripcion text,
  estado      text DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_progreso', 'completado')),
  created_at  timestamptz DEFAULT now()
);

-- RLS: herramientas_rol
ALTER TABLE herramientas_rol ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "herramientas_empleado_select" ON herramientas_rol;
DROP POLICY IF EXISTS "herramientas_admin_all"       ON herramientas_rol;
DROP POLICY IF EXISTS "herramientas_dev_all"         ON herramientas_rol;

CREATE POLICY "herramientas_empleado_select" ON herramientas_rol
  FOR SELECT USING (empresa_id = get_my_empresa_id());

CREATE POLICY "herramientas_admin_all" ON herramientas_rol
  FOR ALL USING (get_my_rol() = 'admin' AND empresa_id = get_my_empresa_id())
  WITH CHECK (get_my_rol() = 'admin' AND empresa_id = get_my_empresa_id());

CREATE POLICY "herramientas_dev_all" ON herramientas_rol
  FOR ALL USING (get_my_rol() = 'dev') WITH CHECK (get_my_rol() = 'dev');

-- RLS: objetivos_rol
ALTER TABLE objetivos_rol ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "objetivos_empleado_select" ON objetivos_rol;
DROP POLICY IF EXISTS "objetivos_admin_all"       ON objetivos_rol;
DROP POLICY IF EXISTS "objetivos_dev_all"         ON objetivos_rol;

CREATE POLICY "objetivos_empleado_select" ON objetivos_rol
  FOR SELECT USING (empresa_id = get_my_empresa_id());

CREATE POLICY "objetivos_admin_all" ON objetivos_rol
  FOR ALL USING (get_my_rol() = 'admin' AND empresa_id = get_my_empresa_id())
  WITH CHECK (get_my_rol() = 'admin' AND empresa_id = get_my_empresa_id());

CREATE POLICY "objetivos_dev_all" ON objetivos_rol
  FOR ALL USING (get_my_rol() = 'dev') WITH CHECK (get_my_rol() = 'dev');


-- ══════════════════════════════════════════════════════════════
-- 12. PRE-BOARDING
--     preboarding_activo = true permite que el empleado acceda
--     antes de su fecha_ingreso oficial.
--     El modo finaliza automáticamente cuando fecha_ingreso <= hoy.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS preboarding_activo         boolean    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_acceso_preboarding   timestamptz;


-- ══════════════════════════════════════════════════════════════
-- 13. ENCUESTAS DE PULSO
--     Encuestas cortas automáticas en días 7, 30 y 60
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS encuestas_pulso (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid REFERENCES empresas(id)  ON DELETE CASCADE,
  usuario_id      uuid REFERENCES usuarios(id)  ON DELETE CASCADE,
  dia_onboarding  integer     NOT NULL,  -- 7, 30 o 60
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

ALTER TABLE encuestas_pulso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "encuestas_empleado_select" ON encuestas_pulso;
DROP POLICY IF EXISTS "encuestas_empleado_update" ON encuestas_pulso;
DROP POLICY IF EXISTS "encuestas_admin_select"    ON encuestas_pulso;
DROP POLICY IF EXISTS "encuestas_dev_all"         ON encuestas_pulso;

-- Empleado: ve y responde sus propias encuestas
CREATE POLICY "encuestas_empleado_select" ON encuestas_pulso
  FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "encuestas_empleado_update" ON encuestas_pulso
  FOR UPDATE
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- La creación de encuestas la hace el servidor (sin RLS INSERT para empleado).
-- La API route usa el cliente con cookie de sesión del admin/sistema.

-- Admin: lectura de todas las encuestas de su empresa
CREATE POLICY "encuestas_admin_select" ON encuestas_pulso
  FOR SELECT USING (
    get_my_rol() IN ('admin', 'dev')
    AND empresa_id = get_my_empresa_id()
  );

-- Dev: acceso total
CREATE POLICY "encuestas_dev_all" ON encuestas_pulso
  FOR ALL
  USING (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');


-- ─────────────────────────────────────────────────────────────
-- Fin del script
-- ─────────────────────────────────────────────────────────────
