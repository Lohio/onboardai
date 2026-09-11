-- ─────────────────────────────────────────────────────────────
-- seguridad_baja.sql — Cierra 2 hallazgos BAJA del pentest 2026-09-11
-- Ejecutar en Supabase SQL Editor (idempotente).
-- ─────────────────────────────────────────────────────────────

-- ── L4: los RPC de metering/cuota no deben ser invocables por el cliente ──
-- Son SECURITY DEFINER y el servidor los llama SIEMPRE con service-role.
-- OJO: en Postgres las funciones heredan EXECUTE de PUBLIC por defecto, así
-- que revocar solo de authenticated/anon NO alcanza (siguen ejecutando vía
-- PUBLIC). Hay que revocar de PUBLIC y volver a conceder solo a service_role.
--
-- Motivo: como p_limite lo controla el caller, un empleado podía llamar
-- reservar_consulta_ia(su_empresa, p_limite) por REST para inflar y agotar
-- la cuota mensual de sus compañeros (DoS intra-tenant).
--
-- NO se tocan los helpers assert_tenant_acceso / es_caller_privilegiado:
-- el trigger proteger_columnas_* (SECURITY INVOKER) llama a
-- es_caller_privilegiado() como el usuario autenticado, así que necesita
-- conservar EXECUTE o rompería todo UPDATE de usuarios/empresas.

REVOKE EXECUTE ON FUNCTION reservar_consulta_ia(uuid, integer)                                                        FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION reservar_consulta_ia(uuid, integer)                                                        TO service_role;

REVOKE EXECUTE ON FUNCTION registrar_uso_ia(uuid, uuid, text, text, integer, integer, integer, integer, boolean)      FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION registrar_uso_ia(uuid, uuid, text, text, integer, integer, integer, integer, boolean)      TO service_role;

REVOKE EXECUTE ON FUNCTION marcar_aviso_uso_ia(uuid, integer)                                                         FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION marcar_aviso_uso_ia(uuid, integer)                                                         TO service_role;

-- buscar_conocimiento también corre server-side (tool del asistente, con
-- service-role); el cliente nunca la llama directo.
REVOKE EXECUTE ON FUNCTION buscar_conocimiento(uuid, text, integer)                                                   FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION buscar_conocimiento(uuid, text, integer)                                                   TO service_role;

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
