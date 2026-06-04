# Agente de Bienvenida (Telegram)

Bot de Telegram separado del CopilBot. Responde exclusivamente sobre el primer día del empleado. No expone el conocimiento institucional de `botCore.ts`.

## Flujo completo

1. **Admin** activa `preboarding_activo = true` en el empleado.
2. **Admin** abre `/admin/bienvenida` → hace click en "Generar link".
3. Heero inserta una fila en `bot_invitaciones` con un token aleatorio de 32 chars que expira en 14 días.
4. El link `https://t.me/BotUsername?start=TOKEN` se copia al portapapeles.
5. RRHH se lo manda al empleado (email, WhatsApp, etc.).
6. **Empleado** abre el link → Telegram envía `/start TOKEN` al webhook.
7. `bienvenidaCore` verifica el token, crea la vinculación en `bot_vinculaciones`, y responde con saludo + 4 botones.
8. **Conversación posterior**: el empleado pulsa los botones o escribe libremente. Si la pregunta es de bienvenida, respuesta directa. Si no, Claude acotado (no accede a `conocimiento`).

## 4 botones

| Botón | Tema | Datos usados |
|---|---|---|
| 📍 Dónde queda | `ubicacion` | `empresas.direccion`, `maps_url`, `como_llegar` |
| 🕘 A qué hora llego | `hora` | `usuarios.fecha_ingreso`, `hora_ingreso` |
| 🙋 Por quién pregunto | `referente` | `referente_primer_dia_*` → buddy → manager → RRHH |
| ✨ Mi primer día | `resumen` | Todo lo anterior combinado |

## Tablas involucradas

| Tabla | Cambios |
|---|---|
| `bot_vinculaciones` | CHECK ampliado: incluye `'telegram'` y `'whatsapp'` |
| `bot_invitaciones` | Nueva tabla: token, expira_at, usado |
| `empresas` | Columnas nuevas: `direccion`, `maps_url`, `como_llegar` |
| `usuarios` | Columnas nuevas: `hora_ingreso`, `referente_primer_dia_nombre/contacto` |

## Variables de entorno

```
TELEGRAM_BOT_TOKEN=        # de @BotFather
TELEGRAM_WEBHOOK_SECRET=   # string random (mismo valor en setWebhook y en el server)
TELEGRAM_BOT_USERNAME=     # sin @ — obligatorio, sin fallback silencioso
```

## Extender a WhatsApp

El mismo `bienvenidaCore.ts` se reutiliza sin cambios. Solo cambia el adaptador de transporte:

1. Crear `src/app/api/bot/whatsapp/route.ts` con verificación de firma HMAC-SHA256 (`X-Hub-Signature-256`).
2. Parsear el payload de WhatsApp Business API (estructura distinta a Telegram).
3. Llamar `procesarBienvenida({ chatUserId, plataforma: 'whatsapp', mensaje })`.
4. Enviar la respuesta vía WhatsApp Cloud API (POST separado, no en body del webhook).
5. Agregar `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` a las env vars.
