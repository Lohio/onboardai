-- ─────────────────────────────────────────────────────────────
-- rls_privilegios.sql — Cierra escaladas de privilegio vía RLS
-- Ejecutar en Supabase SQL Editor (idempotente)
--
-- Problema: las policies de UPDATE de `usuarios` y `empresas` permiten
-- modificar CUALQUIER columna de la fila propia. Un empleado podía hacer
-- update({rol:'dev'}) o cambiar su empresa_id desde el navegador; un admin
-- podía auto-asignarse plan 'enterprise'. Y `plan_30_60_90` daba CRUD a
-- cualquier empleado sobre los planes de sus compañeros.
--
-- Solución: triggers BEFORE UPDATE que bloquean columnas sensibles salvo
-- para service_role (server) o rol dev (panel interno), y fix de la policy.
-- ─────────────────────────────────────────────────────────────

-- Helper: ¿el caller es el servidor (service_role) o un dev?
CREATE OR REPLACE FUNCTION es_caller_privilegiado()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'service_role'
      OR COALESCE((SELECT rol FROM usuarios WHERE id = auth.uid()), '') = 'dev';
$$;

-- ── usuarios: rol y empresa_id solo los cambia el server o un dev ──
CREATE OR REPLACE FUNCTION proteger_columnas_usuarios()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF es_caller_privilegiado() THEN
    RETURN NEW;
  END IF;
  IF NEW.rol IS DISTINCT FROM OLD.rol
     OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'No tenés permiso para modificar rol o empresa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_columnas_usuarios ON usuarios;
CREATE TRIGGER trg_proteger_columnas_usuarios
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION proteger_columnas_usuarios();

-- ── empresas: columnas de billing solo las cambia el server (webhooks) o un dev ──
CREATE OR REPLACE FUNCTION proteger_columnas_empresas()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF es_caller_privilegiado() THEN
    RETURN NEW;
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.plan_empleados IS DISTINCT FROM OLD.plan_empleados
     OR NEW.suscripcion_estado IS DISTINCT FROM OLD.suscripcion_estado
     OR NEW.suscripcion_inicio IS DISTINCT FROM OLD.suscripcion_inicio
     OR NEW.suscripcion_fin IS DISTINCT FROM OLD.suscripcion_fin
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.mp_subscription_id IS DISTINCT FROM OLD.mp_subscription_id
     OR NEW.proveedor_pago IS DISTINCT FROM OLD.proveedor_pago THEN
    RAISE EXCEPTION 'Las columnas de facturación no se pueden modificar manualmente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_columnas_empresas ON empresas;
CREATE TRIGGER trg_proteger_columnas_empresas
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE FUNCTION proteger_columnas_empresas();

-- ── plan_30_60_90: el CRUD completo es solo para admin/dev ──
-- (los empleados conservan sus policies propias: empleado_read_own_plan /
--  empleado_update_own_plan, que no se tocan)
DROP POLICY IF EXISTS "admin_manage_plan" ON plan_30_60_90;
CREATE POLICY "admin_manage_plan" ON plan_30_60_90
  FOR ALL
  USING (
    get_my_rol() IN ('admin', 'dev')
    AND empresa_id = get_my_empresa_id()
  )
  WITH CHECK (
    get_my_rol() IN ('admin', 'dev')
    AND empresa_id = get_my_empresa_id()
  );
