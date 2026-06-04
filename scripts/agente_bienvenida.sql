-- scripts/agente_bienvenida.sql
-- ══════════════════════════════════════════════════════════════
-- AGENTE DE BIENVENIDA (Telegram / WhatsApp)
-- Ejecutar en Supabase SQL Editor antes de deployar el código.
-- ══════════════════════════════════════════════════════════════

-- 1. Ampliar plataformas permitidas en bot_vinculaciones
ALTER TABLE bot_vinculaciones
  DROP CONSTRAINT IF EXISTS bot_vinculaciones_plataforma_check;
ALTER TABLE bot_vinculaciones
  ADD CONSTRAINT bot_vinculaciones_plataforma_check
  CHECK (plataforma IN ('teams', 'gchat', 'telegram', 'whatsapp'));

-- 2. Datos de la oficina (nivel empresa)
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS direccion   text,
  ADD COLUMN IF NOT EXISTS maps_url    text,
  ADD COLUMN IF NOT EXISTS como_llegar text;

-- 3. Datos del primer día (nivel empleado)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS hora_ingreso                  text,
  ADD COLUMN IF NOT EXISTS referente_primer_dia_nombre   text,
  ADD COLUMN IF NOT EXISTS referente_primer_dia_contacto text;

-- 4. Invitaciones de bot (deep-link token)
CREATE TABLE IF NOT EXISTS bot_invitaciones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id  uuid        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  plataforma  text        NOT NULL CHECK (plataforma IN ('telegram', 'whatsapp')),
  token       text        NOT NULL UNIQUE,
  usado       boolean     NOT NULL DEFAULT false,
  expira_at   timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE bot_invitaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bot_invitaciones_dev"   ON bot_invitaciones;
DROP POLICY IF EXISTS "bot_invitaciones_admin" ON bot_invitaciones;

CREATE POLICY "bot_invitaciones_dev" ON bot_invitaciones
  FOR ALL USING (get_my_rol() = 'dev');

CREATE POLICY "bot_invitaciones_admin" ON bot_invitaciones
  FOR ALL USING (
    get_my_rol() = 'admin' AND empresa_id = get_my_empresa_id()
  );

CREATE INDEX IF NOT EXISTS idx_bot_invitaciones_token ON bot_invitaciones(token);
