# Fixes y Mejoras — OnboardAI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corregir todos los bugs críticos, mejoras de performance y calidad de código identificados en el análisis del proyecto, sin romper funcionalidad existente.

**Architecture:** Fixes quirúrgicos archivo por archivo. Nada de refactors grandes. Cada tarea es atómica y testeable manualmente. Orden de ejecución: críticos → medios → bajos.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase, Claude API (streaming), Framer Motion

---

## FASE 1 — CRÍTICOS

---

### Task 1: Fix chat streaming — usar header en vez de separador `|--|`

**Problema:** El cliente parsea el `conversacionId` buscando `|--|` en los chunks del stream. Si el chunk llega partido justo en el separador, el parsing se rompe silenciosamente. El header `X-Conversation-Id` ya se envía desde el servidor pero el cliente lo ignora.

**Files:**
- Modify: `src/app/empleado/asistente/page.tsx` — función `enviar()`

**Código actual (líneas 179–215):**
```typescript
const res = await fetch('/api/empleado/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mensaje: texto, conversacionId }),
})
if (!res.ok || !res.body) throw new Error('Error en la respuesta')

// ... dentro del while loop:
if (chunk.includes('|--|')) {
  const [texto, convId] = chunk.split('|--|')
  acumulado += texto
  if (convId) setConversacionId(convId.trim())
} else {
  acumulado += chunk
}
```

**Step 1: Reemplazar el bloque `enviar()` desde el fetch hasta el fin del while loop**

Reemplazar las líneas 180–214 con:
```typescript
const res = await fetch('/api/empleado/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mensaje: texto, conversacionId }),
})

if (!res.ok || !res.body) throw new Error('Error en la respuesta')

// Leer conversacionId del header (ya lo envía el servidor)
const convIdHeader = res.headers.get('X-Conversation-Id')
if (convIdHeader) setConversacionId(convIdHeader)

const reader = res.body.getReader()
const decoder = new TextDecoder()
let acumulado = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const chunk = decoder.decode(value, { stream: true })

  // El servidor ya NO envía |--| en el stream.
  // Si por compatibilidad aún lo recibe, lo filtramos aquí.
  if (chunk.includes('|--|')) {
    acumulado += chunk.split('|--|')[0]
  } else {
    acumulado += chunk
  }

  setMensajes(prev =>
    prev.map(m =>
      m.id === idAssistant
        ? { ...m, contenido: acumulado, streaming: true }
        : m
    )
  )
}
```

**Step 2: Verificar manualmente**
1. Ir a `/empleado/asistente`
2. Enviar un mensaje
3. Verificar que la respuesta llega completa y el streaming funciona
4. Enviar un segundo mensaje — verificar que el historial se mantiene (el `conversacionId` se seteó correctamente)

**Step 3: Commit**
```bash
git add src/app/empleado/asistente/page.tsx
git commit -m "fix: usar header X-Conversation-Id en chat en vez de separador en stream"
```

---

### Task 2: Fix error silencioso en `cultura/page.tsx`

**Problema:** Si la query del perfil falla, `perfil` es `null` y la función retorna silenciosamente. El usuario ve la página sin contenido y sin mensaje de error.

**Files:**
- Modify: `src/app/empleado/cultura/page.tsx` — función `cargarDatos()`, líneas 587–593

**Código actual:**
```typescript
const { data: perfil } = await supabase
  .from('usuarios')
  .select('empresa_id')
  .eq('id', user.id)
  .single()

if (!perfil) return
```

**Step 1: Corregir el manejo del error**

Reemplazar esas líneas con:
```typescript
const { data: perfil, error: perfilError } = await supabase
  .from('usuarios')
  .select('empresa_id')
  .eq('id', user.id)
  .single()

if (perfilError || !perfil) throw new Error(perfilError?.message ?? 'Perfil no encontrado')
```

> Nota: el `throw` es correcto porque estamos dentro del `try/catch` que ya maneja `setHasError(true)` y muestra `<ErrorState />`.

**Step 2: Verificar manualmente**
- No hay forma sencilla de testear la falla en dev, pero verificar que la página `/empleado/cultura` carga con normalidad para un usuario válido.

**Step 3: Commit**
```bash
git add src/app/empleado/cultura/page.tsx
git commit -m "fix: error silencioso en cultura cuando falla query de perfil"
```

---

### Task 3: Fix cálculo de progreso en dashboard admin

