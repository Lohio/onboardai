# QA Report — API Routes Heero
**Fecha:** 2026-04-12  
**Agente:** QATester2 (e331657f)  
**Scope:** Todas las API routes de `src/app/api/`

---

## Resumen ejecutivo

Se analizaron 25 endpoints distribuidos en 4 dominios: admin, empleado, auth y v1 (API pública).  
La arquitectura usa `withHandler` como wrapper central con soporte de autenticación por sesión, API key y cron — patrón sólido.  
Se encontraron **2 bugs de seguridad** (1 medio, 1 bajo), **3 bugs de datos/lógica**, y **2 inconsistencias de documentación**.

---

## Bugs por endpoint

### 🔴 ALTO — Sin hallazgos críticos

---

### 🟠 MEDIO

#### 1. `POST /api/empleado/chat` — `conversacionId` sin verificación de ownership
**Archivo:** `src/app/api/empleado/chat/route.ts:41-48`

```ts
const { data: mensajesHistorial } = await supabase!
  .from('mensajes_ia')
  .select('rol, contenido')
  .eq('conversacion_id', convId)  // ← sin .eq('usuario_id', user.id)
  .order('created_at', { ascending: true })
  .limit(20)
```

**Problema:** Si un empleado conoce el UUID de la conversación de otro usuario (por ejemplo, por exposición en logs o frontend), puede pasarlo como `conversacionId` en el body y cargar ese historial en su propio contexto de chat. No se verifica que la conversación pertenezca al usuario autenticado antes de cargarla.

**Impacto:** Lectura de mensajes de otro usuario. Gravedad media porque los UUIDs son difíciles de adivinar, pero es una violación de aislamiento de datos.

**Fix sugerido:**
```ts
if (convId) {
  // Verificar ownership primero
  const { data: conv } = await supabase!
    .from('conversaciones_ia')
    .select('id')
    .eq('id', convId)
    .eq('usuario_id', user!.id)  // ← agregar
    .single()
  if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  // luego cargar mensajes...
}
```

---

#### 2. `POST /api/admin/reporte/[id]` — Verificación de empresa delegada solo a RLS
**Archivo:** `src/app/api/admin/reporte/[id]/route.ts:21-43`

```ts
const [empleadoRes, ...] = await Promise.all([
  supabase
    .from('usuarios')
    .select('nombre, puesto, area, fecha_ingreso')
    .eq('id', empleadoId)
    .single(),
  ...
])
const empleado = empleadoRes.data
if (!empleado) return ApiError.notFound('Empleado')
// ← no hay check explícito: empleado.empresa_id !== user.empresaId
```

**Problema:** La ruta confía completamente en RLS de Supabase para aislar datos entre empresas. No hay verificación explícita en código de que el `empleadoId` de la URL pertenece a la empresa del admin autenticado. Si las políticas RLS de la tabla `usuarios` fallaran o tuvieran un gap, un admin podría generar reportes de empleados de otra empresa.

**Recomendación:** Agregar verificación explícita como defensa en profundidad (idéntico al patrón ya usado en `DELETE /api/admin/empleados/[id]`):
```ts
if (empleado.empresa_id !== user!.empresaId) return ApiError.forbidden()
```

---

### 🟡 BAJO

#### 3. `POST /api/auth/login` — Enumeration de emails vía mensaje de error
**Archivo:** `src/app/api/auth/login/route.ts`

```ts
if (signInError) {
  return NextResponse.json({ error: signInError.message }, { status: 401 })
}
```

**Problema:** Supabase devuelve mensajes distintos para "email no registrado" vs "contraseña incorrecta". Al retransmitir `signInError.message` directamente al cliente se permite enumerar si un email existe en el sistema.

**Fix sugerido:** Normalizar el mensaje:
```ts
return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
```

#### 4. `GET /api/admin/empleados` — Handler ausente (405 silencioso)
**Archivo:** `src/app/api/admin/empleados/route.ts`

El archivo solo exporta `POST`. La documentación en `CLAUDE.md` indica que este endpoint debería soportar `GET/POST`. Actualmente `GET /api/admin/empleados` retorna 405. El listado de empleados en el admin parece realizarse desde el cliente Supabase directamente (sin pasar por esta route), lo que es inconsistente con la documentación y puede generar confusión.

**Recomendación:** O documentar que GET se resuelve por cliente Supabase, o implementar el handler.

---

### 🟢 BUGS DE LÓGICA / DATOS

#### 5. `POST /api/admin/reporte/[id]` — Cálculo incorrecto de `pctRol`
**Archivo:** `src/app/api/admin/reporte/[id]/route.ts:85`

