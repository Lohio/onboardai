# QA Report — Testing Funcional Heero
**Fecha:** 2026-04-12  
**Agente:** QATester1 (HEE-18)  
**Metodología:** Análisis estático del código fuente

---

## Resumen ejecutivo

| Severidad | Total |
|-----------|-------|
| 🔴 Alta   | 1     |
| 🟡 Media  | 12    |
| 🟢 Baja   | 9     |

**Problema sistémico principal:** Todos los archivos de página usan clases Tailwind hardcodeadas (`bg-white`, `bg-gray-*`, `text-gray-*`, `border-gray-*`) en lugar de variables CSS (`var(--background)`, etc.). Esto bloquea cualquier implementación real de tema oscuro/claro, a pesar de que el diseño exige dark mode elegante.

---

## `/empleado` — Home

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 1 | 🟡 Media | Error state ausente | Error capturado con `catch { /* silenciar */ }` — el usuario ve pantalla en blanco sin retry |
| 2 | 🟢 Baja | Console | `console.error('[EmpleadoHome] Error cargando datos base:', err)` en producción |
| 3 | 🟢 Baja | Colores hardcodeados | `bg-white`, `bg-gray-*` en toda la página — no responde a cambios de tema |

**Notas:** Loading state ✅ | Framer Motion ✅ | Empty states ✅

---

## `/empleado/perfil` — M1: Datos personales

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 4 | 🟢 Baja | Console | `console.error('Error cargando perfil:', err)` en producción |
| 5 | 🟢 Baja | Colores hardcodeados | `bg-white`, `bg-gray-50`, `border-gray-200` en cards y skeleton — sin CSS vars |

**Notas:** Loading state ✅ | Error state con retry ✅ | Framer Motion ✅ | `createClient()` dentro de callbacks ✅

---

## `/empleado/cultura` — M2: Cultura e identidad

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 6 | 🟡 Media | Texto hardcodeado (i18n) | `"Completado ✓"`, `"Organigrama de la empresa"`, `"Se marcará como visto en unos segundos"`, `"Módulo 2"`, `"Cultura"` — no pasan por el sistema de i18n |
| 7 | 🟢 Baja | Colores hardcodeados | `bg-white`, `bg-gray-*`, `text-gray-900`, `text-teal-600` hardcodeados |

**Notas:** Loading state ✅ | Error state con retry ✅ | Framer Motion ✅ | Empty states ✅

---

## `/empleado/rol` — M3: Rol y herramientas

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 8 | 🟡 Media | Tipo inseguro | `as unknown as { nombre: string }` en línea 621 — bypass de tipos que puede silenciar errores de forma de datos |
| 9 | 🟢 Baja | Colores hardcodeados | `bg-white`, `bg-gray-*` en cards, skeleton, tabla de autonomía |
| 10 | 🟢 Baja | Console | Múltiples `console.warn('[M3] ...')` en producción |

**Notas:** Loading state ✅ | Error state con retry ✅ | Framer Motion ✅ | Empty states ✅ | `createClient()` dentro de callbacks ✅

---

## `/empleado/asistente` — M4: Chat IA

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 11 | 🟡 Media | Texto hardcodeado (i18n) | `"CopilBot"` hardcodeado en JSX (línea 317) — no pasa por i18n |
| 12 | 🟢 Baja | Console | `console.error('Error en chat:', err)` en producción |

**Notas:** Loading state ✅ | Error state inline ✅ | Framer Motion ✅

---

## `/auth/login` — Login

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 13 | 🟡 Media | Error state ausente | Errores mostrados solo vía `toast` — no hay ErrorState visible con retry en el cuerpo de la página |
| 14 | 🟢 Baja | Colores hardcodeados | `bg-white`, `bg-gray-*` en el formulario |

**Notas:** Loading state ✅ | Framer Motion ✅

---

## `/admin` — Dashboard

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 15 | 🟡 Media | Colores de marca incorrectos | Gradiente `from-cyan-500 to-indigo-500` no sigue paleta del diseño (Navy `#0F1F3D`, Indigo `#3B4FD8`, Teal `#0D9488`) |
| 16 | 🟢 Baja | Colores hardcodeados | `bg-white`, `bg-gray-*` en toda la página |

**Notas:** Loading state ✅ | Error state ✅ | Framer Motion ✅

---

## `/admin/empleados` — Lista de empleados

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 17 | 🟡 Media | `createClient()` fuera de callback | Línea 365: `createClient()` llamado fuera de un `useCallback` — viola el patrón crítico del CLAUDE.md, riesgo de loop infinito |

**Notas:** Loading state ✅ | Error state ✅ | Framer Motion ✅

---

## `/admin/empleados/[id]` — Detalle del empleado

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 18 | 🟡 Media | `createClient()` fuera de callback | Líneas 565, 646, 666: múltiples `createClient()` fuera de `useCallback` — viola patrón crítico del CLAUDE.md |

**Notas:** Loading state ✅ | Error state ✅ | Framer Motion ✅

---

## `/admin/contenido` — Selector de módulo

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 19 | 🟡 Media | Error state ausente | Errores solo van a `toast.error` + `console.error`, sin `ErrorState` con retry en la página |
| 20 | 🟡 Media | `createClient()` fuera de callback | Líneas 151, 181, 205 — viola patrón crítico del CLAUDE.md |

