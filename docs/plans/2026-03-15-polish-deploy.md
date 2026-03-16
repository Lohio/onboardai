# Polish Final y Deploy — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring OnboardAI to production quality with global UX polish: page transitions, unified error/empty states with SVGs, OnboardingProgress header for empleados, consolidated Toaster, mobile touch targets, vercel.json, and updated CLAUDE.md.

**Architecture:** Three layers of changes: (1) root layout gets PageWrapper + global Toaster, (2) new `src/app/empleado/layout.tsx` adds sticky progress header to all employee routes, (3) individual pages get ErrorState component + SVG empty states + removed duplicate Toasters. No new dependencies — everything uses existing Framer Motion, react-hot-toast, Lucide, Supabase.

**Tech Stack:** Next.js 16 App Router, Framer Motion v12, react-hot-toast, Tailwind CSS v4, Lucide React, Supabase browser client.

---

## Reference files (read before coding)

- `src/app/layout.tsx` — root layout to modify
- `src/app/page.tsx` — root page (currently Next.js default, needs redirect)
- `src/app/empleado/perfil/page.tsx` — has 3 `<Toaster />` to remove, needs ErrorState
- `src/app/empleado/cultura/page.tsx` — has 2 `<Toaster />` to remove, needs ErrorState
- `src/app/admin/page.tsx` — needs toast + SVG empty states, no Toaster currently
- `src/app/globals.css` — `.glass-card`, `.gradient-bg`, `.shimmer`, `.animate-spin-fast`
- `src/components/ui/Card.tsx` — reference for glassmorphism pattern

---

## Task 1: Update root layout + root page redirect

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Replace `src/app/page.tsx` entirely**

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/auth/login')
}
```

**Step 2: Replace `src/app/layout.tsx` entirely**

```typescript
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { PageWrapper } from '@/components/shared/PageWrapper'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OnboardAI — Onboarding inteligente',
  description: 'Plataforma de onboarding inteligente para PyMEs latinoamericanas.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <PageWrapper>{children}</PageWrapper>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#141d32',
              color: '#e8eaf0',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              fontSize: '13px',
              padding: '10px 14px',
            },
            success: {
              iconTheme: { primary: '#0D9488', secondary: '#141d32' },
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#141d32' },
            },
          }}
        />
      </body>
    </html>
  )
}
```

Note: `PageWrapper` is created in the next task. TypeScript won't resolve it until then — run tsc after Task 2.

**Step 3: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/app/layout.tsx src/app/page.tsx && git commit -m "feat(layout): global Toaster, metadata, root redirect to /auth/login"
```

---

## Task 2: Create shared components — PageWrapper + ErrorState

**Files:**
- Create: `src/components/shared/PageWrapper.tsx`
- Create: `src/components/shared/ErrorState.tsx`

**Step 1: Create `src/components/shared/PageWrapper.tsx`**

```typescript
'use client'

import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

// Envuelve cada página con un fade-in suave al navegar.
// No usa AnimatePresence+exit porque el App Router no desmonta
// la página anterior antes de montar la nueva.
export function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}
```

**Step 2: Create `src/components/shared/ErrorState.tsx`**

```typescript
'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  mensaje?: string
  onRetry: () => void
  className?: string
}

// Estado de error reutilizable con SVG monocromático indigo/teal.
// Usar en cualquier página donde un try/catch falle al cargar datos.
export function ErrorState({
  mensaje = 'No se pudieron cargar los datos.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center justify-center gap-4 py-16', className)}
    >
      {/* SVG: triángulo de advertencia monocromático */}
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="errGrad" x1="0" y1="0" x2="72" y2="72" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B4FD8" stopOpacity="0.4" />
            <stop offset="1" stopColor="#0D9488" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <path
          d="M36 12L62 58H10L36 12Z"
          stroke="url(#errGrad)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line x1="36" y1="30" x2="36" y2="44" stroke="url(#errGrad)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="36" cy="50.5" r="1.5" fill="url(#errGrad)" />
      </svg>

      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-white/50">Algo salió mal</p>
        <p className="text-xs text-white/30">{mensaje}</p>
      </div>

      <button
        onClick={onRetry}
        className="min-h-[44px] px-6 rounded-lg border border-indigo-500/30 text-sm text-indigo-400
          hover:bg-indigo-600/10 hover:border-indigo-500/50 transition-colors duration-150"
      >
        Reintentar
      </button>
    </motion.div>
  )
}
```

