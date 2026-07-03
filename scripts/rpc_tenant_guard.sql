-- ─────────────────────────────────────────────────────────────
-- rpc_tenant_guard.sql — Validación de tenant en RPCs SECURITY DEFINER
-- Ejecutar en Supabase SQL Editor (idempotente, CREATE OR REPLACE)
--
-- Problema que resuelve: buscar_conocimiento / registrar_uso_ia /
-- marcar_aviso_uso_ia son SECURITY DEFINER (bypassan RLS) y PostgREST
-- las expone al rol authenticated. Sin esta guarda, un empleado podría
-- llamarlas vía la API REST con el empresa_id de OTRA empresa y leer
-- su conocimiento o inflar su cuota.
--
-- La guarda: si hay un usuario autenticado (auth.uid() no nulo) y NO es
-- dev, el p_empresa_id debe coincidir con SU empresa. El servidor las
-- llama con service-role (auth.uid() = NULL) y pasa sin restricción.
-- ─────────────────────────────────────────────────────────────

-- Helper: valida que el caller pueda operar sobre p_empresa_id
CREATE OR REPLACE FUNCTION assert_tenant_acceso(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-role / server (sin sesión JWT): acceso permitido
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  -- dev: acceso cross-tenant permitido (consistente con las policies)
  IF COALESCE((SELECT rol FROM usuarios WHERE id = auth.uid()), '') = 'dev' THEN
    RETURN;
  END IF;
  -- Usuario normal: solo su propia empresa
  IF p_empresa_id <> (SELECT empresa_id FROM usuarios WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'acceso denegado: empresa ajena';
  END IF;
END;
$$;

-- ── buscar_conocimiento (con guarda; convertida a plpgsql) ────
CREATE OR REPLACE FUNCTION buscar_conocimiento(
  p_empresa_id uuid,
  p_query      text,
  p_limit      integer DEFAULT 5
) RETURNS TABLE (
  modulo             text,
  titulo             text,
  contenido          text,
  contenido_extraido text,
  area               text,
  puesto             text,
  rank               real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_tenant_acceso(p_empresa_id);
  RETURN QUERY
    SELECT
      c.modulo, c.titulo, c.contenido, c.contenido_extraido,
      c.area, c.puesto,
      ts_rank(c.fts, websearch_to_tsquery('spanish', p_query)) AS rank
    FROM conocimiento c
    WHERE c.empresa_id = p_empresa_id
      AND c.fts @@ websearch_to_tsquery('spanish', p_query)
    ORDER BY rank DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 10);
END;
$$;

-- ── registrar_uso_ia (con guarda) ────────────────────────────
CREATE OR REPLACE FUNCTION registrar_uso_ia(
  p_empresa_id            uuid,
  p_usuario_id            uuid,
  p_fuente                text,
  p_modelo                text,
  p_input_tokens          integer,
  p_output_tokens         integer,
  p_cache_read_tokens     integer DEFAULT 0,
  p_cache_creation_tokens integer DEFAULT 0,
  p_cuenta_consulta       boolean DEFAULT true
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_tenant_acceso(p_empresa_id);

  INSERT INTO uso_ia (
    empresa_id, usuario_id, fuente, modelo,
    input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens
  ) VALUES (
    p_empresa_id, p_usuario_id, p_fuente, p_modelo,
    p_input_tokens, p_output_tokens, p_cache_read_tokens, p_cache_creation_tokens
  );

  INSERT INTO uso_mensual_ia (empresa_id, mes, consultas, input_tokens, output_tokens, cache_read_tokens)
  VALUES (
    p_empresa_id,
    date_trunc('month', now())::date,
    CASE WHEN p_cuenta_consulta THEN 1 ELSE 0 END,
    p_input_tokens,
    p_output_tokens,
    p_cache_read_tokens
  )
  ON CONFLICT (empresa_id, mes) DO UPDATE SET
    consultas         = uso_mensual_ia.consultas + (CASE WHEN p_cuenta_consulta THEN 1 ELSE 0 END),
    input_tokens      = uso_mensual_ia.input_tokens + p_input_tokens,
    output_tokens     = uso_mensual_ia.output_tokens + p_output_tokens,
    cache_read_tokens = uso_mensual_ia.cache_read_tokens + p_cache_read_tokens,
    updated_at        = now();
END;
$$;

-- ── reservar_consulta_ia — chequeo de cuota ATÓMICO ──────────
-- Reemplaza el patrón "leer y después incrementar" (TOCTOU): hace el
-- incremento condicional en un solo statement, así N requests
-- concurrentes no pueden superar el límite. Cuenta la consulta ANTES
-- del stream; los tokens se registran después con p_cuenta_consulta=false.
CREATE OR REPLACE FUNCTION reservar_consulta_ia(
  p_empresa_id uuid,
  p_limite     integer
) RETURNS TABLE (permitido boolean, usadas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usadas integer;
  v_mes    date := date_trunc('month', now())::date;
BEGIN
  PERFORM assert_tenant_acceso(p_empresa_id);

  -- Incremento atómico condicional: solo suma si hay cupo.
  -- Si la fila no existe, inserta con consultas=1 (primera consulta).
  -- Si existe pero ya llegó al límite, el WHERE no matchea y no devuelve fila.
  INSERT INTO uso_mensual_ia (empresa_id, mes, consultas)
  VALUES (p_empresa_id, v_mes, 1)
  ON CONFLICT (empresa_id, mes) DO UPDATE
    SET consultas  = uso_mensual_ia.consultas + 1,
        updated_at = now()
    WHERE uso_mensual_ia.consultas < p_limite
  RETURNING consultas INTO v_usadas;

  IF v_usadas IS NOT NULL THEN
    RETURN QUERY SELECT true, v_usadas;
  ELSE
    -- Cuota agotada: leer el valor actual para reportarlo
    SELECT consultas INTO v_usadas FROM uso_mensual_ia
      WHERE empresa_id = p_empresa_id AND mes = v_mes;
    RETURN QUERY SELECT false, COALESCE(v_usadas, 0);
  END IF;
END;
$$;

-- ── marcar_aviso_uso_ia (con guarda) ─────────────────────────
CREATE OR REPLACE FUNCTION marcar_aviso_uso_ia(
  p_empresa_id uuid,
  p_umbral     integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actualizado integer;
BEGIN
  PERFORM assert_tenant_acceso(p_empresa_id);

  IF p_umbral = 80 THEN
    UPDATE uso_mensual_ia SET aviso_80_enviado = true, updated_at = now()
    WHERE empresa_id = p_empresa_id
      AND mes = date_trunc('month', now())::date
      AND aviso_80_enviado = false;
  ELSIF p_umbral = 100 THEN
    UPDATE uso_mensual_ia SET aviso_100_enviado = true, updated_at = now()
    WHERE empresa_id = p_empresa_id
      AND mes = date_trunc('month', now())::date
      AND aviso_100_enviado = false;
  ELSE
    RETURN false;
  END IF;

  GET DIAGNOSTICS actualizado = ROW_COUNT;
  RETURN actualizado > 0;
END;
$$;