---

## `/admin/contenido/[modulo]` — Edición de bloques

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 21 | 🟡 Media | `createClient()` fuera de callback | Líneas 170, 202, 222, 250 — múltiples instancias, viola patrón crítico del CLAUDE.md |

**Notas:** Loading state ✅ | Framer Motion ✅

---

## `/admin/conocimiento` — Knowledge base

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 22 | 🟡 Media | Error state ausente | Error de carga va a `console.error` solamente — usuario no recibe feedback ni puede reintentar |
| 23 | 🟡 Media | `createClient()` fuera de callback | Líneas 163, 191, 228 — viola patrón crítico del CLAUDE.md |

---

## `/admin/reportes` — Kanban + encuestas

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 24 | 🔴 Alta | Sin manejo de error | No hay `setError`, no hay `ErrorState`, ni `toast.error` — si falla la carga de datos el usuario ve UI vacía silenciosamente sin ningún feedback |

**Notas:** Loading state ✅ | Empty states ✅ | Framer Motion ✅

---

## `/admin/reportes/encuestas` — Resultados de encuestas

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 25 | 🟡 Media | Tipo inseguro | `as unknown as EncuestaRow[]` en línea 216 — bypass de tipo, indica desalineación entre shape de DB y tipo local |

**Notas:** Loading state ✅ | Error state ✅ | Framer Motion ✅

---

## `/admin/organigrama` — Editor visual

**Sin bugs críticos encontrados.**  
**Notas:** Loading state ✅ | Error state con retry ✅ | Framer Motion ✅

---

## `/admin/configuracion` — Config empresa

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 26 | 🟡 Media | Error state ausente | Error de carga solo muestra `toast.error`, sin `ErrorState` visible con retry |
| 27 | 🟡 Media | `createClient()` fuera de callback | Líneas 104, 172, 193, 204, 225 — viola patrón crítico del CLAUDE.md |

---

## API Routes

| # | Severidad | Tipo | Descripción |
|---|-----------|------|-------------|
| 28 | 🟢 Baja | Console | `console.log('[chat:tokens]', ...)` en `app/api/empleado/chat/route.ts` línea 146 — expone datos de tokens en producción |

---

## Problema sistémico: Colores hardcodeados (todas las páginas)

**Severidad: 🟡 Media (global)**

Todas las páginas del proyecto (`/empleado/*`, `/admin/*`, `/auth/login`) usan clases Tailwind hardcodeadas en lugar de variables CSS del sistema de diseño:

- `bg-white` → debería ser `bg-background` o `var(--background)`
- `bg-gray-50` / `bg-gray-100` → debería ser `var(--surface)`
- `text-gray-900` / `text-gray-700` → debería ser `var(--foreground)`
- `border-gray-200` → debería ser `var(--border)`

**Impacto:** El sistema de temas oscuro/claro no puede funcionar correctamente. El CLAUDE.md exige dark mode elegante estilo Linear/Vercel Dashboard, pero con estos hardcodes la app se ve siempre en modo claro.

**Archivos afectados:** 27 archivos en total (ver lista completa con `grep -rln "bg-white\|bg-gray-50" src/app/`).

---

## Checklist de criterios de diseño por página

| Página | Loading | Error+Retry | Empty state | Framer Motion | CSS vars (tema) |
|--------|---------|-------------|-------------|---------------|-----------------|
| `/empleado` | ✅ | ❌ | ✅ | ✅ | ❌ |
| `/empleado/perfil` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/empleado/cultura` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/empleado/rol` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/empleado/asistente` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/auth/login` | ✅ | ❌ | N/A | ✅ | ❌ |
| `/admin` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/admin/empleados` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/admin/empleados/[id]` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/admin/contenido` | ✅ | ❌ | ✅ | ✅ | ❌ |
| `/admin/contenido/[modulo]` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/admin/conocimiento` | ✅ | ❌ | ✅ | ✅ | ❌ |
| `/admin/reportes` | ✅ | ❌ | ✅ | ✅ | ❌ |
| `/admin/reportes/encuestas` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/admin/organigrama` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `/admin/configuracion` | ✅ | ❌ | N/A | ✅ | ❌ |

---

## Prioridad de corrección recomendada

1. **Inmediato (Alta):** `/admin/reportes` — añadir `setError` + `ErrorState` con retry
2. **Corto plazo (Media):** Auditar y mover todos los `createClient()` fuera de `useCallback` a dentro del callback en: `admin/empleados`, `admin/empleados/[id]`, `admin/contenido`, `admin/contenido/[modulo]`, `admin/conocimiento`, `admin/configuracion`
3. **Corto plazo (Media):** Añadir `ErrorState` con retry a: `/empleado`, `/auth/login`, `/admin/contenido`, `/admin/conocimiento`, `/admin/configuracion`
4. **Medio plazo (Media):** Migrar colores hardcodeados a CSS vars en todas las páginas — prerrequisito para dark mode real
5. **Bajo (Media):** Corregir casts `as unknown as` en `reportes/encuestas` y `empleado/rol`
6. **Bajo:** Eliminar `console.log/error/warn` de producción; mover strings hardcodeados a i18n