**Step 3: Verify TypeScript**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors (root layout now resolves PageWrapper).

**Step 4: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/components/shared/ && git commit -m "feat(shared): PageWrapper fade transitions + ErrorState with retry"
```

---

## Task 3: Create `/src/app/empleado/layout.tsx` — OnboardingProgress header

**Files:**
- Create: `src/app/empleado/layout.tsx`

This layout wraps all `/empleado/*` routes and adds a sticky progress header (h-12).
It does NOT add a `gradient-bg` — each child page handles its own background.

**Step 1: Create the file**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Bot } from 'lucide-react'
import { createClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// Configuración de módulos
// ─────────────────────────────────────────────

const MODULOS = [
  { key: 'M1', href: '/empleado/perfil' },
  { key: 'M2', href: '/empleado/cultura' },
  { key: 'M3', href: '/empleado/rol' },
  { key: 'M4', href: '/empleado/asistente' },
] as const

// M2: requiere 5 bloques de cultura completados
const CULTURA_TOTAL = 5

type ModuloKey = (typeof MODULOS)[number]['key']
type EstadoModulos = Record<ModuloKey, boolean>

// ─────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────

export default function EmpleadoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [progreso, setProgreso] = useState(0)
  const [modulos, setModulos] = useState<EstadoModulos>({
    M1: false,
    M2: false,
    M3: false,
    M4: false,
  })

  useEffect(() => {
    async function cargarProgreso() {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      // M1: el usuario existe y llegó aquí → siempre completado
      const m1 = true

      // M2 y M3: leer progreso_modulos
      const { data: rows } = await supabase
        .from('progreso_modulos')
        .select('modulo, bloque, completado')
        .eq('usuario_id', user.id)

      const progresoRows = rows ?? []
      const culturaCompletados = progresoRows.filter(
        r => r.modulo === 'cultura' && r.completado
      ).length
      const m2 = culturaCompletados >= CULTURA_TOTAL
      const m3 = progresoRows.some(r => r.modulo === 'rol' && r.completado)

      // M4: tiene al menos una conversación de IA
      let m4 = false
      try {
        const { count } = await supabase
          .from('conversaciones_ia')
          .select('*', { count: 'exact', head: true })
          .eq('usuario_id', user.id)
        m4 = (count ?? 0) > 0
      } catch {
        // tabla puede no existir si M4 no está implementado aún
      }

      const estados: EstadoModulos = { M1: m1, M2: m2, M3: m3, M4: m4 }
      setModulos(estados)
      const completados = Object.values(estados).filter(Boolean).length
      setProgreso(Math.round((completados / 4) * 100))
    }

    cargarProgreso()
  }, [router, pathname]) // re-evalúa al cambiar de ruta

  return (
    <>
      {/* ── Header de progreso (sticky) ── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-surface-900/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 h-12">
          {/* Logo */}
          <Link
            href="/empleado/perfil"
            className="flex items-center gap-2 flex-shrink-0 hover:opacity-75 transition-opacity duration-150"
          >
            <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <span className="text-xs font-semibold text-white/55 hidden sm:block">OnboardAI</span>
          </Link>

          <div className="h-4 w-px bg-white/[0.07] hidden sm:block flex-shrink-0" />

          {/* Indicadores de módulos */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {MODULOS.map((mod, idx) => {
              const completado = modulos[mod.key]
              const esActual = pathname.startsWith(mod.href)

              return (
                <Link
                  key={mod.key}
                  href={mod.href}
                  className={`flex items-center gap-1.5 px-2 min-h-[36px] rounded-md
                    transition-colors duration-150 ${
                      esActual
                        ? 'bg-indigo-600/15'
                        : 'hover:bg-white/[0.04]'
                    }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                      completado
                        ? 'bg-teal-500'
                        : esActual
                        ? 'bg-indigo-400'
                        : 'bg-white/15'
                    }`}
                  />
                  <span
                    className={`text-[11px] font-medium ${
                      esActual
                        ? 'text-indigo-300'
                        : completado
                        ? 'text-teal-400/60'
                        : 'text-white/30'
                    }`}
                  >
                    M{idx + 1}
                  </span>
                </Link>
              )
            })}
          </div>

          <div className="flex-1" />

          {/* Barra de progreso global */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-20 sm:w-28 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-teal-500"
                initial={{ width: '0%' }}
                animate={{ width: `${progreso}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="text-[11px] font-mono text-white/40 tabular-nums w-7 text-right">
              {progreso}%
            </span>
          </div>
        </div>
      </header>

      {/* Contenido de la página */}
      {children}
    </>
  )
}
```

**Step 2: Verify TypeScript**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors.

**Step 3: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/app/empleado/layout.tsx && git commit -m "feat(empleado): sticky OnboardingProgress header with module indicators"
```

---

## Task 4: Polish `src/app/empleado/perfil/page.tsx`

**Files:**
- Modify: `src/app/empleado/perfil/page.tsx`

Changes:
1. Remove all three `<Toaster />` renders (global Toaster in root layout handles this)
2. Add `hasError` + `cargarDatos` ref for retry
3. Show `ErrorState` on failure

**Step 1: Add imports at top of file**

Add these two lines after the existing imports:

```typescript
import { ErrorState } from '@/components/shared/ErrorState'
```

**Step 2: Add `hasError` state**

Inside `PerfilPage`, after the existing `useState` declarations, add:

```typescript
const [hasError, setHasError] = useState(false)
```

**Step 3: Wrap `cargarDatos` in `useCallback` and add error tracking**

Replace the `useEffect` body (keeping the function structure, just wrapping it):

```typescript
const cargarDatos = useCallback(async () => {
  setLoading(true)
  setHasError(false)
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const [perfilRes, relacionesRes, accesosRes] = await Promise.all([
      supabase.from('usuarios').select('*').eq('id', user.id).single(),
      supabase
        .from('equipo_relaciones')
        .select('relacion, miembro_id')
        .eq('usuario_id', user.id),
      supabase
        .from('accesos')
        .select('*')
        .eq('usuario_id', user.id)
        .order('herramienta'),
    ])

    if (perfilRes.data) {
      setPerfil(perfilRes.data as Usuario)
      setSobreMi(perfilRes.data.sobre_mi ?? '')
    }

    if (accesosRes.data) setAccesos(accesosRes.data as Acceso[])

    if (relacionesRes.data && relacionesRes.data.length > 0) {
      const miembroIds = relacionesRes.data.map(r => r.miembro_id)
      const miembrosRes = await supabase
        .from('usuarios')
        .select('id, nombre, email, puesto, foto_url')
        .in('id', miembroIds)

      if (miembrosRes.data) {
        const miembros: MiembroEquipo[] = relacionesRes.data
          .map(rel => {
            const u = miembrosRes.data.find(m => m.id === rel.miembro_id)
            return {
              id: rel.miembro_id,
              nombre: u?.nombre ?? '',
              email: u?.email ?? '',
              puesto: u?.puesto ?? undefined,
              foto_url: u?.foto_url ?? undefined,
              relacion: rel.relacion as MiembroEquipo['relacion'],
            }
          })
          .filter(m => m.nombre)

        const order: Record<MiembroEquipo['relacion'], number> = {
          manager: 0,
          buddy: 1,
          companero: 2,
        }
        miembros.sort((a, b) => order[a.relacion] - order[b.relacion])
        setEquipo(miembros)
      }
    }
  } catch (err) {
    console.error('Error cargando perfil:', err)
    toast.error('Error al cargar el perfil')
    setHasError(true)
  } finally {
    setLoading(false)
  }
}, [])

useEffect(() => {
  cargarDatos()
}, [cargarDatos])
```

Also add `useCallback` to the imports line at top of file:
```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
```

**Step 4: Add ErrorState render between loading check and main render**

After the `if (!perfil)` block and before the main `return`, add:

```typescript
// ── Render: error ──
if (hasError) {
  return (
    <div className="min-h-dvh gradient-bg flex items-center justify-center p-4">
      <ErrorState
        mensaje="No se pudo cargar tu perfil."
        onRetry={cargarDatos}
      />
    </div>
  )
}
```

**Step 5: Remove all three `<Toaster position="top-right" />` from the render functions**

There are 3 instances — in the loading render, the `!perfil` render, and the main render.
Remove each one. The global Toaster in root layout handles all toasts.

**Step 6: Verify TypeScript**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors.

**Step 7: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/app/empleado/perfil/page.tsx && git commit -m "feat(perfil): ErrorState + retry, remove duplicate Toasters"
```

---

## Task 5: Polish `src/app/empleado/cultura/page.tsx`

**Files:**
- Modify: `src/app/empleado/cultura/page.tsx`

**Step 1: Add import**

Add after existing imports:
```typescript
import { ErrorState } from '@/components/shared/ErrorState'
```

**Step 2: Add `hasError` state + convert `cargarDatos` to `useCallback`**

Add state:
```typescript
const [hasError, setHasError] = useState(false)
```

The existing `cargarDatos` is defined inside `useEffect`. Extract it as a `useCallback`:

```typescript
const cargarDatos = useCallback(async () => {
  setLoading(true)
  setHasError(false)
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const [contenidosRes, progresoRes] = await Promise.all([
      supabase
        .from('conocimiento')
        .select('*')
        .eq('modulo', 'cultura'),
      supabase
        .from('progreso_modulos')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('modulo', 'cultura'),
    ])

    if (contenidosRes.data) {
      const mapa: Partial<Record<BloqueKey, ContenidoBloque>> = {}
      for (const c of contenidosRes.data) {
        mapa[c.bloque as BloqueKey] = c as ContenidoBloque
      }
      setContenidos(mapa)
    }

    if (progresoRes.data) {
      const mapa: Partial<Record<BloqueKey, ProgresoModulo>> = {}
      for (const p of progresoRes.data) {
        mapa[p.bloque as BloqueKey] = p as ProgresoModulo
      }
      setProgreso(mapa)
      // Inicializar respuestas para cada bloque
      setRespuestas(
        BLOQUES_ORDEN.reduce(
          (acc, k) => ({ ...acc, [k]: [null, null] }),
          {} as Record<BloqueKey, (number | null)[]>
        )
      )
    }
  } catch (err) {
    console.error('Error cargando cultura:', err)
    toast.error('Error al cargar el módulo')
    setHasError(true)
  } finally {
    setLoading(false)
  }
}, [])

useEffect(() => {
  cargarDatos()
}, [cargarDatos])
```

**Step 3: Add `ErrorState` render after loading check**

After the loading render block, add:

```typescript
// ── Render: error ──
if (hasError) {
  return (
    <div className="min-h-dvh gradient-bg flex items-center justify-center p-4">
      <ErrorState
        mensaje="No se pudo cargar el módulo de cultura."
        onRetry={cargarDatos}
      />
    </div>
  )
}
```

**Step 4: Remove both `<Toaster position="top-right" />` instances**

Remove from loading render and main render. Global Toaster handles it.

**Step 5: Verify TypeScript**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors.

**Step 6: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/app/empleado/cultura/page.tsx && git commit -m "feat(cultura): ErrorState + retry, remove duplicate Toasters"
```

---

## Task 6: Polish `src/app/admin/page.tsx` — SVG empty states + toasts

**Files:**
- Modify: `src/app/admin/page.tsx`

**Step 1: Add `toast` import**

Add to the imports at top of file:

```typescript
import toast from 'react-hot-toast'
```

**Step 2: Replace the "no employees" empty state with SVG version**

Find the empty state in `EmpleadoCard` / employees grid section:

```tsx
// BEFORE (in the employees grid conditional):
<motion.div
  variants={cardVariants}
  className="glass-card rounded-xl p-8 flex flex-col items-center justify-center gap-3 min-h-[200px]"
>
  <Users className="w-8 h-8 text-white/15" />
  <p className="text-sm text-white/35 text-center">
    No hay empleados registrados aún.
  </p>
</motion.div>
```

Replace with:

```tsx
<motion.div
  variants={cardVariants}
  className="glass-card rounded-xl p-8 flex flex-col items-center justify-center gap-4 min-h-[200px] xl:col-span-2"
>
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="empGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3B4FD8" stopOpacity="0.3" />
        <stop offset="1" stopColor="#0D9488" stopOpacity="0.15" />
      </linearGradient>
    </defs>
    <circle cx="26" cy="20" r="10" stroke="url(#empGrad)" strokeWidth="1.5" />
    <path d="M8 56c0-9.94 8.06-18 18-18" stroke="url(#empGrad)" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M30 48c0-4.42 3.58-8 8-8s8 3.58 8 8" stroke="url(#empGrad)" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="38" cy="34" r="7" stroke="url(#empGrad)" strokeWidth="1.5" />
    <path d="M38 31v3.5l2 2" stroke="url(#empGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
  <div className="text-center space-y-1">
    <p className="text-sm text-white/40">Sin empleados registrados</p>
    <p className="text-xs text-white/25">Los empleados aparecerán aquí cuando se agreguen a la plataforma</p>
  </div>
</motion.div>
```

**Step 3: Replace the "no alerts" empty state with SVG version**

Find the empty state in the alerts panel:

```tsx
// BEFORE:
<div className="py-6 flex flex-col items-center gap-2">
  <AlertTriangle className="w-6 h-6 text-white/10" />
  <p className="text-xs text-white/30 text-center">Sin alertas pendientes</p>
</div>
```

Replace with:

```tsx
<div className="py-6 flex flex-col items-center gap-3">
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="bellGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3B4FD8" stopOpacity="0.25" />
        <stop offset="1" stopColor="#0D9488" stopOpacity="0.15" />
      </linearGradient>
    </defs>
    <path
      d="M24 6c-8.28 0-15 6.72-15 15v9l-3 4.5h36L39 30V21c0-8.28-6.72-15-15-15z"
      stroke="url(#bellGrad)"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M20 38c0 2.21 1.79 4 4 4s4-1.79 4-4" stroke="url(#bellGrad)" strokeWidth="1.5" />
    <path d="M18 22l4 4 8-8" stroke="url(#bellGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
  <p className="text-xs text-white/30 text-center">Sin alertas pendientes</p>
</div>
```

**Step 4: Add toast feedback to `resolverAlerta`**

Replace the entire `resolverAlerta` function:

```typescript
const resolverAlerta = async (id: string) => {
  // Actualización optimista
  setAlertas(prev => prev.filter(a => a.id !== id))

  const supabase = createClient()
  const { error } = await supabase
    .from('alertas_conocimiento')
    .update({ resuelta: true })
    .eq('id', id)

  if (error) {
    toast.error('No se pudo marcar la alerta')
    // Revertir: recargar datos
    if (empresaId) cargarDatos(empresaId)
  } else {
    toast.success('Alerta marcada como resuelta')
  }
}
```

**Step 5: Verify TypeScript**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors.

**Step 6: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/app/admin/page.tsx && git commit -m "feat(admin): SVG empty states + toast feedback on resolverAlerta"
```

---

## Task 7: Mobile touch targets audit

**Files:**
- Modify: `src/app/admin/page.tsx` (button "Resolver")
- Modify: `src/app/admin/layout.tsx` (no changes needed — already has good touch targets)
- Modify: `src/app/empleado/perfil/page.tsx` (copy/contactCard buttons)

**Step 1: Fix "Resolver" button touch target in admin/page.tsx**

Find the Resolver button:

```tsx
// BEFORE:
<button
  onClick={() => resolverAlerta(alerta.id)}
  className="text-[10px] font-medium text-indigo-400/70 hover:text-indigo-300
    border border-indigo-500/20 hover:border-indigo-500/40
    px-2 py-1 rounded-md transition-colors duration-150 flex-shrink-0"
>
  Resolver
</button>
```

Replace with (add `min-h-[36px]` for acceptable mobile touch — full 44px not needed for secondary actions in desktop-primary admin UI):

```tsx
<button
  onClick={() => resolverAlerta(alerta.id)}
  className="text-[10px] font-medium text-indigo-400/70 hover:text-indigo-300
    border border-indigo-500/20 hover:border-indigo-500/40
    px-3 py-2 min-h-[36px] rounded-md transition-colors duration-150 flex-shrink-0"
>
  Resolver
</button>
```

**Step 2: Ensure login button has proper touch target**

In `src/app/auth/login/page.tsx`, find the submit button and verify it has `min-h-[44px]`. If not:

Search for the `<Button` component in the form. The Button component is at `src/components/ui/Button.tsx`. Check if it already applies adequate height.

```bash
grep -n "min-h\|h-\[44\|h-12\|h-11" /c/Users/Maxi/onboardai/src/components/ui/Button.tsx
```

If the Button component doesn't have `min-h-[44px]`, add it to the base styles.

**Step 3: Verify TypeScript**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors.

**Step 4: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/app/admin/page.tsx src/components/ui/Button.tsx && git commit -m "fix(mobile): improve touch targets on action buttons"
```

---

## Task 8: Create `vercel.json` + update `CLAUDE.md`

**Files:**
- Create: `vercel.json` (at root of project)
- Modify: `CLAUDE.md` (at root of project)

**Step 1: Create `vercel.json`**

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next"
}
```

Note: Las variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`) se configuran en el dashboard de Vercel bajo Project Settings → Environment Variables. No se incluyen en vercel.json porque irían al repositorio.

**Step 2: Append architecture section to `CLAUDE.md`**

Append at the end of the existing `CLAUDE.md`:

```markdown

---

## Arquitectura implementada (decisiones de desarrollo)

### Layout hierarchy
```
src/app/layout.tsx          → Root: metadata, Toaster global, PageWrapper (fade transitions)
src/app/empleado/layout.tsx → Empleado: sticky OnboardingProgress header (M1-M4)
src/app/admin/layout.tsx    → Admin: sidebar fijo (desktop) + drawer (mobile) + header con alertas
```

### Flujo de autenticación
1. `src/middleware.ts` protege `/admin/*` y `/empleado/*` — redirige a `/auth/login` si no hay sesión
2. Cada Client Component hace `supabase.auth.getUser()` para obtener el userId
3. El admin layout verifica `rol === 'admin'` — redirige si no
4. `src/app/page.tsx` hace redirect directo a `/auth/login`

### Patrones Supabase
- `createClient()` — cliente browser para Client Components (usa `@supabase/ssr`)
- `createServerSupabaseClient()` — solo para API routes (importa `cookies` de `next/headers`)
- Realtime: `supabase.channel('name').on('postgres_changes', filter, cb).subscribe()`
  Siempre cleanup en `return () => supabase.removeChannel(channel)`

### AI Streaming (reporte admin)
- Endpoint: `POST /api/admin/reporte/[id]` (API Route Handler)
- Usa `anthropic.messages.stream()` del SDK `@anthropic-ai/sdk`
- Retorna `ReadableStream` con `Content-Type: text/plain`
- Cliente lee chunks con `response.body.getReader()` y acumula en `setReporte(prev => prev + chunk)`

### Componentes compartidos (src/components/shared/)
- `PageWrapper` — fade transition 220ms por ruta (key=pathname en motion.div)
- `ErrorState` — SVG triángulo + mensaje + botón "Reintentar" con callback

### Empty states
SVG inline monocromático indigo/teal (opacity 0.15-0.35). No archivos externos.
Usar `ErrorState` para errores de red/datos. Usar SVG inline para "sin datos" semánticos.

### Toaster
Un solo `<Toaster />` global en `src/app/layout.tsx`.
No agregar `<Toaster />` en páginas individuales.
Usar `toast.success()` / `toast.error()` directamente en cualquier componente.

### Rutas implementadas
```
/                     → redirect a /auth/login
/auth/login           → formulario de login
/empleado/perfil      → M1: datos del empleado
/empleado/cultura     → M2: cultura e identidad con quiz
/admin                → M5: dashboard con métricas y tiempo real
/admin/conocimiento   → gestión de contenido (plan creado, pendiente implementar)
/admin/empleado/[id]  → detalle de empleado + reporte IA (plan creado, pendiente)
```

### Convención para progreso_modulos
```
modulo='cultura', bloque='historia'|'mision'|'como_trabajamos'|'expectativas'|'hitos'
modulo='rol',     bloque='general'
```
El denominador para % de cultura es COUNT(*) FROM conocimiento WHERE empresa_id AND modulo='cultura'.
```

**Step 3: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add vercel.json CLAUDE.md && git commit -m "chore: add vercel.json and update CLAUDE.md with architecture decisions"
```

---

## Task 9: Final build verification

**Step 1: TypeScript check**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors.

**Step 2: Production build**

```bash
cd C:/Users/Maxi/onboardai && npm run build
```

Expected: clean build. Routes should include:
```
○ /
○ /_not-found
○ /admin
○ /auth/login
○ /empleado/cultura
○ /empleado/perfil
```

**Step 3: Commit if any fixes needed**

If build reveals issues, fix them and commit with:
```bash
git add -p && git commit -m "fix: resolve build issues from polish pass"
```

---

## Verification checklist

1. `npm run build` → sin errores
2. Navegá a `/` → redirige a `/auth/login`
3. Login → llegás a `/empleado/perfil` o `/admin` según rol
4. Navegar entre páginas de empleado → fade suave de 220ms
5. Header sticky visible en `/empleado/perfil` y `/empleado/cultura`
6. Barra de progreso en header se anima (0→75% si M1+M2+M3 completo)
7. Simular error de red en perfil → ErrorState con SVG + botón "Reintentar"
8. Admin "Resolver" alerta → toast.success aparece
9. En mobile (375px DevTools): botones son tappables (≥36px), contenido no se corta
10. Toaster aparece solo una vez (no duplicado)
