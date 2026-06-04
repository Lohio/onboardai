# Diseño: Agente de Bienvenida (Telegram)

**Fecha:** 2026-06-04  
**Estado:** Aprobado — fixes incorporados 2026-06-04  
**Scope:** Bot de Telegram separado del CopilBot. Solo responde sobre el primer día: ubicación, horario de ingreso, referente, resumen. No expone `conocimiento` institucional.

---

## Verificación Task 0 — patrones reales del código

| Archivo | Patrón confirmado |
|---|---|
| `botCore.ts` | `getAdminClient()` = `createSupabaseAdmin(URL, SERVICE_ROLE_KEY)` sin opciones extra. Claude instanciado inline: `new Anthropic({ apiKey })`. Modelo hardcodeado: `'claude-haiku-4-5-20251001'` |
| `claude.ts` | Alias real del modelo: **`claude-sonnet-4-6`** (no el de la doc). Leído de `app_config.claude_model` |
| `teams/route.ts` | `withHandler({ auth:'webhook', bodyType:'none', rateLimit: RATE_LIMITS.bot })` + `req.text()` + `NextResponse.json(...)` ✓ |
| `withHandler.ts` | `auth:'session'` expone `user.id`, `user.empresaId`, `user.rol` en el contexto |
| `withRateLimit.ts` | `RATE_LIMITS.bot = { max:100, windowMs:60min, keyType:'ip' }` ✓ |
| `bot_vinculaciones.sql` | `CHECK (plataforma IN ('teams', 'gchat'))` — **no incluye `telegram`**, requiere migración |
| `roles.sql` | Columnas `manager_id`, `buddy_id`, `preboarding_activo`, `contacto_rrhh_nombre/email` confirmadas en `usuarios`. `equipo_relaciones` tiene `usuario_id`, `miembro_id`, `relacion` |
| `empleados/route.ts` | Service role: `createClient(URL, key, { auth: { autoRefreshToken:false, persistSession:false } })` |
| `Button.tsx` | API: `variant`, `size`, `loading` ✓ |
| `Card.tsx` | API: `padding='md'` default, `onClick?` ✓ |
| `errors.ts` | `ApiError` vive en **`@/lib/errors`** — NO en `withHandler` (discrepancia con el spec) |
| `admin/layout.tsx` | `navItems` array const. `NavItemDef` = `{ labelKey, href, icon, disabled, tourId? }`. Usa `useLanguage()`. `Send` icon **no está importado** — hay que agregarlo |

### Discrepancias del spec corregidas

1. `import { ApiError } from '@/lib/api/withHandler'` → **`from '@/lib/errors'`**
2. `adminClient()` en Task 4a debe incluir `{ auth: { autoRefreshToken: false, persistSession: false } }` (igual que `empleados/route.ts`)
3. Task 7: agregar `Send` al import de lucide-react en `admin/layout.tsx`
4. Nav usa `labelKey` + i18n — para el item de bienvenida: `labelKey: 'nav.welcome'`

---

## Arquitectura

```
┌─────────────────────────────────────────────┐
│  Telegram Bot                               │
│  (mensaje entrante vía webhook)             │
└────────────────┬────────────────────────────┘
                 │ POST /api/bot/telegram
                 ▼
┌─────────────────────────────────────────────┐
│  route.ts — adaptador de transporte         │
│  • Verifica X-Telegram-Bot-Api-Secret-Token │
│  • Parsea update.message                    │
│  • Llama procesarBienvenida()               │
│  • Devuelve { method: 'sendMessage', ... }  │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│  bienvenidaCore.ts — lógica pura            │
│  • /start TOKEN → vincula + saluda          │
│  • Busca bot_vinculaciones por chat_user_id │
│  • detectarTema() → respuesta directa       │
│  • Fallback acotado con Claude (solo si     │
│    tema === 'otro')                         │
└──────┬─────────────────┬───────────────────┘
       │                 │
       ▼                 ▼
  bot_invitaciones   bot_vinculaciones
  usuarios           empresas
  equipo_relaciones  app_config (modelo)
```

---

## Base de datos

### Migraciones necesarias (Task 1)

1. **`bot_vinculaciones`** — ampliar `CHECK` a `('teams', 'gchat', 'telegram', 'whatsapp')`
2. **`empresas`** — agregar `direccion text`, `maps_url text`, `como_llegar text`
3. **`usuarios`** — agregar `hora_ingreso text`, `referente_primer_dia_nombre text`, `referente_primer_dia_contacto text`
4. **`bot_invitaciones`** — tabla nueva con `token UNIQUE`, `usado boolean`, `expira_at` (14 días), RLS admin/dev, índice en `token`

### Resolución del referente (fallback chain)

```
override explícito (referente_primer_dia_nombre)
  → buddy (equipo_relaciones WHERE relacion='buddy' || usuarios.buddy_id)
  → manager (equipo_relaciones WHERE relacion='manager' || usuarios.manager_id)
  → contacto_rrhh_nombre / contacto_rrhh_email
  → "avisá en recepción" (mensaje genérico)
```

