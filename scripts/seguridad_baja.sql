-- ─────────────────────────────────────────────────────────────
-- seguridad_baja.sql — Cierra 2 hallazgos BAJA del pentest 2026-09-11
-- Ejecutar en Supabase SQL Editor (idempotente).
-- ─────────────────────────────────────────────────────────────

-- ── L4: los RPC de metering/cuota no deben ser invocables por el cliente ──
-- Son SECURITY DEFINER y el servidor los llama SIEMPRE con service-role.
-- PostgREST los expone a `authenticated` por defecto: un empleado podía
-- llamar reservar_consulta_ia(su_empresa, p_limite) vía REST para inflar y
-- agotar la cuota mensual de sus compañeros (DoS intra-tenant), ya que
-- `p_limite` lo controla el caller. Revocar EXECUTE a authenticated/anon;
-- service_role conserva el acceso (no se ve afectado por REVOKE).
REVOKE EXECUTE ON FUNCTION reservar_consulta_ia(uuid, integer)              FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION registrar_uso_ia(uuid, uuid, text, text, integer, integer, integer, integer, boolean) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION marcar_aviso_uso_ia(uuid, integer)              FROM authenticated, anon;
-- buscar_conocimiento también corre server-side (tool del asistente); el
-- cliente nunca la llama directo. La guarda assert_tenant_acceso ya impide
-- cross-tenant, pero cerramos igual la superficie.
REVOKE EXECUTE ON FUNCTION buscar_conocimiento(uuid, text, integer)        FROM authenticated, anon;
-- Helpers internos de las funciones definer: tampoco necesitan exposición.
REVOKE EXECUTE ON FUNCTION assert_tenant_acceso(uuid)                      FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION es_caller_privilegiado()                        FROM authenticated, anon;

-- ── L5: uso_mensual_ia legible por cualquier empleado de la empresa ──
-- La policy de SELECT solo filtraba por empresa, sin exigir rol (a diferencia
-- de uso_ia_select). Un empleado podía leer el consumo IA agregado de su
-- empresa. Se alinea con uso_ia: solo admin/dev de la empresa, o dev global.
DROP POLICY IF EXISTS uso_mensual_ia_select ON uso_mensual_ia;
CREATE POLICY uso_mensual_ia_select ON uso_mensual_ia
  FOR SELECT TO authenticated
  USING (
    empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
    AND (SELECT rol FROM usuarios WHERE id = auth.uid()) IN ('admin', 'dev')
    OR (SELECT rol FROM usuarios WHERE id = auth.uid()) = 'dev'
  );
