-- Tabla para rate limiting DB-based (Vercel serverless compatible)
CREATE TABLE IF NOT EXISTS rate_limits (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key        TEXT NOT NULL,          -- ej: "chat:user:uuid-del-user"
  "window"   TIMESTAMPTZ NOT NULL,   -- inicio de la ventana temporal (truncado)
  count      INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(key, "window")
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_window ON rate_limits(key, "window");

-- Función atómica de incremento y verificación
-- Retorna TRUE si la request está permitida (count <= p_max)
-- Retorna FALSE si se excedió el límite
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_key    TEXT,
  p_window TIMESTAMPTZ,
  p_max    INT
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  current_count INT;
BEGIN
  INSERT INTO rate_limits (key, "window", count)
  VALUES (p_key, p_window, 1)
  ON CONFLICT (key, "window")
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO current_count;

  RETURN current_count <= p_max;
END;
$$;

-- Índice de expiración para limpieza
-- Ejecutar periódicamente: DELETE FROM rate_limits WHERE window < now() - interval '2 days';
