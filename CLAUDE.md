# OnboardAI — Guía para Claude Code

## Qué es este proyecto
OnboardAI es una plataforma SaaS de onboarding inteligente para PyMEs
latinoamericanas. Permite que empresas carguen su conocimiento institucional
y nuevos empleados lo accedan a través de un agente IA conversacional.

## Stack tecnológico
- Next.js 14 con App Router y TypeScript
- Tailwind CSS + Framer Motion para animaciones
- Supabase para base de datos y autenticación
- Claude API (claude-sonnet-4-20250514) para el agente IA
- Lucide React para íconos
- Recharts para gráficos
- Vercel para deploy

## Arquitectura de usuarios
Hay DOS interfaces completamente distintas según el rol:
- EMPLEADO (/empleado/*) — ve su proceso de onboarding
- ADMIN (/admin/*) — gestiona y monitorea los onboardings
El login es único en /auth/login. El sistema redirige según rol.

## Los 5 módulos del producto
M1 - Perfil e info base: datos del empleado, equipo, accesos, contactos
M2 - Cultura e identidad: historia, misión, valores, reglas de trabajo
M3 - Rol y herramientas: puesto, guías, tareas con checkbox, objetivos
M4 - Asistente IA: chat con Claude entrenado en conocimiento de la empresa
M5 - Dashboard admin: progreso en tiempo real, alertas, reportes 30/60/90

## Principios de diseño — MUY IMPORTANTE
- Estética: dark mode elegante como Linear o Vercel Dashboard
- Colores: Navy #0F1F3D principal, Indigo #3B4FD8 acento, Teal #0D9488 secundario
- Fuente: Geist para headings, Geist Mono para datos/código
- Animaciones: Framer Motion en TODAS las transiciones de página y componentes
- Mobile first: diseño arranca desde 375px
- Cada pantalla tiene UN solo objetivo claro
- Glassmorphism sutil en cards: backdrop-blur con border opacity
- Gradientes suaves en backgrounds, nunca fondos planos
- Micro-interacciones en todos los botones y elementos interactivos
- Loading states en TODA llamada asíncrona
- Empty states diseñados, nunca pantallas vacías sin contexto

## Convenciones de código
- Componentes: PascalCase, un componente por archivo
- Hooks: camelCase, empiezan con "use"
- Utilities: camelCase en /lib/
- Siempre TypeScript estricto, nunca "any"
- Comentarios en español
- Server Components por defecto, Client Components solo cuando necesario
- Siempre manejar estados de error y loading

## Estructura de carpetas
/src
  /app
    /auth — login y autenticación
    /empleado — app del empleado
    /admin — app del manager
    /api — endpoints de la API
  /components
    /ui — componentes base reutilizables
    /empleado — componentes específicos del empleado
    /admin — componentes específicos del admin
    /shared — componentes compartidos entre ambas apps
  /lib
    supabase.ts — cliente de Supabase
    claude.ts — cliente de Claude API
    utils.ts — utilidades generales
  /types
    index.ts — todos los tipos TypeScript del proyecto

## Variables de entorno necesarias
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=          # Opcional: envío de emails (resend.com). Sin esta key los emails se loguean en consola.

## Arquitectura implementada (estado actual)

### Rutas y páginas
- `/auth/login` — Login único, redirige por rol
- `/empleado/perfil` — M1: datos personales, equipo, accesos
- `/empleado/cultura` — M2: bloques de cultura con quizzes y progreso
- `/empleado/rol` — M3: tareas con checkbox, objetivos
- `/empleado/asistente` — M4: chat con IA (Claude)
- `/admin` — Dashboard con métricas, grid empleados, alertas, chart
- `/admin/empleado/[id]` — Detalle de empleado: timeline, preguntas IA, reporte streaming
- `/admin/conocimiento` — Gestión de contenido por módulo y bloque

### Componentes compartidos
- `src/components/shared/PageWrapper.tsx` — Transiciones de página (motion.div key={pathname})
- `src/components/shared/ErrorState.tsx` — Estado de error reutilizable con retry

### Layout por sección
- `src/app/empleado/layout.tsx` — Header sticky con progreso por módulos (M1–M4)
- `src/app/admin/layout.tsx` — Shell con sidebar (desktop) + drawer (mobile), alertas realtime

### API routes
- `POST /api/admin/reporte/[id]` — Streaming report via Claude API (ReadableStream)

### Patrones clave
- Toaster ÚNICO en `src/app/layout.tsx` (no duplicar en páginas)
- `useCallback` + `ErrorState` para todas las cargas de datos con retry
- Supabase Realtime en admin dashboard y layout (alertas count)
- Optimistic updates con rollback en todas las mutaciones
- Semáforo: >70% teal, 30-70% amber, <30% rojo