**Problema:** `admin/page.tsx:315` asume que siempre hay exactamente 1 bloque de rol:
```typescript
const totalBloques = totalBloquesCultura + 1 // cultura + rol/general
```
Si una empresa tiene 0 bloques de rol, el denominador es mayor de lo real, inflando el progreso.

**Files:**
- Modify: `src/app/admin/page.tsx` — función `cargarDatos()`, bloque de queries paralelas

**Step 1: Agregar query de conteo de bloques de rol**

En el `Promise.all` donde se hace `culturaCountRes` (línea ~294), agregar una query más:
```typescript
const [progresoRes, alertasRes, culturaCountRes, rolCountRes] = await Promise.all([
  supabase
    .from('progreso_modulos')
    .select('usuario_id, modulo, bloque, completado')
    .in('usuario_id', empleadoIds),
  supabase
    .from('alertas_conocimiento')
    .select('id, pregunta, usuario_id, created_at, resuelta, usuarios(nombre)')
    .eq('empresa_id', empId)
    .eq('resuelta', false)
    .order('created_at', { ascending: false })
    .limit(5),
  supabase
    .from('conocimiento')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empId)
    .eq('modulo', 'cultura'),
  supabase
    .from('conocimiento')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empId)
    .eq('modulo', 'rol'),
])
```

**Step 2: Usar el conteo real en el cálculo**

Reemplazar las líneas que calculan `totalBloques`:
```typescript
// ANTES:
const totalBloquesCultura = culturaCountRes.count ?? 0
const totalBloques = totalBloquesCultura + 1

// DESPUÉS:
const totalBloquesCultura = culturaCountRes.count ?? 0
const totalBloquesRol = Math.max(1, rolCountRes.count ?? 1) // mínimo 1 para no dividir por 0 si aún no hay bloques
const totalBloques = totalBloquesCultura + totalBloquesRol
```

> Nota: `Math.max(1, ...)` asegura que nunca dividamos por 0 si la empresa aún no cargó contenido de rol.

**Step 3: Verificar manualmente**
- Abrir el dashboard de admin
- Verificar que los porcentajes de progreso se muestran correctamente
- Verificar que el semáforo de colores es coherente

**Step 4: Commit**
```bash
git add src/app/admin/page.tsx
git commit -m "fix: calcular total de bloques de rol dinámicamente en dashboard admin"
```

---

### Task 4: Fix preboarding — auto-actualizar flag en DB cuando la fecha ya pasó

**Problema:** `preboarding_activo` puede quedar `true` en la DB aunque la fecha de ingreso ya pasó. El cliente lo maneja correctamente (verifica la fecha), pero el admin puede ver al empleado como "en preboarding" si lee `preboarding_activo` directamente de la DB.

**Files:**
- Modify: `src/app/empleado/page.tsx` — función `cargarDatos()`

**Step 1: Agregar auto-cleanup del flag**

Después del bloque donde se calcula `enPreboarding` (línea ~228), agregar:
```typescript
// Si preboarding_activo está en true en DB pero la fecha ya pasó,
// actualizarlo en background para mantener consistencia
if (
  usuario?.preboarding_activo === true &&
  !!usuario?.fecha_ingreso &&
  new Date(usuario.fecha_ingreso) <= new Date()
) {
  // Fire-and-forget: no bloqueamos la UI
  const supabase2 = createClient()
  supabase2
    .from('usuarios')
    .update({ preboarding_activo: false })
    .eq('id', user.id)
    .then(() => {})
    .catch(() => {}) // silenciar — no es crítico
}
```

> Nota: Usar `createClient()` dentro del handler está bien — es un fire-and-forget que no afecta al estado de la página.

**Step 2: Verificar manualmente**
- Con un usuario que tenga `preboarding_activo = true` y `fecha_ingreso` en el pasado, abrir el home
- Verificar en Supabase que `preboarding_activo` se actualiza a `false` después de cargar la página

**Step 3: Commit**
```bash
git add src/app/empleado/page.tsx
git commit -m "fix: auto-limpiar flag preboarding_activo cuando la fecha de ingreso ya pasó"
```

---

### Task 5: Fix DELETE empleado — mejorar resiliencia del flujo

**Problema:** Si el paso de borrar `usuarios` (paso 3) falla, los datos de progreso ya fueron borrados en pasos 1–2, dejando datos huérfanos. Además, si `auth.deleteUser` falla, el auth user queda activo aunque la DB ya fue limpiada.

**Files:**
- Modify: `src/app/api/admin/empleados/[id]/route.ts` — handler `DELETE`

**Step 1: Reordenar operaciones para fail-fast y agregar logging**

