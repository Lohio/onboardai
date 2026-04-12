# QA Report — Heero (OnboardAI)

**Fecha:** 2026-04-12  
**Equipo QA:** QATester1 (Functional & UX) + QATester2 (API & Data) + SecurityExpert  
**Metodología:** Análisis estático del código fuente (Next.js 14, TypeScript, Supabase, Claude API)  
**Cobertura:** 16 páginas, 25 endpoints API, sistema de encriptación, configuración de seguridad

---

## Resumen ejecutivo

| Categoría | Crítico | Alto | Medio | Bajo | Total |
|-----------|---------|------|-------|------|-------|
| Funcional & UX | 0 | 1 | 12 | 9 | **22** |
| API & Datos | 0 | 2 | 3 | 2 | **7** |
| Seguridad | 1 | 1 | 4 | 2 | **8** |
| **Total** | **1** | **4** | **19** | **13** | **37** |

### Veredicto general

> **⚠️ Necesita fixes antes del lanzamiento**

La plataforma funciona en su núcleo (loading states en todas las páginas, Framer Motion en todas las vistas, autenticación centralizada robusta, sin secretos hardcodeados, sin SQL injection). Sin embargo, hay **1 bug de seguridad crítico**, **4 bugs de alta severidad**, y **2 patrones sistémicos** que deben corregirse antes de poner usuarios reales en producción.

---

## Bugs críticos (bloquean funcionalidad o son riesgo de seguridad grave)

### CRIT-1: Endpoint Sentry sin autenticación — expuesto públicamente

**Archivo:** `src/app/api/sentry-example-api/route.ts`

Cualquier usuario anónimo puede llamar `GET /api/sentry-example-api`. Lanza una excepción deliberadamente, lo que permite disparar miles de alertas falsas en Sentry agotando el plan de monitoreo (DoS económico) y revela que la app usa Sentry.

**Fix:** Eliminar este archivo en producción, o protegerlo con `auth: 'session'` + rol `dev`.

---

## Bugs de alta severidad

### ALTO-1: `/admin/reportes` — Sin ningún manejo de error

**Archivo:** `src/app/(admin)/reportes/page.tsx`

No hay `setError`, no hay `ErrorState`, ni `toast.error`. Si falla la carga de datos el usuario ve la UI vacía silenciosamente, sin ningún feedback ni opción de retry. Es la única página del admin completamente ciega a errores.

**Fix:** Agregar `setError` + `<ErrorState onRetry={cargarDatos} />` al igual que el resto de las páginas admin.

### ALTO-2: Sin headers de seguridad HTTP

**Archivo:** `next.config.ts` — actualmente vacío.

Faltan todos los headers críticos: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

**Fix:** Agregar la función `async headers()` en `next.config.ts` con los headers listados en `REPORTS/security_report.md` (ALTO-1).

### ALTO-3: `POST /api/empleado/chat` — `conversacionId` sin verificación de ownership

**Archivo:** `src/app/api/empleado/chat/route.ts:41-48`

Al cargar el historial de conversación, no se verifica que la conversación pertenezca al usuario autenticado. Un empleado puede leer el historial de otro si conoce su UUID.

**Fix:** Agregar `.eq('usuario_id', user!.id)` al query de `conversaciones_ia` antes de cargar mensajes.

### ALTO-4: `POST /api/admin/reporte/[id]` — verificación de empresa delegada solo a RLS

**Archivo:** `src/app/api/admin/reporte/[id]/route.ts:21-43`

No hay verificación explícita de que el `empleadoId` pertenece a la empresa del admin. Si RLS fallara, un admin podría generar reportes de empleados de otra empresa.

**Fix:** Agregar `if (empleado.empresa_id !== user!.empresaId) return ApiError.forbidden()` (igual que el patrón en `DELETE /api/admin/empleados/[id]`).

---

## Bugs de severidad media

### Patrón sistémico: `createClient()` fuera de `useCallback` — 6 archivos admin

**Severidad:** 🟡 Media (patrón crítico según CLAUDE.md — riesgo de loop infinito)

Afecta:
- `src/app/(admin)/empleados/page.tsx` — línea 365
- `src/app/(admin)/empleados/[id]/page.tsx` — líneas 565, 646, 666
- `src/app/(admin)/contenido/page.tsx` — líneas 151, 181, 205
- `src/app/(admin)/contenido/[modulo]/page.tsx` — líneas 170, 202, 222, 250
- `src/app/(admin)/conocimiento/page.tsx` — líneas 163, 191, 228
- `src/app/(admin)/configuracion/page.tsx` — líneas 104, 172, 193, 204, 225

