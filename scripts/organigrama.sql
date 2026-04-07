-- Tabla de nodos del organigrama por empresa
-- Cada nodo puede representar un usuario real (usuario_id) o un nodo genérico (ej: CEO externo)

CREATE TABLE IF NOT EXISTS organigrama_nodos (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id  uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id  uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre      text NOT NULL,
  puesto      text,
  area        text,
  foto_url    text,
  parent_id   uuid REFERENCES organigrama_nodos(id) ON DELETE SET NULL,
  orden       int DEFAULT 0,
  visible     boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE organigrama_nodos ENABLE ROW LEVEL SECURITY;

-- Empleados: solo lectura de su empresa
CREATE POLICY "org_empleado_select" ON organigrama_nodos
  FOR SELECT USING (empresa_id = get_my_empresa_id());

-- Admins: CRUD dentro de su empresa
CREATE POLICY "org_admin_all" ON organigrama_nodos
  FOR ALL USING (get_my_rol() = 'admin' AND empresa_id = get_my_empresa_id())
  WITH CHECK (get_my_rol() = 'admin' AND empresa_id = get_my_empresa_id());

-- Dev: acceso total
CREATE POLICY "org_dev_all" ON organigrama_nodos
  FOR ALL USING (get_my_rol() = 'dev')
  WITH CHECK (get_my_rol() = 'dev');

-- Índice para queries por empresa + jerarquía + orden
CREATE INDEX IF NOT EXISTS idx_org_nodos_empresa
  ON organigrama_nodos(empresa_id, parent_id, orden);