```ts
const pctRol = progresoRows.some(p => p.modulo === 'rol' && p.completado) ? 100 : 0
```

**Problema:** `pctRol` devuelve `0` o `100` dependiendo de si hay AL MENOS UN bloque de 'rol' completado. Esto es incorrecto — si el empleado completó 1 de 10 bloques del módulo Rol, el reporte mostrará "100%".

**Fix sugerido:** Usar el mismo patrón de cálculo que `pctCultura`:
```ts
const bloqueRolTotal = progresoRows.filter(p => p.modulo === 'rol').length
const pctRol = bloqueRolTotal > 0
  ? Math.round(progresoRows.filter(p => p.modulo === 'rol' && p.completado).length / bloqueRolTotal * 100)
  : 0
```

#### 6. `DELETE /api/admin/empleados/[id]` — Cascade delete incompleto
**Archivo:** `src/app/api/admin/empleados/[id]/route.ts:134-155`

El DELETE limpia `progreso_modulos`, `mensajes_ia` y `conversaciones_ia`, pero no limpia:
- `tareas_onboarding`
- `encuestas_pulso`
- `accesos` (tabla de accesos a herramientas)
- `equipo_relaciones` (donde el usuario puede ser manager o buddy de otro)
- `alertas_conocimiento`
- `herramientas_rol` / `objetivos_rol` (si existen por usuario)

**Impacto:** Datos huérfanos en DB. No es un riesgo de seguridad (el auth user se elimina, por lo que el login es imposible), pero puede afectar métricas de dashboard y causar FK errors si se reutilizan IDs.

**Fix:** Agregar deletes de las tablas faltantes antes de borrar la fila en `usuarios`, o configurar `ON DELETE CASCADE` en las FK de Supabase.

#### 7. `POST /api/empleado/chat` — rol no restringido
**Archivo:** `src/app/api/empleado/chat/route.ts:14-19`

```ts
export const POST = withHandler(
  {
    auth: 'session',
    // ← sin `rol: 'empleado'`
    schema: chatSchema,
    ...
  }
)
```

Usuarios `admin` y `dev` pueden llamar este endpoint. El endpoint carga datos del usuario con `.eq('id', user!.id)` — para un admin, puede devolver un perfil incompleto o null si no hay fila en `usuarios`. El comportamiento no está definido en este caso.

**Fix:** Agregar `rol: 'empleado'` a las opciones del handler.

---

## Lo que está bien ✅

| Endpoint | Check |
|----------|-------|
| `POST /api/admin/conocimiento/upload` | Verifica `user.empresaId !== empresaId` del FormData |
| `POST /api/empleado/encuesta-responder` | Verifica `encuesta.usuario_id !== user.id` antes de actualizar |
| `DELETE /api/admin/empleados/[id]` | Verifica empresa antes de borrar + rollback si falla |
| `POST /api/admin/empleados` | Rollback auth user si falla inserción en `usuarios` |
| `GET /api/admin/api-keys` | Filtra por `empresa_id` (dev ve todo, admin solo su empresa) |
| `GET /api/bot/recordatorios` | Usa `auth: 'cron'` con `timingSafeEqual` para CRON_SECRET |
| `POST /api/bot/teams` | Verifica HMAC antes de parsear body |
| `v1/*` | Scope checks (`empleados:read`, `progreso:read`, etc.) antes de operar |
| `withHandler` general | Rate limiting fail-open, request IDs, error sanitization |
| `POST /api/auth/register` | Rate limit activo; usa service role solo para bootstrap inicial |
| Passwords | AES-256-GCM encrypt/decrypt, nunca retorna ciphertext al cliente |

---

## Prioridad de fixes

| # | Endpoint | Severidad | Esfuerzo |
|---|----------|-----------|----------|
| 1 | `POST /api/empleado/chat` — ownership `conversacionId` | 🟠 Medio | Bajo (2 líneas) |
| 2 | `POST /api/admin/reporte/[id]` — check empresa explícito | 🟠 Medio | Bajo (1 línea) |
| 3 | `POST /api/admin/reporte/[id]` — cálculo `pctRol` | 🟡 Lógica | Bajo (3 líneas) |
| 4 | `DELETE /api/admin/empleados/[id]` — cascade incompleto | 🟡 Datos | Medio |
| 5 | `POST /api/auth/login` — email enumeration | 🟡 Bajo | Trivial |
| 6 | `POST /api/empleado/chat` — restricción de rol | 🟡 Bajo | Trivial |
| 7 | `GET /api/admin/empleados` — handler ausente | 📝 Docs | N/A |
