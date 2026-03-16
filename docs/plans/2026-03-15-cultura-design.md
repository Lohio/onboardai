# Diseño: Módulo 2 — Cultura e Identidad

**Fecha:** 2026-03-15
**Ruta:** `/src/app/empleado/cultura/page.tsx`

---

## Contexto

Módulo 2 de OnboardAI. Permite al empleado aprender sobre la cultura de su empresa
a través de 5 bloques que se desbloquean en orden (modelo Duolingo). Cada bloque
tiene contenido cargado desde Supabase, progreso de lectura basado en scroll,
y un mini-quiz de comprensión que debe aprobarse para desbloquear el siguiente.

---

## Decisiones de diseño

| Pregunta | Decisión |
|---|---|
| Arquitectura | Página única con reveal progresivo (todos los bloques visibles) |
| Persistencia de progreso | Tabla `progreso_modulos` en Supabase |
| Contenido | Tabla `conocimiento` (una fila por bloque) |
| Preguntas | Hardcodeadas en el frontend (genéricas por tema) |
| Celebración | canvas-confetti (burst indigo/teal, 2s) |
| Quiz threshold | Aparece al 80% de scroll por el contenido |
| Reintentos | Sin límite |

---

## Schema Supabase

```sql
-- Contenido del módulo (una fila por bloque por empresa)
CREATE TABLE conocimiento (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  modulo text NOT NULL,   -- 'cultura'
  bloque text NOT NULL,   -- 'historia' | 'mision' | 'como_trabajamos' | 'expectativas' | 'hitos'
  titulo text NOT NULL,
  contenido text NOT NULL, -- texto libre (puede ser markdown)
  created_at timestamptz DEFAULT now()
);

-- Progreso del usuario por bloque
CREATE TABLE progreso_modulos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  bloque text NOT NULL,
  completado boolean DEFAULT false,
  completado_at timestamptz,
  UNIQUE(usuario_id, modulo, bloque)
);
```

---

## Tipos TypeScript (agregar a src/types/index.ts)

```ts
export interface ContenidoBloque {
  id: string
  empresa_id: string
  modulo: string
  bloque: string
  titulo: string
  contenido: string
  created_at: string
}

export interface ProgresoModulo {
  id: string
  usuario_id: string
  modulo: string
  bloque: string
  completado: boolean
  completado_at?: string
}
```

---

## Flujo de datos

```
1. supabase.auth.getUser()                                     → user.id
2. SELECT empresa_id FROM usuarios WHERE id = user.id          → empresa_id
3. Promise.all:
   a. SELECT * FROM conocimiento
      WHERE empresa_id = ? AND modulo = 'cultura'              → 5 filas de contenido
   b. SELECT * FROM progreso_modulos
      WHERE usuario_id = ? AND modulo = 'cultura'              → estado de completado
```

**`unlocked` es derivado:** el bloque N está desbloqueado si es el primero o el bloque N-1 está `completado`.

---

## Estados por bloque

```
BLOQUEADO    → Overlay oscuro + ícono Lock + "Completá el anterior para desbloquear"
DESBLOQUEADO → Contenido visible + barra de lectura 0→100% + quiz al 80%
COMPLETADO   → Header con check verde + contenido colapsado/resumido
```

---

## Progreso de lectura

Un `scroll` listener en `window` calcula por cada bloque desbloqueado:

```
progress = clamp(
  (viewportHeight - blockTop) / blockHeight × 100,
  0, 100
)
```

Donde `blockTop` y `blockHeight` vienen de `getBoundingClientRect()` del ref del contenido del bloque.

---

## Animaciones (Framer Motion)

```ts
const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, staggerChildren: 0.12 } }
const blockVariants    = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, spring(280,24) } }
const unlockVariants   = { hidden: { opacity: 0, y: -10 }, show: { opacity: 1, y: 0, spring(300,26) } }
// Overlay lock: exit → opacity 0, scale 0.95 (AnimatePresence)
// Quiz reveal: AnimatePresence + fade+slideUp
```

---

## Preguntas hardcodeadas (genéricas por tema)

Cada bloque tiene 2-3 preguntas con una única respuesta correcta (`correcta: number` = índice).
Las preguntas son educativas y funcionan para cualquier empresa.

### Bloques y preguntas

**historia:** ¿Qué suelen reflejar los orígenes de una empresa? / ¿Por qué es valioso conocer la historia de tu empresa?

**mision:** ¿Cuál es la diferencia entre misión y visión? / ¿Para qué sirven los valores empresariales?

**como_trabajamos:** ¿Qué define la cultura de trabajo de un equipo? / ¿Cuál es el beneficio de acuerdos de trabajo claros?

**expectativas:** ¿Por qué es útil conocer las expectativas de tu rol desde el día 1? / ¿Qué facilita tener objetivos claros?

**hitos:** ¿Qué representan los hitos en la historia de una empresa? / ¿Por qué celebrar logros colectivos?

---

## Flujo de completado

```
1. Usuario responde correctamente todas las preguntas de un bloque
2. INSERT INTO progreso_modulos (usuario_id, modulo, bloque, completado=true, completado_at=now())
   ON CONFLICT → UPDATE completado=true
3. canvas-confetti burst (colores: indigo #3B4FD8, teal #0D9488, blanco)
4. Estado local: marcar bloque como completado
5. Siguiente bloque: AnimatePresence → overlay desaparece, contenido revela
```

---

## Estructura de componentes (un solo archivo)

```
CulturaPage
├── SkeletonCultura
├── BarraProgreso global (ProgressBar existente, X/5 completados)
└── BloqueCard × 5
    ├── BloqueHeader (ícono + título + badge + barra lectura)
    ├── BloqueContenido (texto + ref scroll)   ← solo si unlocked
    ├── BloqueQuiz                             ← solo si readProgress ≥ 80%
    └── Overlay bloqueado (AnimatePresence)    ← solo si locked
```

---

## Dependencia externa

```bash
npm install canvas-confetti @types/canvas-confetti
```