---

## Flujo de vinculación

```
Admin genera link → POST /api/admin/bienvenida/invitar
                 → inserta bot_invitaciones(token, usuario_id, empresa_id)
                 → devuelve https://t.me/BotUsername?start=TOKEN

Empleado abre link → Telegram envía /start TOKEN al webhook
                   → bienvenidaCore verifica token en bot_invitaciones
                   → upsert en bot_vinculaciones (chat_user_id, plataforma)
                   → marca invitación como usada
                   → saludo con nombre del empleado + 4 botones

Conversación posterior → busca bot_vinculaciones por chat_user_id
                       → detectarTema() → respuesta directa
                       → tema=='otro' → Claude acotado (solo bienvenida)
```

---

## Archivos a crear/modificar

| Tarea | Archivo | Tipo |
|---|---|---|
| T1 | `scripts/agente_bienvenida.sql` | Nuevo |
| T2 | `src/lib/bienvenidaCore.ts` | Nuevo |
| T3 | `src/app/api/bot/telegram/route.ts` | Nuevo |
| T4a | `src/app/api/admin/bienvenida/invitar/route.ts` | Nuevo |
| T4b | `src/app/admin/bienvenida/page.tsx` | Nuevo |
| T5 | `src/lib/__tests__/bienvenidaCore.test.ts` | Nuevo |
| T6a | `scripts/telegram-set-webhook.md` | Nuevo |
| T6b | `docs/agente-bienvenida.md` | Nuevo |
| T7 | `src/app/admin/layout.tsx` | Modificar (agregar nav item + import `Send`) |

### Variables de entorno nuevas

```
TELEGRAM_BOT_TOKEN=        # de @BotFather
TELEGRAM_WEBHOOK_SECRET=   # string random
TELEGRAM_BOT_USERNAME=     # sin @
```

---

## Separación de responsabilidades

`bienvenidaCore.ts` es completamente independiente de `botCore.ts`:
- **No importa** nada de `src/lib/claude.ts` ni de `conocimiento`
- Tiene su propio `getAdminClient()` (mismo patrón)
- Tiene su propia instancia `anthropic` (mismo patrón)
- Solo consulta: `bot_invitaciones`, `bot_vinculaciones`, `usuarios`, `empresas`, `equipo_relaciones`, `app_config`

---

## Fixes pre-implementación (incorporados al spec)

### Fix 1 — `/start` sin token de usuario ya vinculado
En `procesarBienvenida`, después de resolver `datos` (tras el bloque del vínculo existente), agregar antes de `detectarTema`:

```typescript
if (/^\/?start$/i.test(texto)) {
  return {
    texto: `¡Hola de nuevo, ${datos.nombreEmpleado}! ¿Qué querés saber de tu primer día?`,
    mostrarBotones: true,
  }
}
```

Sin esto, `/start` sin token cae en `detectarTema → 'otro' → Claude` en lugar de saludar con botones.

### Fix 2 — `case 'resumen'` sin el `.replace()` hacky
Reemplazar la concatenación con parche por un array limpio:

```typescript
case 'resumen': {
  const fecha = fechaLegible(d.fechaIngreso)
  const lineas = [
    `✨ Resumen de tu primer día en ${d.nombreEmpresa}:`,
    '',
    `• Cuándo: ${fecha}${d.horaIngreso ? ` a las ${d.horaIngreso}` : ''}`,
  ]
  if (d.direccion) lineas.push(`• Dónde: ${d.direccion}`)
  if (d.referenteNombre) lineas.push(`• Quién te recibe: ${d.referenteNombre}`)
  lineas.push('', 'Cualquier duda escribime, para eso estoy.')
  return lineas.join('\n')
}
```

### Fix 3 — Guard en `TELEGRAM_BOT_USERNAME`
En `api/admin/bienvenida/invitar/route.ts`, reemplazar el fallback silencioso:

```typescript
// ANTES (silencioso, puede generar link al bot equivocado)
const username = process.env.TELEGRAM_BOT_USERNAME ?? 'HeeroBienvenidaBot'

// DESPUÉS (falla ruidosamente)
const username = process.env.TELEGRAM_BOT_USERNAME
if (!username) return ApiError.internal('TELEGRAM_BOT_USERNAME no configurado')
```

---

## Tests (Task 5)

Funciones puras a exportar: `detectarTema`, `fechaLegible`, `respuestaPorTema`, `generarTokenInvitacion`.

Casos cubiertos:
- `detectarTema`: 6 casos incluyendo emojis de botones
- `respuestaPorTema`: dirección+maps, hora, referente, datos faltantes sin romper
- `generarTokenInvitacion`: formato hex 32 chars + unicidad

Runner: detectar en `package.json`; si no existe, agregar Vitest.
