# OnboardAI — Guía para Claude Code

## Qué es este proyecto
OnboardAI es una plataforma SaaS de onboarding inteligente para PyMEs latinoamericanas.
Permite que empresas carguen su conocimiento institucional y nuevos empleados lo accedan
a través de un agente IA conversacional.

## Stack tecnológico
- Next.js 14 con App Router y TypeScript estricto
- Tailwind CSS + Framer Motion para animaciones
- Supabase para base de datos y autenticación
- Claude API (claude-sonnet-4-20250514) para el agente IA
- Lucide React para íconos
- Recharts para gráficos
- Vercel para deploy

## Arquitectura de usuarios
Hay TRES roles en el sistema (`src/types/index.ts`):
- `empleado` → `/empleado/*` — ve su proceso de onboarding
- `admin` → `/admin/*` — gestiona y monitorea los onboardings
- `dev` → `/dev/*` — panel interno de gestión de empresas/usuarios

El login es único en `/auth/login`. El sistema redirige según el rol del usuario.

## Los 5 módulos del producto (vista empleado)
- M1 - Perfil e info base: datos personales, equipo, accesos, contactos
- M2 - Cultura e identidad: historia, misión, valores, reglas, quizzes con progreso
- M3 - Rol y herramientas: herramientas del puesto, tareas con checkbox, objetivos por semana
- M4 - Asistente IA: chat con Claude entrenado en el conocimiento de la empresa
- M5 - Dashboard de progreso: home del empleado con módulos, tareas y encuestas de pulso

## Principios de diseño — MUY IMPORTANTE
- Estética: dark mode elegante, referencia Linear / Vercel Dashboard
- Colores: Navy `#0F1F3D` principal, Indigo `#3B4FD8` acento, Teal `#0D9488` secundario
- Fuente: Geist para headings, Geist Mono para datos/código
- Animaciones: Framer Motion en TODAS las transiciones de página y componentes
- Mobile first: diseño arranca desde 375px
- Cada pantalla tiene UN solo objetivo claro
- Glassmorphism sutil en cards: `backdrop-blur` con `border` a baja opacidad — clase reutilizable `glass-card`
- Gradientes suaves en backgrounds, nunca fondos planos
- Micro-interacciones en todos los botones y elementos interactivos
- Loading states en TODA llamada asíncrona
- Empty states diseñados, nunca pantallas vacías sin contexto
- Semáforo de progreso: ≥70% teal, 30–69% amber, <30% rojo

## Convenciones de código
- Componentes: PascalCase, un componente por archivo
- Hooks: camelCase, empiezan con `use`
- Utilities: camelCase en `/lib/`
- TypeScript estricto en todo el proyecto, nunca `any`
- Comentarios en español
- Server Components por defecto, Client Components (`'use client'`) solo cuando necesario
- Siempre manejar estados de error y loading
- **CRÍTICO**: `createClient()` de Supabase debe llamarse DENTRO de los callbacks (`useCallback`, handlers), nunca a nivel de componente — hacerlo a nivel de componente crea un objeto nuevo en cada render, lo que rompe las dependencias de `useCallback` y causa bucles infinitos