Reemplazar el bloque de operaciones del DELETE (líneas 143–173) con:
```typescript
// Estrategia: primero eliminar auth user (fuente de acceso),
// luego limpiar datos. Si auth falla, abortamos antes de tocar datos.
const { error: authError } = await sa.auth.admin.deleteUser(id)
if (authError) {
  console.error('[DELETE empleado] Error eliminando auth user:', authError)
  return NextResponse.json(
    { error: 'No se pudo eliminar el usuario de autenticación. Datos conservados.' },
    { status: 500 }
  )
}

// Auth eliminado — ahora limpiar datos (si alguno falla, loguear pero continuar)
await sa.from('progreso_modulos').delete().eq('usuario_id', id)

const { data: convs } = await sa
  .from('conversaciones_ia')
  .select('id')
  .eq('usuario_id', id)

if (convs && convs.length > 0) {
  const ids = convs.map(c => c.id)
  await sa.from('mensajes_ia').delete().in('conversacion_id', ids)
  await sa.from('conversaciones_ia').delete().in('id', ids)
}

const { error: deleteError } = await sa
  .from('usuarios')
  .delete()
  .eq('id', id)

if (deleteError) {
  // Auth ya fue eliminado — el usuario no puede loguearse.
  // Loguear para limpieza manual.
  console.error('[DELETE empleado] Auth eliminado pero fila en usuarios no se pudo borrar:', deleteError)
}

return NextResponse.json({ ok: true })
```

**Step 2: Verificar manualmente**
- Crear un empleado de prueba desde admin
- Eliminarlo
- Verificar en Supabase Auth que el usuario ya no existe
- Verificar en tabla `usuarios` que la fila fue eliminada

**Step 3: Commit**
```bash
git add src/app/api/admin/empleados/[id]/route.ts
git commit -m "fix: reordenar DELETE empleado para eliminar auth primero y fail-fast"
```

---

## FASE 2 — MEDIOS

---

### Task 6: Throttle del scroll tracking en `cultura/page.tsx`

**Problema:** `handleScroll` recalcula `getBoundingClientRect()` de 5 elementos en cada pixel de scroll. En móviles lentos esto causa jank visible.

**Files:**
- Modify: `src/app/empleado/cultura/page.tsx` — `handleScroll` y su `useEffect`

**Step 1: Agregar ref para throttle**