**Fix:** Mover cada `createClient()` al interior del `useCallback` o handler que lo usa, y removerlo de las dependencias del array.

### Patrón sistémico: Error state ausente en 5 páginas

**Severidad:** 🟡 Media

| Página | Comportamiento actual |
|--------|-----------------------|
| `/empleado` home | `catch {}` silencioso — pantalla en blanco |
| `/auth/login` | Solo `toast` — sin `ErrorState` en el cuerpo |
| `/admin/contenido` | Solo `toast.error` + `console.error` |
| `/admin/conocimiento` | Solo `console.error` |
| `/admin/configuracion` | Solo `toast.error` |

**Fix:** Agregar `<ErrorState onRetry={cargarDatos} />` en el render cuando `error !== null`.

### MEDIO-1: `POST /api/admin/reporte/[id]` — cálculo incorrecto de `pctRol`

**Archivo:** `src/app/api/admin/reporte/[id]/route.ts:85`

`pctRol` devuelve `100` si hay al menos UN bloque completado, en lugar de calcular porcentaje real. Un empleado con 1/10 bloques completos muestra 100%.

**Fix:** Usar el mismo patrón de cálculo que `pctCultura` (ver `REPORTS/qa_api.md` para el snippet).

### MEDIO-2: `DELETE /api/admin/empleados/[id]` — cascade delete incompleto

No limpia: `tareas_onboarding`, `encuestas_pulso`, `accesos`, `equipo_relaciones`, `alertas_conocimiento`, `herramientas_rol`, `objetivos_rol`.

**Fix:** Agregar deletes de las tablas faltantes, o configurar `ON DELETE CASCADE` en las FK de Supabase.

### MEDIO-3: Mensajes de error internos de Supabase expuestos al cliente

**Archivos:** `passwords/route.ts`, `empleados/[id]/route.ts`, `api-keys/[id]/route.ts`

`ApiError.internal(updateError.message)` expone nombres de tablas y restricciones de DB.

**Fix:** Usar `ApiError.internal()` sin argumentos; loggear el error solo en el servidor.

### MEDIO-4: GChat webhook — fallback inseguro sin `GCHAT_SERVICE_ACCOUNT_JSON`

**Archivo:** `src/app/api/bot/gchat/route.ts`

Sin la variable de entorno, cualquier cuenta de Google autenticada puede enviar mensajes al bot.

**Fix:** Rechazar todas las peticiones si `GCHAT_SERVICE_ACCOUNT_JSON` no está configurada.

### MEDIO-5: Zod validation details expuestos en producción

**Archivo:** `src/lib/api/withHandler.ts:219`

Los `parsed.error.issues` (con nombres de campos, tipos, restricciones) se retornan al cliente en todos los ambientes.

**Fix:** Envolver en `process.env.NODE_ENV !== 'production' && { details: ... }`.

### MEDIO-6: Password/datos sensibles en logs de validación

**Archivo:** `src/lib/api/withHandler.ts:214`

`rawBody` se loggea cuando falla la validación Zod — puede contener passwords o tokens.

**Fix:** Eliminar `rawBody` del `console.log` de validación.

### MEDIO-7: Tipo inseguro `as unknown as` en 2 archivos

- `src/app/(admin)/reportes/encuestas/page.tsx:216` — `as unknown as EncuestaRow[]`
- `src/app/(empleado)/rol/page.tsx:621` — `as unknown as { nombre: string }`

Indica desalineación entre la forma de datos de DB y los tipos locales.

### MEDIO-8: `POST /api/empleado/chat` — sin restricción de rol

Sin `rol: 'empleado'` en el handler, admins y devs pueden llamar el endpoint y obtener comportamiento indefinido.

**Fix:** Agregar `rol: 'empleado'` a las opciones de `withHandler`.

---

## Bugs de baja severidad

| # | Área | Descripción |
|---|------|-------------|
| B-1 | Seguridad | CORS wildcard `*` en `/api/v1/*` — restringir a orígenes conocidos |
| B-2 | Seguridad | `safeDecrypt` retorna plaintext sin advertencia para valores legacy en DB |
| B-3 | Seguridad | `POST /api/auth/login` expone si un email existe o no (email enumeration) |
| B-4 | API | `GET /api/admin/empleados` devuelve 405 — el listado se hace directo desde Supabase client (inconsistente con docs) |
| B-5 | Funcional | `console.error` en producción en: `/empleado`, `/empleado/perfil`, `/empleado/rol`, `/empleado/asistente`, API chat |
| B-6 | Funcional | Strings hardcodeados sin i18n: `"CopilBot"` en M4, `"Completado ✓"` y otros en M2 |
| B-7 | Funcional | Gradiente incorrecto en `/admin` — `from-cyan-500 to-indigo-500` no sigue paleta del diseño (Navy/Indigo/Teal) |
| B-8 | Funcional | `console.log('[chat:tokens]', ...)` expone datos de consumo de tokens en producción |

