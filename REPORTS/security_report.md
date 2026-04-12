# Reporte de Auditoría de Seguridad — Heero (OnboardAI)

**Fecha:** 2026-04-12  
**Auditor:** SecurityExpert Agent  
**Codebase:** `C:\Users\Maxi\onboardai\src\`  
**Alcance:** API routes, autenticación, encriptación, configuración de seguridad

---

## Resumen Ejecutivo

Se auditaron 25 archivos de rutas API, el sistema de encriptación, el middleware central (`withHandler`), la configuración de CORS y los headers de seguridad. No se encontraron secretos hardcodeados ni inyecciones SQL directas. El patrón de autenticación centralizado en `withHandler` es robusto. Sin embargo, se identificaron **2 hallazgos críticos/altos** y **4 medios** que requieren atención.

---

## Hallazgos Críticos

### CRÍTICO-1: Endpoint de Sentry sin autenticación expuesto públicamente

**Archivo:** `src/app/api/sentry-example-api/route.ts`  
**Descripción:** El endpoint `GET /api/sentry-example-api` no tiene autenticación alguna. Cualquier usuario anónimo puede llamarlo. Lanza una excepción `SentryExampleAPIError` deliberadamente, lo que genera alertas falsas en Sentry y consume créditos de monitoreo.

```ts
// Sin auth, accesible públicamente
export function GET() {
  Sentry.logger.info("Sentry example API called");
  throw new SentryExampleAPIError("This error is raised on the backend...");
}
```

**Riesgo:** Un atacante puede disparar miles de errores de Sentry agotando el plan de monitoreo (DoS económico), o usar el endpoint para detectar que la app usa Sentry y orientar ataques específicos.

**Remediación:** Eliminar este archivo en producción. Si se necesita para desarrollo, protegerlo con `auth: 'session'` y rol `dev`, o excluirlo del build de producción con una variable de entorno.

---

## Hallazgos Altos

### ALTO-1: Ausencia total de headers de seguridad HTTP

**Archivo:** `next.config.ts`  
**Descripción:** El archivo de configuración está vacío. No hay headers de seguridad configurados.

```ts
const nextConfig: NextConfig = {
  /* config options here */  // completamente vacío
};
```

**Headers faltantes:**
- `Content-Security-Policy` (CSP) — sin él, XSS puede ejecutar scripts de cualquier origen
- `Strict-Transport-Security` (HSTS) — sin él, los navegadores no fuerzan HTTPS
- `X-Frame-Options: DENY` — sin él, la app puede ser embebida en iframes (clickjacking)
- `X-Content-Type-Options: nosniff` — sin él, navegadores pueden ejecutar MIME sniffing
- `Referrer-Policy` — sin él, se filtran URLs completas en el header Referer
- `Permissions-Policy` — sin él, el navegador puede habilitar cámara/micrófono sin restricciones

**Remediación:** Agregar en `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://js.sentry-cdn.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://sentry.io",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};
```

---

## Hallazgos Medios

### MEDIO-1: Mensajes de error internos expuestos en respuestas HTTP

**Archivos:**
- `src/app/api/admin/empleados/[id]/passwords/route.ts`
- `src/app/api/admin/empleados/[id]/route.ts`  
- `src/app/api/admin/api-keys/[id]/route.ts`

**Descripción:** Algunos handlers pasan el mensaje de error de Supabase directamente al cliente:

```ts
// Expone mensajes internos de la DB al cliente
return ApiError.internal(updateError.message)
return ApiError.internal('SUPABASE_SERVICE_ROLE_KEY no configurada en el servidor')
```

Los mensajes de error de Supabase pueden contener nombres de tablas, columnas, restricciones (`unique_violation`, `foreign_key_violation`) que revelan la estructura interna de la base de datos. La segunda variante revela que la app usa Supabase con un service role.

**Remediación:** Usar siempre `ApiError.internal()` sin argumentos para errores de BD, y loggear el error real en el servidor:

```ts
if (updateError) {
  console.error('[passwords] Error actualizando:', updateError)
  return ApiError.internal()  // sin exponer el mensaje
}
```

### MEDIO-2: Verificación de token de Google Chat insuficiente sin service account configurado

**Archivo:** `src/app/api/bot/gchat/route.ts`  
**Descripción:** Si la variable `GCHAT_SERVICE_ACCOUNT_JSON` no está configurada, el fallback solo verifica que el Bearer token sea un token de Google válido con cualquier email:

```ts
// Fallback débil si no hay service account configurado
return !!data.email  // cualquier cuenta Google autenticada pasa
```

Un atacante con una cuenta de Google válida podría enviar mensajes al bot gchat haciéndose pasar por usuarios reales.

**Remediación:** Hacer obligatoria la variable `GCHAT_SERVICE_ACCOUNT_JSON`. Si no está configurada, rechazar todas las peticiones al endpoint:

```ts
if (!expectedEmail) {
  console.error('[gchat] GCHAT_SERVICE_ACCOUNT_JSON no configurada')
  return false  // en lugar del fallback débil
}
```

### MEDIO-3: Schema Zod completo expuesto en respuestas de validación

**Archivo:** `src/lib/api/withHandler.ts` (línea 219)  
**Descripción:** Cuando falla la validación Zod, se retorna el detalle completo de los issues al cliente:

```ts
return NextResponse.json(
  { error: 'Datos inválidos', details: parsed.error.issues, requestId },
  { status: 400 }
)
```

Esto expone los nombres exactos de campos, tipos esperados, longitudes mínimas/máximas y mensajes de validación personalizados, permitiendo a un atacante reconstruir los schemas y optimizar ataques.

**Remediación:** En producción, devolver solo un mensaje genérico:

```ts
return NextResponse.json(
  {
    error: 'Datos inválidos',
    ...(process.env.NODE_ENV !== 'production' && { details: parsed.error.issues }),
    requestId,
  },
  { status: 400 }
)
```

### MEDIO-4: Datos de password en logs al fallar validación

**Archivo:** `src/lib/api/withHandler.ts` (línea 214)  
**Descripción:** El handler loggea el body completo cuando falla la validación Zod:

```ts
console.log('[withHandler] Datos inválidos:', {
  path: new URL(req.url).pathname,
  rawBody,  // puede contener passwords, tokens, datos sensibles
  issues: parsed.error.issues,
})
```

Si se envía una petición malformada a `/api/auth/login` o `/api/admin/empleados/[id]/passwords`, el password podría quedar en logs de servidor/Vercel.

**Remediación:** Eliminar `rawBody` del log o aplicar redacción de campos sensibles:

```ts
console.log('[withHandler] Datos inválidos:', {
  path: new URL(req.url).pathname,
  // rawBody omitido — puede contener datos sensibles
  issues: parsed.error.issues,
})
```

---

## Hallazgos Bajos

### BAJO-1: CORS wildcard en API pública v1

**Archivos:** `src/app/api/v1/empleados/route.ts`, `v1/empleados/[id]/route.ts`, `v1/encuestas/route.ts`  
**Descripción:** Todos los endpoints `/api/v1/*` responden a preflight CORS con `Access-Control-Allow-Origin: *`. Si bien los endpoints requieren API key, el wildcard permite que cualquier sitio web en un navegador de usuario intente requests (el navegador sí enviará el header Authorization en ese caso si el código JS lo incluye).

**Remediación:** Restringir a orígenes conocidos cuando sea posible. La lib `cors.ts` ya tiene soporte para `origins` por empresa — usar eso en lugar del wildcard genérico.

### BAJO-2: Fallback de plaintext en `safeDecrypt`

**Archivo:** `src/lib/encryption.ts`  
**Descripción:** `safeDecrypt` retorna valores en plaintext si no tienen el formato `iv:tag:data`:

```ts
if (parts.length !== 3) {
  return value  // Plaintext legacy — devolver como está
}
```

Si existen registros con `password_corporativo` o `password_bitlocker` sin encriptar en la DB (anteriores a la implementación de encriptación), se retornan como texto plano sin ninguna advertencia ni log de auditoría.

**Remediación:** Agregar un log de advertencia cuando se detecta plaintext, y planificar una migración para cifrar todos los valores legacy:

```ts
if (parts.length !== 3) {
  console.warn('[safeDecrypt] Valor en plaintext detectado — pendiente migración')
  return value
}
```

---

## Aspectos Bien Implementados

| Área | Evaluación |
|------|-----------|
| **Encriptación** | AES-256-GCM con IV aleatorio por operación — implementación correcta |
| **Autenticación centralizada** | `withHandler` aplica auth/rol/rate-limit de forma consistente en todos los endpoints |
| **Aislamiento de tenants** | `empresa_id` propagado desde el JWT de Supabase, nunca del body del cliente |
| **Protección contra timing attacks** | CRON_SECRET usa `crypto.timingSafeEqual` |
| **Rate limiting** | Aplicado en login, register, chat, bot, encuestas |
| **Sin secretos hardcodeados** | No se encontró ningún `sk-`, token o password en el código fuente |
| **Service Role Key** | Solo se usa en server-side API routes, nunca en cliente |
| **Scopes de API Key** | Sistema `hasScope()` implementado y verificado antes de retornar datos |
| **Teams webhook** | HMAC-SHA256 implementado correctamente con timing-safe comparison |
| **Validación de inputs** | Zod schemas en todos los endpoints que reciben body |
| **Sin SQL injection** | Supabase client parametriza automáticamente; no se detectaron queries con interpolación de strings |

---

## Checklist de Remediación Priorizada

| Prioridad | Hallazgo | Acción |
|-----------|---------|--------|
| 🔴 Crítico | Sentry endpoint público | Eliminar o proteger con auth en producción |
| 🟠 Alto | Sin headers de seguridad | Agregar headers en `next.config.ts` |
| 🟡 Medio | Error messages internos | Usar `ApiError.internal()` sin mensaje en todos los errores de DB |
| 🟡 Medio | GChat fallback inseguro | Hacer `GCHAT_SERVICE_ACCOUNT_JSON` obligatorio |
| 🟡 Medio | Zod details en producción | Ocultar `details` en producción |
| 🟡 Medio | Body en logs de validación | Eliminar `rawBody` del log de validación |
| 🔵 Bajo | CORS wildcard v1 | Restringir a orígenes conocidos |
| 🔵 Bajo | Plaintext legacy en DB | Migrar y loggear detección de plaintext |

---

*Reporte generado el 2026-04-12 por SecurityExpert Agent (HEE-17)*
