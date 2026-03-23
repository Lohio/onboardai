-- Tabla de vinculaciones de bot (Google Chat / Microsoft Teams)
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS bot_vinculaciones (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id    uuid        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  plataforma    text        NOT NULL CHECK (plataforma IN ('teams', 'gchat')),
  chat_user_id  text        NOT NULL, -- ID del usuario en Teams/GChat
  chat_email    text,                 -- email del usuario en Teams/GChat
  created_at    timestamptz DEFAULT now(),
  UNIQUE(plataforma, chat_user_id)
);

ALTER TABLE bot_vinculaciones ENABLE ROW LEVEL SECURITY;

-- Solo devs pueden ver y gestionar todas las vinculaciones
CREATE POLICY "bot_vinculaciones_dev" ON bot_vinculaciones
  FOR ALL USING (get_my_rol() = 'dev');

-- Admins solo ven las de su empresa
CREATE POLICY "bot_vinculaciones_admin" ON bot_vinculaciones
  FOR ALL USING (
    get_my_rol() = 'admin' AND empresa_id = get_my_empresa_id()
  );

-- Columna para URL de webhook entrante de Teams (por empresa)
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS teams_webhook_url text;
