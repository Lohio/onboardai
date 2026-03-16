-- ─────────────────────────────────────────────────────────────
-- OnboardAI: Sistema de roles en Supabase
-- Ejecutar en el SQL Editor de Supabase (una sola vez)
-- ─────────────────────────────────────────────────────────────

-- 1. Agregar columna rol si no existe
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol TEXT NOT NULL DEFAULT 'empleado'
  CHECK (rol IN ('empleado', 'admin', 'dev'));

-- 2. Funciones helper SECURITY DEFINER
--    Permiten que las políticas RLS lean el propio registro sin recursión.

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

-- 3. Habilitar RLS en la tabla usuarios (por si no está activo)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- 4. Eliminar políticas previas para recrearlas limpias
DROP POLICY IF EXISTS "empleados_ven_su_fila" ON usuarios;
DROP POLICY IF EXISTS "admin_ve_empresa" ON usuarios;
DROP POLICY IF EXISTS "dev_ve_todo" ON usuarios;
DROP POLICY IF EXISTS "admin_escribe_empresa" ON usuarios;
DROP POLICY IF EXISTS "dev_escribe_todo" ON usuarios;
DROP POLICY IF EXISTS "usuario_actualiza_propio" ON usuarios;

-- 5. Políticas de lectura
-- Cada empleado ve solo su propia fila
CREATE POLICY "empleados_ven_su_fila" ON usuarios
  FOR SELECT USING (
    id = auth.uid()
  );

-- Admin ve todos los usuarios de su empresa
CREATE POLICY "admin_ve_empresa" ON usuarios
  FOR SELECT USING (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  );

-- Dev ve absolutamente todo
CREATE POLICY "dev_ve_todo" ON usuarios
  FOR SELECT USING (
    get_my_rol() = 'dev'
  );

-- 6. Políticas de escritura
-- Admin puede insertar/actualizar/borrar usuarios de su empresa
CREATE POLICY "admin_escribe_empresa" ON usuarios
  FOR ALL USING (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  )
  WITH CHECK (
    get_my_rol() = 'admin'
    AND empresa_id = get_my_empresa_id()
  );

-- Dev puede hacer cualquier cosa
CREATE POLICY "dev_escribe_todo" ON usuarios
  FOR ALL USING (
    get_my_rol() = 'dev'
  )
  WITH CHECK (
    get_my_rol() = 'dev'
  );

-- Cada usuario puede actualizar su propio perfil (nombre, foto, etc.)
CREATE POLICY "usuario_actualiza_propio" ON usuarios
  FOR UPDATE USING (
    id = auth.uid()
  )
  WITH CHECK (
    id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────
-- Fin del script
-- ─────────────────────────────────────────────────────────────
