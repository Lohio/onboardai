# Diseño: Admin — Detalle de Empleado y Conocimiento

**Fecha:** 2026-03-15
**Rutas:**
- `/src/app/admin/empleado/[id]/page.tsx`
- `/src/app/admin/conocimiento/page.tsx`
- `/src/app/api/admin/reporte/[id]/route.ts`

---

## Contexto

Dos pantallas del panel admin de OnboardAI que completan el M5:
1. **Detalle de empleado** — vista profunda del progreso individual de un empleado, con reporte IA bajo demanda
2. **Gestión de conocimiento** — panel para que el admin cargue y mantenga el contenido que consumen los empleados, respondiendo alertas de conocimiento faltante

---

## Screen 1: `/admin/empleado/[id]/page.tsx`

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ← Volver al dashboard                                       │
│  [Foto 72px] Nombre completo                                 │
│              Puesto · Área                                   │
│              Ingresó el DD/MM/YYYY · Día N de onboarding    │
├──────────────────────────────────────────────────────────────┤
│  [PROGRESO POR MÓDULO]           [TAREAS PENDIENTES]         │
│  Cultura  ████████░░  72%        □ Tarea (semana 1)          │
│  Rol      ████░░░░░░  38%        □ Tarea (semana 2)          │
│  Asistente  3 conversaciones     (vacío state si no hay)     │
├──────────────────────────────────────────────────────────────┤
│  [TIMELINE DE ACTIVIDAD]         [ÚLTIMAS PREGUNTAS IA]      │
│  ● Completó "Misión" — hace 2d   "¿Cuáles son mis tareas?"  │
│  ● Completó "Historia" — hace 3d  resp: "Según el contenido…"│
│  ● Ingresó — 14/03               (collapse si > 5)          │
├──────────────────────────────────────────────────────────────┤
│  [▶ Generar reporte 30 días]                                 │
│  (panel expandible con streaming de texto)                   │
└──────────────────────────────────────────────────────────────┘
```

### Datos cargados (Promise.all)

| Query | Propósito |
|---|---|
| `usuarios` WHERE id | Header: foto, nombre, puesto, area, fecha_ingreso |
| `progreso_modulos` WHERE usuario_id | Calcular % por módulo |
| `conocimiento` COUNT WHERE empresa_id AND modulo='cultura' | Denominador progreso cultura |
| `tareas_onboarding` WHERE usuario_id AND completada=false | Panel tareas pendientes |
| `conversaciones_ia` + `mensajes_ia` últimas 5 | Últimas preguntas al asistente |
| `progreso_modulos` WHERE completado=true ORDER BY completado_at DESC | Timeline |

### Timeline

Eventos ordenados por fecha descendente:
- `fecha_ingreso` del usuario → evento "Ingresó a la empresa" (siempre primero desde el final)
- `progreso_modulos` donde `completado=true` → "Completó [bloque] en [módulo]"
- `tareas_onboarding` donde `completada=true` → "Completó tarea: [titulo]"

Mostrar máx. 10 eventos. Sin paginación.

### Últimas preguntas IA

- `conversaciones_ia` con `mensajes_ia` (primeros 2 mensajes: user + assistant)
- Mostrar: pregunta del usuario (truncada 100 chars) + respuesta del asistente (truncada 200 chars)
- Máx. 5 pares

### Reporte 30 días

**Endpoint:** `POST /api/admin/reporte/[id]`

**Prompt a Claude:**
```
Eres un asistente de RRHH. Generá un resumen ejecutivo del onboarding de [nombre].
Datos:
- Días en la empresa: N
- Progreso Cultura: X%
- Progreso Rol: Y%
- Tareas completadas: N/total
- Tareas pendientes: [lista]
- Preguntas más frecuentes: [lista]

El reporte debe tener secciones: Resumen Ejecutivo | Avances Destacados |
Áreas de Atención | Recomendaciones. Extensión: 300-400 palabras. Idioma: español.
```

**Streaming:** ReadableStream (mismo patrón que `/api/chat`). Muestra el texto progresivamente en un panel que aparece con `AnimatePresence` debajo del botón.

---

## Screen 2: `/admin/conocimiento/page.tsx`

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ALERTAS DE CONOCIMIENTO FALTANTE                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ "¿Cuál es la política de vacaciones?"  [Responder▸]  │   │
│  │  Ana García · hace 2h                                │   │
│  └──────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│  MÓDULO: CULTURA                  MÓDULO: ROL               │
│  ┌───────────────────────────┐   ┌──────────────────────┐   │
│  │ 🟢 Historia    [Editar]   │   │ 🟡 Puesto   [Editar] │   │
│  │ 🟢 Misión      [Editar]   │   │ ⚪ Autonomía [Agregar]│   │
│  │ 🟡 Cómo trabaj.[Editar]   │   └──────────────────────┘   │
│  │ ⚪ Expectativas [Agregar]  │                              │
│  │ ⚪ Hitos       [Agregar]   │                              │
│  └───────────────────────────┘                              │
└──────────────────────────────────────────────────────────────┘
```

### Estado de bloque

| Estado | Condición | Visual |
|---|---|---|
| Completo | contenido.length ≥ 100 | punto teal + botón "Editar" |
| Parcial | contenido.length 1-99 | punto amber + botón "Editar" |
| Vacío | sin registro en DB | punto gris + botón "Agregar" |

### Módulos y bloques hardcodeados

```ts
const MODULOS = [
  {
    key: 'cultura',
    label: 'Cultura e Identidad',
    bloques: ['historia', 'mision', 'como_trabajamos', 'expectativas', 'hitos']
  },
  {
    key: 'rol',
    label: 'Rol y Herramientas',
    bloques: ['puesto', 'autonomia']
  }
]
```

### Modal "Editar/Agregar contenido"

- Título en el header del modal
- Split view: izquierda textarea (markdown), derecha preview en vivo (render básico)
- Guardar → `upsert` en `conocimiento` (match por empresa_id + modulo + bloque)
- Al guardar: actualizar estado local (re-render del estado del bloque)

### Modal "Responder alerta"

1. Header: muestra la pregunta original
2. Select dropdown: "¿A qué bloque pertenece?" → lista de todos los bloques de los módulos
3. Textarea: contenido a agregar (con preview en vivo)
4. Al guardar:
   - Si el bloque ya existe: APPEND del nuevo contenido (separado por `\n\n---\n\n`)
   - Si no existe: INSERT nuevo registro
   - UPDATE `alertas_conocimiento` SET resuelta=true WHERE id
5. Actualizar estado local: quitar alerta del panel, actualizar estado del bloque

### Preview markdown

Sin librerías externas. Mini-parser propio de ~20 líneas:
- `**texto**` → `<strong>`
- `*texto*` → `<em>`
- `- item` → `<ul><li>`
- `\n\n` → párrafos separados
- Resto: texto plano

---

## API Route: `/api/admin/reporte/[id]/route.ts`

```ts
export async function POST(req, { params }) {
  // 1. getUser() — verificar que es admin
  // 2. Cargar datos del empleado desde Supabase
  // 3. Construir prompt
  // 4. Llamar a Claude (anthropic.messages.stream)
  // 5. Retornar ReadableStream con plain text chunks
}
```

---

## Animaciones

- Entrada de cards: stagger (mismo patrón que admin dashboard)
- Modales: `AnimatePresence` + scale + fade (desde centro)
- Panel reporte: `AnimatePresence` + slideDown desde el botón
- Timeline items: stagger vertical

---

## Sin dependencias nuevas

- Preview markdown: parser propio inline
- Sin librerías de WYSIWYG ni markdown renderer externo
