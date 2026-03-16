# Diseño: Polish Final y Deploy

**Fecha:** 2026-03-15
**Alcance:** Estado de producción del proyecto OnboardAI

---

## Decisiones aprobadas

| Item | Decisión |
|---|---|
| OnboardingProgress | Top bar h-12 en layout /empleado, sticky |
| Transiciones de página | Fade suave 220ms, via PageWrapper en root layout |
| Empty state SVGs | Inline monocromático indigo/teal, opacity 15-25% |
| Toaster | Global en root layout, eliminar duplicados |
| Mobile modal conocimiento | Colapsar split a columna única |

---

## Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `src/app/page.tsx` | Modificar — redirect a /auth/login |
| `src/app/layout.tsx` | Modificar — metadata + Toaster global + PageWrapper |
| `src/app/empleado/layout.tsx` | Crear — header OnboardingProgress |
| `src/components/shared/ErrorState.tsx` | Crear — error state con retry |
| `src/app/empleado/perfil/page.tsx` | Modificar — ErrorState + remove Toaster |
| `src/app/empleado/cultura/page.tsx` | Modificar — ErrorState + remove Toaster |
| `src/app/admin/page.tsx` | Modificar — empty states SVG + toasts |
| `src/app/admin/layout.tsx` | Modificar — Toaster (ya tiene lógica sin él) |
| `vercel.json` | Crear |
| `CLAUDE.md` (onboardai/) | Crear/actualizar |

---

## OnboardingProgress

### Layout `/empleado`

```
┌─────────────────────────────────────────────────────────┐
│ 🤖 OnboardAI    ●M1 ●M2 ○M3 ○M4    [========65%] │ h-12
├─────────────────────────────────────────────────────────┤
│ [contenido de la página — children]                     │
└─────────────────────────────────────────────────────────┘
```

- Sticky `top-0 z-30 backdrop-blur`
- 4 módulos con dot (●=completado, ○=pendiente): M1 Perfil, M2 Cultura, M3 Rol, M4 Asistente
- Barra de progreso delgada (h-0.5) al fondo del header
- Progreso = suma de bloques completados en progreso_modulos / total esperado

### Cálculo de módulos completados (client-side)

```ts
// M1 Perfil: siempre true (existe el usuario)
// M2 Cultura: todos los bloques cultura completados
// M3 Rol: progreso modulo='rol' bloque='general' completado
// M4 Asistente: tiene al menos una conversacion_ia
```

---

## Empty States SVG

Cada empty state usa un SVG de 72-80px con:
- `stroke="url(#grad)"` o color fijo `rgba(99,102,241,0.2)`
- stroke-width: 1.5
- fill: none
- Texto debajo: `text-sm text-white/30`

Ejemplos de shapes:
- Sin empleados: silueta de persona + círculo vacío
- Sin alertas: campana con check
- Sin actividad: línea de tiempo vacía con punto
- Sin preguntas IA: burbuja de chat con "?"

---

## Error State

```
[SVG: triángulo con !) con indigo/teal stroke]
Algo salió mal
[mensaje específico]
[Botón "Reintentar" → onRetry()]
```

Props: `mensaje?: string, onRetry: () => void`

---

## Transiciones de página

```tsx
// src/components/shared/PageWrapper.tsx
'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

---

## vercel.json

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key",
    "ANTHROPIC_API_KEY": "@anthropic_api_key"
  }
}
```

---

## Mobile polish

- Botones con `min-h-[44px]` en todas las pantallas
- Padding `p-4` en mobile, `sm:p-6` en tablet+
- Modal conocimiento: grid-cols-1 en mobile (textarea y preview apilados)
- Admin metric cards: ya son grid-cols-2 en mobile ✓