Antes de la definición de `handleScroll` (línea ~636), agregar un ref:
```typescript
const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

**Step 2: Envolver `handleScroll` con throttle de 100ms**

Reemplazar el `useEffect` de scroll (líneas 653–657):
```typescript
useEffect(() => {
  const onScroll = () => {
    if (scrollThrottleRef.current) return
    scrollThrottleRef.current = setTimeout(() => {
      scrollThrottleRef.current = null
      handleScroll()
    }, 100)
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  handleScroll() // check estado inicial
  return () => {
    window.removeEventListener('scroll', onScroll)
    if (scrollThrottleRef.current) clearTimeout(scrollThrottleRef.current)
  }
}, [handleScroll])
```

**Step 3: Verificar manualmente**
- Abrir `/empleado/cultura` con DevTools → Performance
- Hacer scroll rápido
- Verificar que la barra de progreso de lectura sigue funcionando (con pequeño delay, normal)

**Step 4: Commit**
```bash
git add src/app/empleado/cultura/page.tsx
git commit -m "perf: throttle scroll tracking en módulo cultura (100ms)"
```

---

### Task 7: AbortController en streaming del asistente

**Problema:** Si el usuario navega a otra página mientras el asistente responde, el stream sigue corriendo en background, consumiendo recursos y potencialmente causando errores de state update en componente desmontado.

**Files:**
- Modify: `src/app/empleado/asistente/page.tsx`

**Step 1: Agregar ref para AbortController**

Después del `const bottomRef = useRef...` (línea ~128), agregar:
```typescript
const abortControllerRef = useRef<AbortController | null>(null)
```

**Step 2: Usar el AbortController en la función `enviar()`**

En la función `enviar()`, reemplazar el bloque del fetch:
```typescript
// Cancelar cualquier request anterior en curso
if (abortControllerRef.current) {
  abortControllerRef.current.abort()
}
abortControllerRef.current = new AbortController()

const res = await fetch('/api/empleado/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mensaje: texto, conversacionId }),
  signal: abortControllerRef.current.signal,
})
```

**Step 3: Limpiar al desmontar el componente**

Agregar un `useEffect` de cleanup (después del useEffect de `cargarUsuario`):
```typescript
useEffect(() => {
  return () => {
    // Cancelar stream si el componente se desmonta mientras responde
    abortControllerRef.current?.abort()
  }
}, [])
```

**Step 4: Manejar AbortError en el catch**

En el bloque `catch (err)` de `enviar()`:
```typescript
} catch (err) {
  // AbortError es intencional (navegación o nuevo mensaje) — no mostrar error
  if (err instanceof Error && err.name === 'AbortError') return
  console.error('Error en chat:', err)
  setErrorRed(true)
  setMensajes(prev => prev.filter(m => m.id !== idAssistant))
}
```

**Step 5: Verificar manualmente**
- Enviar un mensaje y navegar a otra página inmediatamente
- Verificar en Network tab que el request se cancela
- Verificar que no aparecen errores en consola

**Step 6: Commit**
```bash
git add src/app/empleado/asistente/page.tsx
git commit -m "fix: AbortController para cancelar streaming al desmontar asistente"
```

---

### Task 8: Celebración al completar M2 (Cultura) + CTA a M3

**Problema:** Cuando el empleado completa los 5 bloques de cultura, no hay feedback visual ni guía para seguir al módulo de Rol.

**Files:**
- Modify: `src/app/empleado/cultura/page.tsx`

**Step 1: Agregar estado de módulo completado**

Buscar donde se calcula si todos los bloques están completos. Si no existe, agregar un `useMemo` después de los estados:
```typescript
const moduloCompletado = useMemo(() => {
  return BLOQUES_ORDEN.every(b => progreso[b]?.completado === true)
}, [progreso])
```

**Step 2: Agregar banner de completado al final del JSX principal**

Justo antes del cierre del contenedor principal (antes del último `</div>`), agregar:
```typescript
{moduloCompletado && (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.3 }}
    className="mt-8 rounded-xl border border-teal-500/25 bg-teal-500/10 px-5 py-4"
  >
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-teal-200">
            ¡Completaste el módulo de Cultura!
          </p>
          <p className="text-xs text-teal-300/60 mt-0.5">
            Ya conocés la empresa. Ahora es momento de conocer tu rol.
          </p>
        </div>
      </div>
      <Link
        href="/empleado/rol"
        className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium
          text-teal-300 hover:text-teal-200 transition-colors"
      >
        Ir a Mi Rol
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  </motion.div>
)}
```

> Nota: `CheckCircle2` y `ArrowRight` ya están importados en muchas páginas — verificar imports y agregar si falta. `Link` de `next/link` también.

**Step 3: Verificar manualmente**
- En `/empleado/cultura`, completar todos los bloques
- Verificar que aparece el banner teal con el link a `/empleado/rol`

**Step 4: Commit**
```bash
git add src/app/empleado/cultura/page.tsx
git commit -m "feat: banner de completado en M2 con CTA a módulo de Rol"
```

---

## FASE 3 — BAJOS (Code Quality)

---

### Task 9: Extraer helpers repetidos a `src/lib/utils.ts`

**Problema:** `getInitials()`, `formatFecha()` / `formatDate()`, y `semaforoColor()` están definidos inline en 3+ archivos.

**Files:**
- Modify: `src/lib/utils.ts` — agregar las funciones
- Modify: `src/app/admin/page.tsx` — reemplazar definiciones locales por imports
- Modify: `src/app/admin/empleados/page.tsx` — ídem
- Modify: `src/app/empleado/perfil/page.tsx` — ídem

**Step 1: Leer `src/lib/utils.ts` actual para ver qué ya existe**

Antes de modificar, leer el archivo para no duplicar.

**Step 2: Agregar funciones a `src/lib/utils.ts`**
```typescript
/** Iniciales del nombre (ej: "Juan Pérez" → "JP") */
export function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')
}

/** Formatea una fecha ISO a dd/mm/aaaa */
export function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Clase de color según porcentaje (semáforo: ≥70 teal, ≥30 amber, <30 rojo) */
export function semaforoColor(pct: number): string {
  if (pct >= 70) return 'text-teal-400'
  if (pct >= 30) return 'text-amber-400'
  return 'text-red-400'
}