---

## Problema sistémico global: Colores hardcodeados (27 archivos)

**Severidad: 🟡 Media (bloquea dark mode)**

Todas las páginas del proyecto usan clases Tailwind hardcodeadas en lugar de variables CSS del sistema de diseño. El CLAUDE.md exige dark mode elegante estilo Linear/Vercel Dashboard, pero estos hardcodes hacen que la app se vea siempre en modo claro.

| Clase hardcodeada | Debería ser |
|-------------------|-------------|
| `bg-white` | `bg-background` / `var(--background)` |
| `bg-gray-50` / `bg-gray-100` | `var(--surface)` |
| `text-gray-900` / `text-gray-700` | `var(--foreground)` |
| `border-gray-200` | `var(--border)` |

**Archivos afectados:** 27 archivos en `src/app/` (empleado/*, admin/*, auth/login).

---

## Lo que está bien ✅

| Área | Estado |
|------|--------|
| Loading states | ✅ Presentes en todas las páginas (16/16) |
| Framer Motion | ✅ Presente en todas las páginas |
| `createClient()` en páginas empleado | ✅ Correcto en home, perfil, cultura, rol, asistente |
| Encriptación de passwords | ✅ AES-256-GCM con IV aleatorio por operación |
| Autenticación centralizada | ✅ `withHandler` aplica auth/rol/rate-limit consistentemente |
| Aislamiento de tenants | ✅ `empresa_id` desde JWT, nunca del body |
| Timing attacks | ✅ `crypto.timingSafeEqual` en CRON_SECRET |
| Rate limiting | ✅ En login, register, chat, bot, encuestas |
| Sin secretos hardcodeados | ✅ Ningún `sk-`, token o password en el código |
| Service Role Key | ✅ Solo en server-side, nunca expuesta al cliente |
| Scopes de API Key | ✅ `hasScope()` verificado antes de retornar datos |
| Sin SQL injection | ✅ Supabase client parametriza todo |
| Organigrama admin | ✅ Sin bugs relevantes |
| Empty states | ✅ Diseñados en todas las páginas (excepto configuración) |

---

## Roadmap de corrección priorizado

### Inmediato (antes de poner usuarios en producción)

1. **CRIT-1:** Eliminar `sentry-example-api/route.ts` o proteger con auth
2. **ALTO-2:** Agregar headers de seguridad en `next.config.ts`
3. **ALTO-3:** Verificar ownership de `conversacionId` en chat API
4. **ALTO-1:** Agregar `ErrorState` con retry en `/admin/reportes`

### Corto plazo (sprint 1)

5. **ALTO-4:** Agregar check explícito de `empresa_id` en reporte API
6. Mover `createClient()` dentro de callbacks en los 6 archivos admin afectados
7. Agregar `ErrorState` con retry en `/empleado`, `/auth/login`, `/admin/contenido`, `/admin/conocimiento`, `/admin/configuracion`
8. **MEDIO-3/4:** Corregir exposición de mensajes de error internos y rawBody en logs
9. **MEDIO-5:** Ocultar Zod details en producción

### Medio plazo (sprint 2)

10. **MEDIO-1:** Corregir cálculo de `pctRol` en reporte API
11. **MEDIO-2:** Completar cascade delete en `DELETE /api/admin/empleados/[id]`
12. **MEDIO-6/7:** Corregir GChat fallback y restricción de rol en chat
13. Migrar colores hardcodeados a CSS vars (prerrequisito para dark mode real)
14. Corregir casts `as unknown as` en reportes/encuestas y empleado/rol

### Bajo (backlog)

15. Restringir CORS en `/api/v1/*`
16. Migrar valores legacy en DB a AES-256-GCM
17. Normalizar mensaje de error en login (anti-enumeration)
18. Eliminar `console.log/error/warn` de producción
19. Mover strings hardcodeados a i18n
20. Implementar `GET /api/admin/empleados` o actualizar documentación

---

*Reporte consolidado generado el 2026-04-12 por QATester1 — basado en HEE-18 (Funcional), HEE-19 (API), y auditoría de seguridad*