## Variables de entorno necesarias
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=   # Opcional: emails con resend.com. Sin esta key se loguean en consola.
```

---

## Arquitectura implementada — Estado definitivo

### Rutas y páginas

#### Autenticación
| Ruta | Descripción |
|------|-------------|
| `/auth/login` | Login único, redirige por rol tras autenticación |

#### App del empleado (`/empleado/*`)
| Ruta | Descripción |
|------|-------------|
| `/empleado` | Home: módulos con progreso, tareas pendientes, encuesta de pulso modal |
| `/empleado/perfil` | M1: datos personales, equipo (manager/buddy/compañeros), accesos, contactos IT/RRHH |
| `/empleado/cultura` | M2: bloques de contenido por módulo, quizzes, barra de progreso por sección |
| `/empleado/rol` | M3: herramientas del rol con guías paso a paso, tareas con checkbox, objetivos por semana |
| `/empleado/asistente` | M4: chat conversacional con Claude, historial en sesión |

#### App del admin (`/admin/*`)
| Ruta | Descripción |
|------|-------------|
| `/admin` | Dashboard: métricas globales, grid de empleados con progreso, alertas, chart de actividad |
| `/admin/empleados` | Lista completa de empleados de la empresa |
| `/admin/empleados/[id]` | Detalle unificado con dos tabs: **Edición** (formulario + módulos + alertas) y **Progreso y reporte** (timeline, tareas, preguntas IA, reporte streaming) |
| `/admin/contenido` | Selector de módulo para gestionar bloques de contenido |
| `/admin/contenido/[modulo]` | Edición de bloques de contenido por módulo (CRUD con modal) |
| `/admin/conocimiento` | Gestión del conocimiento institucional de la empresa |
| `/admin/reportes` | Vista Kanban de empleados por franja (30/60/90 días) + link a encuestas |
| `/admin/reportes/encuestas` | Resultados de encuestas de pulso: resumen por día (7/30/60), promedios, participación |
| `/admin/equipo` | Gestión del equipo (managers, buddies) |
| `/admin/configuracion` | Configuración de la empresa |

#### Panel dev (`/dev/*`)
| Ruta | Descripción |
|------|-------------|
| `/dev` | Panel interno de superadmin |
| `/dev/empresas` | Gestión de empresas en la plataforma |
| `/dev/usuarios` | Gestión de usuarios globales |
| `/dev/config` | Configuración interna del sistema |

### API routes

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/admin/reporte/[id]` | POST | Reporte streaming del empleado via Claude API (ReadableStream) |
| `/api/admin/empleados` | GET/POST | Listado y creación de empleados |
| `/api/admin/empleados/[id]` | GET/PUT/DELETE | Detalle, edición y eliminación de empleado |
| `/api/admin/preboarding` | POST | Gestión del estado de preboarding |
| `/api/empleado/chat` | POST | Chat con el asistente IA (streaming) |
| `/api/empleado/encuesta-check` | POST | Verifica y crea encuestas de pulso pendientes, retorna la más antigua sin responder |
| `/api/empleado/encuesta-responder` | POST | Guarda las respuestas de una encuesta de pulso |

### Componentes

#### Shared
| Componente | Descripción |
|-----------|-------------|
| `src/components/shared/PageWrapper.tsx` | Transición de página con Framer Motion (`key={pathname}`) |
| `src/components/shared/ErrorState.tsx` | Estado de error reutilizable con botón de retry |

#### UI base
| Componente | Descripción |
|-----------|-------------|
| `src/components/ui/Button.tsx` | Botón con variantes y estados |
| `src/components/ui/Card.tsx` | Card base con glassmorphism |
| `src/components/ui/Badge.tsx` | Badge/etiqueta con colores semánticos |
| `src/components/ui/ProgressBar.tsx` | Barra de progreso animada |

#### Admin
| Componente | Descripción |
|-----------|-------------|
| `src/components/admin/EmpleadoModal.tsx` | Modal para crear/editar empleado |
| `src/components/admin/ResetProgresoModal.tsx` | Modal de confirmación para resetear progreso |
| `src/components/admin/BloqueContenidoForm.tsx` | Formulario de edición de bloque de contenido |
| `src/components/admin/EliminarBloqueModal.tsx` | Modal de confirmación para eliminar bloque |

#### Empleado
| Componente | Descripción |
|-----------|-------------|
| `src/components/empleado/ContactoCard.tsx` | Tarjeta de contacto (IT/RRHH) |
| `src/components/empleado/EncuestaPulsoModal.tsx` | Modal de encuesta de pulso con star ratings (1–5), 3 preguntas + comentario opcional |

### Layouts
- `src/app/empleado/layout.tsx` — Header sticky con progreso visual por módulos (M1–M4)
- `src/app/admin/layout.tsx` — Shell con sidebar (desktop) + drawer (mobile), contador de alertas en tiempo real via Supabase Realtime
- `src/app/dev/layout.tsx` — Layout del panel de superadmin

---

## Sistema de encuestas de pulso

Las encuestas se crean automáticamente en los días 7, 30 y 60 del onboarding:
- Se crean de forma **lazy** al cargar el home del empleado (llamada a `/api/empleado/encuesta-check`)
- Solo se crea la encuesta de un día si ese día ya fue alcanzado y no existe encuesta previa
- Si hay encuestas pendientes, se muestra el modal `EncuestaPulsoModal` automáticamente
- El modal muestra la encuesta más antigua sin responder
- Los resultados se consolidan en `/admin/reportes/encuestas`

Tabla en Supabase: `encuestas_pulso` (ver `src/types/index.ts` → `EncuestaPulso`)

---

## Patrones clave

### Carga de datos
```tsx
// CORRECTO: createClient() dentro del callback
const cargarDatos = useCallback(async () => {
  const supabase = createClient()
  // ...queries
}, []) // dependencias vacías — supabase no va en el array

// INCORRECTO: createClient() a nivel de componente
const supabase = createClient() // ← crea objeto nuevo en cada render
const cargarDatos = useCallback(async () => { ... }, [supabase]) // ← loop infinito
```

### Queries no bloqueantes
Para tablas opcionales o secundarias, no lanzar error si fallan — usar `console.warn` y mostrar estado vacío:
```tsx
const { data, error } = await supabase.from('tabla_opcional').select('*')
if (error) {
  console.warn('[Módulo] tabla_opcional:', error.message)
  // continuar con data = []
}
```

### Errores de Supabase
`PostgrestError` NO es instancia de `Error`. Para relanzar errores críticos:
```tsx
throw new Error(postgrestError.message ?? 'Error desconocido')
// NO: throw postgrestError  ← instanceof Error falla, mensaje genérico
```

### Otros patrones
- Toaster ÚNICO en `src/app/layout.tsx` — no duplicar en páginas individuales
- `useCallback` + `ErrorState` para todas las cargas con retry visible al usuario
- Supabase Realtime para alertas en el layout del admin
- Optimistic updates con rollback en mutaciones (ej: toggle checkbox de tareas)
- `AnimatePresence` con `mode="wait"` para transiciones entre tabs/vistas

---

## Tipos principales (`src/types/index.ts`)
- `UserRole` — `'empleado' | 'admin' | 'dev'`
- `Usuario` — perfil completo del usuario
- `MiembroEquipo` — manager, buddy o compañero
- `Acceso` — herramienta con estado (activo/pendiente/sin_acceso)
- `ContenidoBloque` — bloque de contenido por módulo
- `ProgresoModulo` — progreso del empleado por bloque
- `TareaOnboarding` — tarea semanal con checkbox
- `HerramientaRol` — herramienta del rol con guías paso a paso
- `ObjetivoRol` — objetivo por semana con estado
- `EncuestaPulso` — encuesta de pulso (días 7/30/60)
- `AdminEmpleadoConProgreso` — empleado con progreso calculado para el admin