/** Clase de color de fondo según porcentaje */
export function semaforoBgColor(pct: number): string {
  if (pct >= 70) return 'bg-teal-400'
  if (pct >= 30) return 'bg-amber-400'
  return 'bg-red-400'
}
```

**Step 3: En cada archivo que las define localmente, reemplazar**

Para cada archivo (`admin/page.tsx`, `admin/empleados/page.tsx`, `empleado/perfil/page.tsx`):
1. Leer el archivo
2. Identificar la definición local de la función (ej: `function getInitials(...)`)
3. Eliminar la definición local
4. Agregar el import: `import { getInitials, formatFecha, semaforoColor } from '@/lib/utils'`
5. Verificar que el nombre de la función importada coincide con el uso en el archivo (algunos pueden usar `formatDate` en vez de `formatFecha` — adaptar)

**Step 4: Verificar manualmente**
- Abrir `/admin`, `/admin/empleados`, `/empleado/perfil`
- Verificar que siguen mostrando iniciales, fechas y colores correctamente

**Step 5: Commit**
```bash
git add src/lib/utils.ts src/app/admin/page.tsx src/app/admin/empleados/page.tsx src/app/empleado/perfil/page.tsx
git commit -m "refactor: extraer getInitials, formatFecha, semaforoColor a src/lib/utils.ts"
```

---

### Task 10: Centralizar magic numbers en `src/config/constants.ts`

**Problema:** Los umbrales del semáforo (`70`, `30`) y el default de bloques de cultura (`5`) están hardcodeados en múltiples archivos.

**Files:**
- Create: `src/config/constants.ts`
- Modify: archivos que usan estos valores

**Step 1: Crear `src/config/constants.ts`**
```typescript
// Semáforo de progreso
export const SEMAFORO_VERDE = 70   // ≥70% → teal
export const SEMAFORO_AMARILLO = 30 // ≥30% → amber, <30 → rojo

// Módulos
export const DEFAULT_BLOQUES_CULTURA = 5
export const BLOQUES_ONBOARDING = ['historia', 'mision', 'como_trabajamos', 'expectativas', 'hitos'] as const

// Encuestas de pulso
export const DIAS_ENCUESTA_PULSO = [7, 30, 60] as const

// Paginación
export const PAGE_SIZE_EMPLEADOS = 50
```

**Step 2: Reemplazar usos en el código**

Buscar con grep cada valor hardcodeado y reemplazar con el import de constants. Hacerlo archivo por archivo para no romper nada.

**Step 3: Commit**
```bash
git add src/config/constants.ts
git commit -m "refactor: centralizar magic numbers en src/config/constants.ts"
```

---

### Task 11: Unificar patrón de error handling en páginas del empleado

**Problema:** Tres patrones distintos coexisten — `throw`, `return` silencioso, `toast.error`. El patrón correcto para la app es `throw` dentro del `try/catch` que setea `hasError`.

**Files:**
- Audit: `src/app/empleado/rol/page.tsx`, `src/app/empleado/perfil/page.tsx`, `src/app/empleado/asistente/page.tsx`

**Step 1: Leer cada archivo y buscar `if (!x) return` dentro de funciones async**

Para cada `if (!x) return` dentro de un try/catch que maneja `hasError`:
- Reemplazar con `if (!x) throw new Error('...')`

**Step 2: Buscar `throw postgrestError` directo (sin `new Error()`)**

Reemplazar cualquier `throw postgrestError` con:
```typescript
throw new Error(postgrestError.message ?? 'Error desconocido')
```

**Step 3: Commit**
```bash
git add src/app/empleado/rol/page.tsx src/app/empleado/perfil/page.tsx
git commit -m "fix: unificar patrón de error handling en páginas del empleado"
```

---

## Resumen de commits esperados

| # | Commit | Archivo(s) |
|---|--------|-----------|
| 1 | `fix: usar header X-Conversation-Id en chat` | `asistente/page.tsx` |
| 2 | `fix: error silencioso en cultura cuando falla query de perfil` | `cultura/page.tsx` |
| 3 | `fix: calcular bloques de rol dinámicamente en dashboard admin` | `admin/page.tsx` |
| 4 | `fix: auto-limpiar flag preboarding_activo` | `empleado/page.tsx` |
| 5 | `fix: reordenar DELETE empleado para fail-fast` | `api/admin/empleados/[id]/route.ts` |
| 6 | `perf: throttle scroll tracking en cultura` | `cultura/page.tsx` |
| 7 | `fix: AbortController para cancelar streaming asistente` | `asistente/page.tsx` |
| 8 | `feat: banner completado M2 con CTA a M3` | `cultura/page.tsx` |
| 9 | `refactor: extraer helpers a src/lib/utils.ts` | `utils.ts`, 3 páginas |
| 10 | `refactor: centralizar magic numbers` | `constants.ts` |
| 11 | `fix: unificar error handling en páginas empleado` | `rol/page.tsx`, `perfil/page.tsx` |
