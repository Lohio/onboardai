# Diseño: Módulo 3 — Rol y Herramientas

**Fecha:** 2026-03-15
**Ruta:** `/src/app/empleado/rol/page.tsx`

---

## Contexto

Módulo 3 de OnboardAI. Muestra al empleado toda la información de su rol:
descripción del puesto, tabla de autonomía, herramientas con guías expandibles,
tareas de las primeras semanas con checkboxes interactivos, y un timeline de
objetivos del mes. El progreso del módulo se calcula en base a tareas completadas.

---

## Decisiones de diseño

| Pregunta | Decisión |
|---|---|
| Arquitectura | Página única scrolleable con 4 secciones (patrón M1/M2) |
| Schema | Tablas separadas por entidad |
| Puesto y autonomía | Tabla `conocimiento` existente (modulo='rol') |
| Tareas | Tabla `tareas_onboarding` con estado por usuario |
| Herramientas | Tabla `herramientas_rol` con guía en JSONB |
| Objetivos | Tabla `objetivos_rol`, estado fijado por admin, solo lectura para empleado |
| Progreso del módulo | tareas_completadas / total_tareas → `progreso_modulos` (modulo='rol', bloque='general') |

---

## Schema Supabase

```sql
-- Reutiliza tabla conocimiento para contenido estático:
--   modulo='rol', bloque='puesto'    → descripción (texto)
--   modulo='rol', bloque='autonomia' → JSON: [{decision, nivel}]

CREATE TABLE tareas_onboarding (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  semana int NOT NULL CHECK (semana BETWEEN 1 AND 4),
  orden int NOT NULL DEFAULT 0,
  titulo text NOT NULL,
  completada boolean DEFAULT false,
  completada_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE herramientas_rol (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  nombre text NOT NULL,
  url text,
  icono text,          -- nombre de ícono Lucide (ej: 'MessageSquare', 'FileText')
  guia jsonb,          -- [{titulo: string, pasos: string[]}]
  orden int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE objetivos_rol (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  semana int NOT NULL CHECK (semana BETWEEN 1 AND 4),
  titulo text NOT NULL,
  descripcion text,
  estado text DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_progreso', 'completado')),
  created_at timestamptz DEFAULT now()
);
```

---

## Tipos TypeScript (agregar a src/types/index.ts)

```ts
export interface TareaOnboarding {
  id: string
  empresa_id: string
  usuario_id: string
  semana: number
  orden: number
  titulo: string
  completada: boolean
  completada_at?: string
  created_at: string
}

export interface GuiaHerramienta {
  titulo: string
  pasos: string[]
}

export interface HerramientaRol {
  id: string
  empresa_id: string
  nombre: string
  url?: string
  icono?: string
  guia?: GuiaHerramienta[]
  orden: number
  created_at: string
}

export interface ObjetivoRol {
  id: string
  empresa_id: string
  semana: number
  titulo: string
  descripcion?: string
  estado: 'pendiente' | 'en_progreso' | 'completado'
  created_at: string
}

export interface DecisionAutonomia {
  decision: string
  nivel: 'solo' | 'consultar' | 'escalar'
}
```

---

## Flujo de datos

```
1. supabase.auth.getUser()                        → user.id
2. SELECT empresa_id FROM usuarios                → empresa_id
3. Promise.all:
   a. conocimiento WHERE empresa_id AND modulo='rol'     → puesto + autonomia
   b. herramientas_rol WHERE empresa_id ORDER BY orden
   c. tareas_onboarding WHERE empresa_id AND usuario_id ORDER BY semana, orden
   d. objetivos_rol WHERE empresa_id ORDER BY semana
   e. progreso_modulos WHERE usuario_id AND modulo='rol'
```

---

## UI por sección

### Mi puesto
Card con dos partes:
1. Texto de descripción del rol (de `conocimiento` bloque='puesto')
2. Tabla de autonomía (de `conocimiento` bloque='autonomia', parsed como JSON)
   - Columnas: Decisión | Puedo solo (verde) | Debo consultar (amber) | Debo escalar (red)
   - Íconos de semáforo según nivel

### Mis herramientas
Grid `grid-cols-2 sm:grid-cols-3`. Cada card:
- Ícono Lucide (mapeado por `icono` string) + nombre + link externo
- Top 3 tareas de la guía como bullets
- Click → `AnimatePresence` expande mostrando todos los pasos numerados

### Mis primeras tareas
Barra de progreso global del módulo en el header.
Agrupada por semana (Semana 1 → 4). Cada semana:
- `ProgressBar` con `X/Y completadas`
- Lista de `TareaItem`: checkbox animado (spring) + texto con `line-through` al completar
- Al marcar: PATCH `tareas_onboarding` + recalcula progreso + upsert `progreso_modulos`

### Mis objetivos del mes
Timeline vertical con línea conectora. 4 items (uno por semana):
- Circle numerado (01-04) + línea vertical
- Badge estado: `pendiente` → gris, `en_progreso` → amber con pulse, `completado` → teal
- Título + descripción
- Solo lectura

---

## Estructura de componentes (un solo archivo)

```
RolPage
├── SkeletonRol
├── SeccionPuesto (descripción + tabla autonomía)
├── SeccionHerramientas (grid)
│   └── HerramientaCard (con expand/collapse)
├── SeccionTareas (lista por semana)
│   ├── SemanaTareas (progress bar + items)
│   └── TareaItem (checkbox + tachado animado)
└── SeccionObjetivos (timeline)
```

---

## Animaciones

```ts
const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, staggerChildren: 0.1 } }
const sectionVariants   = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, spring(280,24) } }
const itemVariants      = { hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0, spring(300,26) } }
// Checkbox check: spring scale 0 → 1
// Tachado texto: motion.span con textDecoration transition
// Card expand: AnimatePresence + height auto
```

---

## Progreso del módulo

```
completadas = tareas.filter(t => t.completada).length
total = tareas.length
porcentaje = total > 0 ? Math.round(completadas / total * 100) : 0

upsert progreso_modulos {
  usuario_id, modulo: 'rol', bloque: 'general',
  completado: porcentaje === 100,
  completado_at: porcentaje === 100 ? now() : undefined
}
```

Se llama en cada toggle de tarea.
