-- ─────────────────────────────────────────────────────────────
-- rate_limit_revoke.sql — increment_rate_limit solo invocable por service-role
-- Ejecutar en Supabase SQL Editor (idempotente).
-- REQUIERE desplegado antes el cambio de withHandler que llama al RPC con
-- createServiceClient(); con el código anterior, login/registro devolverían 429.
-- ─────────────────────────────────────────────────────────────

-- Motivo: el RPC recibe p_key y p_max del caller. Expuesto por REST, un
-- anónimo podía inflar el contador de cualquier key (ej. el endpoint de
-- login de otra IP o el chat de otro usuario) y bloquearlo (DoS).
--
-- OJO: en Postgres las funciones heredan EXECUTE de PUBLIC por defecto, así
-- que revocar solo de anon NO alcanza (sigue ejecutando vía PUBLIC). Hay que
-- revocar de PUBLIC y volver a conceder solo a service_role.

REVOKE EXECUTE ON FUNCTION increment_rate_limit(text, timestamptz, integer) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION increment_rate_limit(text, timestamptz, integer) TO service_role;

-- Verificación (debe devolver solo service_role y el owner):
-- SELECT grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_name = 'increment_rate_limit';
