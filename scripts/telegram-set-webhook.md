# Registrar el webhook de Telegram (una sola vez por entorno)

## Pre-requisitos

1. Crear el bot con @BotFather en Telegram → guardar TOKEN y username.
2. Ejecutar `scripts/agente_bienvenida.sql` en el SQL Editor de Supabase.
3. Agregar estas variables en Vercel (Settings → Environment Variables):
   - `TELEGRAM_BOT_TOKEN` — el token de @BotFather
   - `TELEGRAM_WEBHOOK_SECRET` — un string random seguro (ej: `openssl rand -hex 32`)
   - `TELEGRAM_BOT_USERNAME` — el username del bot SIN @ (ej: `HeeroBienvenidaBot`)
4. Redeployar en Vercel para que las env vars estén disponibles.

## Registrar el webhook

Reemplazá `TOKEN`, `SECRET` y el dominio antes de ejecutar:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://app.heero.la/api/bot/telegram","secret_token":"<SECRET>","allowed_updates":["message"]}'
```

Respuesta esperada: `{"ok":true,"result":true,...}`

## Verificar el webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Esperado:
- `"url"` apuntando a `/api/bot/telegram`
- `"pending_update_count": 0`
- Sin campo `"last_error_message"`

## Cargar datos de la empresa para probar

En la tabla `empresas`, completar las columnas nuevas para la empresa de prueba:
- `direccion` — ej: "Av. Corrientes 1234, CABA"
- `maps_url` — link de Google Maps
- `como_llegar` — indicaciones de transporte

En la tabla `usuarios` del empleado de prueba:
- `hora_ingreso` — ej: "9:00"
- `preboarding_activo` — `true`
