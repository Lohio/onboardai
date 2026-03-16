# Admin: Detalle de Empleado + Gestión de Conocimiento — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `/admin/empleado/[id]` (employee detail with streaming AI report) and `/admin/conocimiento` (content manager with alert responses and markdown editor).

**Architecture:** Three new files + one new API route + small patch to the admin dashboard. All Client Components except the streaming API route (server-side). No new dependencies beyond `@anthropic-ai/sdk` (already in plan, not yet installed). Modal state managed inline per page. Markdown preview uses a 20-line inline parser — no external library.

**Tech Stack:** Next.js 16 App Router, `@anthropic-ai/sdk` (streaming), Supabase browser client, Framer Motion v12, Tailwind CSS v4, Lucide React, `@radix-ui/react-dialog` (already in deps).

---

## Reference files (read before coding)

- `src/lib/supabase.ts` — `createClient()` (browser), `createServerSupabaseClient()` (server/API)
- `src/app/admin/page.tsx` — patterns for state, data loading, animation variants, glass-card
- `src/app/admin/layout.tsx` — auth pattern, how empresaId is fetched
- `src/types/index.ts` — `ContenidoBloque`, `ProgresoModulo`, `AdminEmpleadoConProgreso`
- `src/app/globals.css` — `.glass-card`, `.gradient-bg`, `.shimmer`, `.animate-spin-fast`
- `docs/plans/2026-03-15-admin-detalle-conocimiento-design.md` — approved design

---

## Task 1: Install `@anthropic-ai/sdk` + create `src/lib/claude.ts`

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/lib/claude.ts`

**Step 1: Install the SDK**

```bash
cd C:/Users/Maxi/onboardai && npm install @anthropic-ai/sdk
```

Expected: `@anthropic-ai/sdk` added to `package.json` dependencies.

**Step 2: Create `src/lib/claude.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'

// Singleton — solo para Server Components y API routes
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
```

**Step 3: Verify TypeScript**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors.

**Step 4: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add package.json package-lock.json src/lib/claude.ts && git commit -m "feat(lib): install @anthropic-ai/sdk and create Claude client singleton"
```

---

## Task 2: Create API route `/api/admin/reporte/[id]/route.ts`

**Files:**
- Create: `src/app/api/admin/reporte/[id]/route.ts`

Server-side route that verifies admin auth, loads employee data from Supabase, builds a prompt, and streams Claude's response as plain text.

**Step 1: Create the file**

Create `src/app/api/admin/reporte/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { anthropic } from '@/lib/claude'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: empleadoId } = await params
  const supabase = await createServerSupabaseClient()

  // 1. Verificar que el caller es admin
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminData } = await supabase
    .from('usuarios')
    .select('rol, empresa_id')
    .eq('id', user.id)
    .single()

  if (adminData?.rol !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Cargar datos del empleado
  const [empleadoRes, progresoRes, tareasRes, culturaCntRes] = await Promise.all([
    supabase
      .from('usuarios')
      .select('nombre, puesto, area, fecha_ingreso')
      .eq('id', empleadoId)
      .single(),
    supabase
      .from('progreso_modulos')
      .select('modulo, bloque, completado')
      .eq('usuario_id', empleadoId),
    supabase
      .from('tareas_onboarding')
      .select('titulo, semana, completada')
      .eq('usuario_id', empleadoId),
    supabase
      .from('conocimiento')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', adminData.empresa_id)
      .eq('modulo', 'cultura'),
  ])

  const empleado = empleadoRes.data
  if (!empleado) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Obtener últimas preguntas al asistente IA (tabla puede no existir aún)
  let ultimasPreguntas: string[] = []
  try {
    const { data: convs } = await supabase
      .from('conversaciones_ia')
      .select('id')
      .eq('usuario_id', empleadoId)
      .order('updated_at', { ascending: false })
      .limit(5)

    if (convs && convs.length > 0) {
      const convIds = convs.map(c => c.id)
      const { data: msgs } = await supabase
        .from('mensajes_ia')
        .select('contenido, role')
        .in('conversacion_id', convIds)
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(5)
      ultimasPreguntas = (msgs ?? []).map(m => `- ${m.contenido}`)
    }
  } catch {
    // tabla no existe todavía
  }

  // 3. Calcular métricas
  const dias = empleado.fecha_ingreso
    ? Math.ceil((Date.now() - new Date(empleado.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const progresoRows = progresoRes.data ?? []
  const totalBloquesCultura = culturaCntRes.count ?? 0
  const pctCultura =
    totalBloquesCultura > 0
      ? Math.round(
          (progresoRows.filter(p => p.modulo === 'cultura' && p.completado).length /
            totalBloquesCultura) *
            100
        )
      : 0
  const pctRol = progresoRows.some(p => p.modulo === 'rol' && p.completado) ? 100 : 0

  const tareas = tareasRes.data ?? []
  const tareasCompletadas = tareas.filter(t => t.completada).length
  const tareasPendientes = tareas
    .filter(t => !t.completada)
    .map(t => `- ${t.titulo} (semana ${t.semana})`)

  // 4. Construir prompt
  const prompt = `Sos un asistente de RRHH. Generá un reporte ejecutivo del proceso de onboarding.

DATOS DEL EMPLEADO:
- Nombre: ${empleado.nombre}
- Puesto: ${empleado.puesto ?? 'No especificado'}
- Área: ${empleado.area ?? 'No especificada'}
- Días en la empresa: ${dias}
- Progreso módulo Cultura: ${pctCultura}%
- Progreso módulo Rol: ${pctRol}%
- Tareas completadas: ${tareasCompletadas} de ${tareas.length}
- Tareas pendientes:
${tareasPendientes.join('\n') || '  Ninguna'}
- Últimas preguntas al asistente IA:
${ultimasPreguntas.join('\n') || '  Sin preguntas registradas'}

Generá el reporte con estas secciones exactas (usá ## como encabezado de cada una):
## Resumen Ejecutivo
## Avances Destacados
## Áreas de Atención
## Recomendaciones

Extensión: 300-400 palabras. Idioma: español rioplatense. Tono: profesional pero cercano.`

  // 5. Streamear respuesta
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const msgStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        })

        for await (const event of msgStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
```

**Step 2: Verify TypeScript**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors.

**Step 3: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/app/api/ && git commit -m "feat(api): add streaming report endpoint POST /api/admin/reporte/[id]"
```

---

## Task 3: Patch admin dashboard — make employee cards clickable

**Files:**
- Modify: `src/app/admin/page.tsx`

The `EmpleadoCard` component in the dashboard needs to navigate to `/admin/empleado/[id]` when clicked.

**Step 1: Add `Link` import at top of file**

In `src/app/admin/page.tsx`, after the existing imports, add:

```typescript
import Link from 'next/link'
```

**Step 2: Wrap the card div in a Link**

Find the `EmpleadoCard` function. The outer `motion.div` with `variants={cardVariants}` should become a `Link`:

Replace:
```tsx
function EmpleadoCard({ empleado }: { empleado: AdminEmpleadoConProgreso }) {
  ...
  return (
    <motion.div variants={cardVariants} className="glass-card rounded-xl p-4 flex flex-col gap-3">
```

With:
```tsx
function EmpleadoCard({ empleado }: { empleado: AdminEmpleadoConProgreso }) {
  ...
  return (
    <motion.div
      variants={cardVariants}
      className="glass-card rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:border-white/[0.12] transition-colors duration-150"
    >
      <Link href={`/admin/empleado/${empleado.id}`} className="absolute inset-0 z-10" aria-label={`Ver detalle de ${empleado.nombre}`} />
```

Wait, that approach with absolute positioning can be tricky. A cleaner approach is to just make the whole card a `motion(Link)` or wrap with a Link and use `block` display.

Actually, the simplest approach: wrap the card content inside a `Link` that has `block` display:

Replace the entire `EmpleadoCard` function:

```tsx
function EmpleadoCard({ empleado }: { empleado: AdminEmpleadoConProgreso }) {
  const dias = diasDeOnboarding(empleado.fecha_ingreso)
  const initials = getInitials(empleado.nombre)

  return (
    <motion.div variants={cardVariants}>
      <Link
        href={`/admin/empleado/${empleado.id}`}
        className="glass-card rounded-xl p-4 flex flex-col gap-3 block
          hover:border-white/[0.12] transition-colors duration-150 group"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full flex-shrink-0 bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center overflow-hidden">
            {empleado.foto_url ? (
              <img src={empleado.foto_url} alt={empleado.nombre} className="w-full h-full object-cover" />
            ) : (
              <span className="text-indigo-300 text-sm font-semibold">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white/90 truncate flex-1 group-hover:text-white transition-colors duration-150">
                {empleado.nombre}
              </p>
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${semaforoColor(empleado.progreso)}`}
                title={`Progreso: ${empleado.progreso}%`}
              />
            </div>
            {empleado.puesto && (
              <p className="text-xs text-white/40 truncate">{empleado.puesto}</p>
            )}
            {empleado.area && (
              <p className="text-[11px] text-white/25 truncate">{empleado.area}</p>
            )}
          </div>
        </div>
        <ProgressBar value={empleado.progreso} animated />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/30">
            Ingresó {formatFecha(empleado.fecha_ingreso)}
          </span>
          {dias !== null && (
            <span className="text-[11px] font-mono text-white/35">Día {dias}</span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
```

**Step 3: Verify TypeScript**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors.

**Step 4: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/app/admin/page.tsx && git commit -m "feat(admin): make employee cards link to detail page"
```

---

## Task 4: Create `/admin/empleado/[id]/page.tsx`

**Files:**
- Create: `src/app/admin/empleado/[id]/page.tsx`

**Step 1: Create the file with full implementation**

Create `src/app/admin/empleado/[id]/page.tsx`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Wrench,
  CheckSquare,
  MessageSquare,
  Sparkles,
  Circle,
  Clock,
  ChevronDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────

interface EmpleadoDetalle {
  id: string
  nombre: string
  puesto?: string
  area?: string
  foto_url?: string
  fecha_ingreso?: string
}

interface ProgresoModuloData {
  modulo: string
  label: string
  icon: React.ReactNode
  completados: number
  total: number
  pct: number
}

interface TimelineEvento {
  id: string
  tipo: 'ingreso' | 'bloque' | 'tarea'
  descripcion: string
  fecha: string
}

interface PreguntaIA {
  id: string
  pregunta: string
  respuesta: string
  fecha: string
}

interface TareaPendiente {
  id: string
  titulo: string
  semana: number
}

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getInitials(nombre: string) {
  return nombre
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatFecha(dateStr?: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatFechaCorta(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  })
}

function tiempoRelativo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutos = Math.floor(diffMs / 60000)
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas}h`
  return `hace ${Math.floor(horas / 24)}d`
}

function diasDeOnboarding(fechaIngreso?: string): number {
  if (!fechaIngreso) return 0
  return Math.max(1, Math.ceil((Date.now() - new Date(fechaIngreso).getTime()) / (1000 * 60 * 60 * 24)))
}

// Mini renderer de markdown para el reporte IA
function renderLinea(line: string, key: number): React.ReactNode {
  if (line.startsWith('## ')) {
    return (
      <h3 key={key} className="text-sm font-semibold text-white/90 mt-5 mb-2 first:mt-0">
        {line.slice(3)}
      </h3>
    )
  }
  if (line.startsWith('- ')) {
    return (
      <li key={key} className="text-sm text-white/65 ml-4 list-disc">
        {line.slice(2)}
      </li>
    )
  }
  if (line.trim() === '') return <br key={key} />
  return (
    <p key={key} className="text-sm text-white/65 leading-relaxed">
      {line}
    </p>
  )
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="shimmer rounded-xl h-28" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="shimmer rounded-xl h-40" />
        <div className="shimmer rounded-xl h-40" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="shimmer rounded-xl h-52" />
        <div className="shimmer rounded-xl h-52" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function EmpleadoDetallePage() {
  const params = useParams<{ id: string }>()
  const empleadoId = params.id

  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [empleado, setEmpleado] = useState<EmpleadoDetalle | null>(null)
  const [progresos, setProgresos] = useState<ProgresoModuloData[]>([])
  const [timeline, setTimeline] = useState<TimelineEvento[]>([])
  const [preguntas, setPreguntas] = useState<PreguntaIA[]>([])
  const [tareasPendientes, setTareasPendientes] = useState<TareaPendiente[]>([])

  // Reporte
  const [generando, setGenerando] = useState(false)
  const [reporte, setReporte] = useState('')
  const [reporteVisible, setReporteVisible] = useState(false)

  // ── Carga de datos ──
  const cargarDatos = useCallback(async (empId: string, adminEmpresaId: string) => {
    const supabase = createClient()

    const [
      empleadoRes,
      progresoRes,
      culturaCntRes,
      tareasCompRes,
      tareasPendRes,
    ] = await Promise.all([
      supabase
        .from('usuarios')
        .select('id, nombre, puesto, area, foto_url, fecha_ingreso')
        .eq('id', empId)
        .single(),
      supabase
        .from('progreso_modulos')
        .select('modulo, bloque, completado, completado_at')
        .eq('usuario_id', empId),
      supabase
        .from('conocimiento')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', adminEmpresaId)
        .eq('modulo', 'cultura'),
      supabase
        .from('tareas_onboarding')
        .select('id, titulo, semana, completada, completada_at')
        .eq('usuario_id', empId)
        .eq('completada', true)
        .order('completada_at', { ascending: false }),
      supabase
        .from('tareas_onboarding')
        .select('id, titulo, semana')
        .eq('usuario_id', empId)
        .eq('completada', false)
        .order('semana')
        .limit(10),
    ])

    const emp = empleadoRes.data
    if (!emp) return

    setEmpleado(emp as EmpleadoDetalle)

    // Progreso por módulo
    const progresoRows = progresoRes.data ?? []
    const totalBloquesCultura = culturaCntRes.count ?? 0

    const completadosCultura = progresoRows.filter(p => p.modulo === 'cultura' && p.completado).length
    const completadosRol = progresoRows.filter(p => p.modulo === 'rol' && p.completado).length

    setProgresos([
      {
        modulo: 'cultura',
        label: 'Cultura e Identidad',
        icon: <BookOpen className="w-4 h-4" />,
        completados: completadosCultura,
        total: totalBloquesCultura,
        pct: totalBloquesCultura > 0 ? Math.round((completadosCultura / totalBloquesCultura) * 100) : 0,
      },
      {
        modulo: 'rol',
        label: 'Rol y Herramientas',
        icon: <Wrench className="w-4 h-4" />,
        completados: completadosRol,
        total: 1,
        pct: completadosRol > 0 ? 100 : 0,
      },
    ])

    // Tareas pendientes
    setTareasPendientes((tareasPendRes.data ?? []) as TareaPendiente[])

    // Timeline: ingreso + bloques completados + tareas completadas
    const eventos: TimelineEvento[] = []

    if (emp.fecha_ingreso) {
      eventos.push({
        id: 'ingreso',
        tipo: 'ingreso',
        descripcion: 'Ingresó a la empresa',
        fecha: emp.fecha_ingreso,
      })
    }

    for (const p of progresoRows.filter(p => p.completado && p.completado_at)) {
      const bloqueLabel = p.bloque.replace(/_/g, ' ')
      const moduloLabel = p.modulo === 'cultura' ? 'Cultura' : 'Rol'
      eventos.push({
        id: `bloque-${p.modulo}-${p.bloque}`,
        tipo: 'bloque',
        descripcion: `Completó "${bloqueLabel}" en ${moduloLabel}`,
        fecha: p.completado_at!,
      })
    }

    for (const t of tareasCompRes.data ?? []) {
      if (t.completada_at) {
        eventos.push({
          id: `tarea-${t.id}`,
          tipo: 'tarea',
          descripcion: `Completó tarea: ${t.titulo}`,
          fecha: t.completada_at,
        })
      }
    }

    // Ordenar descendente (más reciente primero)
    eventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    setTimeline(eventos.slice(0, 10))

    // Últimas preguntas al asistente IA (puede no existir la tabla)
    try {
      const { data: convs } = await supabase
        .from('conversaciones_ia')
        .select('id')
        .eq('usuario_id', empId)
        .order('updated_at', { ascending: false })
        .limit(5)

      if (convs && convs.length > 0) {
        const convIds = convs.map(c => c.id)
        const { data: msgs } = await supabase
          .from('mensajes_ia')
          .select('id, conversacion_id, role, contenido, created_at')
          .in('conversacion_id', convIds)
          .order('created_at', { ascending: true })

        if (msgs) {
          const pares: PreguntaIA[] = []
          for (const convId of convIds) {
            const convMsgs = msgs.filter(m => m.conversacion_id === convId)
            const user = convMsgs.find(m => m.role === 'user')
            const assistant = convMsgs.find(m => m.role === 'assistant')
            if (user && assistant) {
              pares.push({
                id: user.id,
                pregunta: user.contenido,
                respuesta: assistant.contenido,
                fecha: user.created_at,
              })
            }
          }
          setPreguntas(pares.slice(0, 5))
        }
      }
    } catch {
      // tabla no existe todavía
    }
  }, [])

  // ── Inicialización ──
  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data: adminData } = await supabase
          .from('usuarios')
          .select('empresa_id')
          .eq('id', user.id)
          .single()

        if (!adminData?.empresa_id) return

        setEmpresaId(adminData.empresa_id)
        await cargarDatos(empleadoId, adminData.empresa_id)
      } catch (err) {
        console.error('Error cargando detalle del empleado:', err)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [empleadoId, cargarDatos])

  // ── Generar reporte ──
  const generarReporte = async () => {
    setGenerando(true)
    setReporte('')
    setReporteVisible(true)

    try {
      const res = await fetch(`/api/admin/reporte/${empleadoId}`, { method: 'POST' })
      if (!res.ok || !res.body) throw new Error('Error en la respuesta')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setReporte(prev => prev + decoder.decode(value, { stream: true }))
      }
    } catch (err) {
      console.error('Error generando reporte:', err)
      setReporte('Error al generar el reporte. Intentá de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  // ── Ícono para timeline ──
  function TimelineIcon({ tipo }: { tipo: TimelineEvento['tipo'] }) {
    if (tipo === 'ingreso') return <Circle className="w-3.5 h-3.5 text-indigo-400" />
    if (tipo === 'bloque') return <BookOpen className="w-3.5 h-3.5 text-teal-400" />
    return <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
  }

  // ─────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="shimmer rounded-md h-5 w-24 mb-6" />
        <PageSkeleton />
      </div>
    )
  }

  if (!empleado) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-white/40 text-sm">Empleado no encontrado.</p>
        <Link href="/admin" className="text-sm text-indigo-400 hover:text-indigo-300">
          ← Volver al dashboard
        </Link>
      </div>
    )
  }

  const dias = diasDeOnboarding(empleado.fecha_ingreso)
  const initials = getInitials(empleado.nombre)

  // ─────────────────────────────────────────────
  // Render principal
  // ─────────────────────────────────────────────
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-5xl mx-auto space-y-6"
    >
      {/* ── Volver ── */}
      <motion.div variants={cardVariants}>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors duration-150"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver al dashboard
        </Link>
      </motion.div>

      {/* ── Header: foto + info ── */}
      <motion.div variants={cardVariants} className="glass-card rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full flex-shrink-0 bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center overflow-hidden">
            {empleado.foto_url ? (
              <img src={empleado.foto_url} alt={empleado.nombre} className="w-full h-full object-cover" />
            ) : (
              <span className="text-indigo-300 text-xl font-semibold">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white leading-tight">{empleado.nombre}</h1>
            {(empleado.puesto || empleado.area) && (
              <p className="text-sm text-white/50 mt-0.5">
                {[empleado.puesto, empleado.area].filter(Boolean).join(' · ')}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
              {empleado.fecha_ingreso && (
                <span className="text-xs text-white/35">
                  Ingresó el {formatFecha(empleado.fecha_ingreso)}
                </span>
              )}
              {dias > 0 && (
                <span className="text-xs font-mono text-indigo-400/70 bg-indigo-600/10 border border-indigo-500/15 px-2 py-0.5 rounded-full">
                  Día {dias} de onboarding
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Progreso + Tareas pendientes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Progreso por módulo */}
        <motion.div variants={cardVariants} className="glass-card rounded-xl p-5">
          <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">
            Progreso por módulo
          </h2>
          <div className="space-y-5">
            {progresos.map(p => (
              <div key={p.modulo}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-white/30">{p.icon}</span>
                  <span className="text-sm text-white/75">{p.label}</span>
                  <span className="ml-auto text-xs font-mono text-white/45">
                    {p.completados}/{p.total} bloques
                  </span>
                </div>
                <ProgressBar value={p.pct} animated />
              </div>
            ))}
            {progresos.length === 0 && (
              <p className="text-sm text-white/30 text-center py-4">Sin datos de progreso</p>
            )}
          </div>
        </motion.div>

        {/* Tareas pendientes */}
        <motion.div variants={cardVariants} className="glass-card rounded-xl p-5">
          <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">
            Tareas pendientes
          </h2>
          {tareasPendientes.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-2">
              <CheckSquare className="w-6 h-6 text-teal-500/30" />
              <p className="text-xs text-white/30">Todas las tareas completadas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tareasPendientes.map(t => (
                <div
                  key={t.id}
                  className="flex items-start gap-2.5 py-2 border-b border-white/[0.04] last:border-0"
                >
                  <div className="w-4 h-4 mt-0.5 rounded border border-white/20 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 leading-snug">{t.titulo}</p>
                    <p className="text-[11px] text-white/30 mt-0.5">Semana {t.semana}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Timeline + Preguntas IA ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Timeline */}
        <motion.div variants={cardVariants} className="glass-card rounded-xl p-5">
          <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Actividad reciente
          </h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-4">Sin actividad registrada</p>
          ) : (
            <div className="relative space-y-0">
              {/* línea vertical */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.06]" />
              {timeline.map((evento, idx) => (
                <div key={evento.id} className="flex items-start gap-3 pl-0 pb-3 last:pb-0">
                  <div className="flex-shrink-0 mt-0.5 relative z-10 bg-surface-900">
                    <TimelineIcon tipo={evento.tipo} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/65 leading-snug">{evento.descripcion}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {idx === 0 ? tiempoRelativo(evento.fecha) : formatFechaCorta(evento.fecha)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Últimas preguntas IA */}
        <motion.div variants={cardVariants} className="glass-card rounded-xl p-5">
          <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" />
            Últimas preguntas al asistente
          </h2>
          {preguntas.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-2">
              <MessageSquare className="w-6 h-6 text-white/10" />
              <p className="text-xs text-white/30 text-center">
                Sin preguntas registradas aún
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {preguntas.map(p => (
                <div key={p.id} className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3">
                  <p className="text-xs font-medium text-white/80 leading-snug line-clamp-2">
                    {p.pregunta}
                  </p>
                  <p className="text-[11px] text-white/40 mt-1.5 leading-snug line-clamp-3">
                    {p.respuesta}
                  </p>
                  <p className="text-[10px] text-white/25 mt-1.5">{tiempoRelativo(p.fecha)}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Reporte 30 días ── */}
      <motion.div variants={cardVariants} className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-medium text-white/80">Reporte ejecutivo</h2>
            <p className="text-xs text-white/35 mt-0.5">
              Resumen del onboarding generado por IA con recomendaciones
            </p>
          </div>
          <button
            onClick={generarReporte}
            disabled={generando}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              'bg-indigo-600 hover:bg-indigo-500 text-white',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            {generando ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generar reporte 30 días
              </>
            )}
          </button>
        </div>

        {/* Panel de reporte con streaming */}
        <AnimatePresence>
          {reporteVisible && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-5 pt-5 border-t border-white/[0.06]">
                {reporte ? (
                  <div className="space-y-1">
                    {reporte.split('\n').map((line, i) => renderLinea(line, i))}
                    {generando && (
                      <span className="inline-block w-1 h-4 bg-indigo-400 animate-pulse ml-0.5" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-white/40 text-sm">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin-fast" />
                    Iniciando generación...
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {reporteVisible && reporte && !generando && (
          <button
            onClick={() => setReporteVisible(false)}
            className="mt-3 flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors duration-150"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Ocultar reporte
          </button>
        )}
      </motion.div>
    </motion.div>
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
cd C:/Users/Maxi/onboardai && git add src/app/admin/empleado/ && git commit -m "feat(admin): add employee detail page with AI streaming report"
```

---

## Task 5: Create `/admin/conocimiento/page.tsx`

**Files:**
- Create: `src/app/admin/conocimiento/page.tsx`

**Step 1: Create the file**

Create `src/app/admin/conocimiento/page.tsx`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Wrench, AlertTriangle, Plus, Edit3, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { ContenidoBloque } from '@/types'

// ─────────────────────────────────────────────
// Constantes: módulos y bloques del producto
// ─────────────────────────────────────────────

const MODULOS = [
  {
    key: 'cultura',
    label: 'Cultura e Identidad',
    icon: <BookOpen className="w-4 h-4" />,
    bloques: [
      { key: 'historia', label: 'Historia de la empresa' },
      { key: 'mision', label: 'Misión, visión y valores' },
      { key: 'como_trabajamos', label: 'Cómo trabajamos' },
      { key: 'expectativas', label: 'Expectativas' },
      { key: 'hitos', label: 'Hitos y logros' },
    ],
  },
  {
    key: 'rol',
    label: 'Rol y Herramientas',
    icon: <Wrench className="w-4 h-4" />,
    bloques: [
      { key: 'puesto', label: 'Descripción del puesto' },
      { key: 'autonomia', label: 'Tabla de autonomía' },
    ],
  },
]

// Lista plana de todos los bloques para el select
const TODOS_LOS_BLOQUES = MODULOS.flatMap(m =>
  m.bloques.map(b => ({ modulo: m.key, bloque: b.key, label: `${m.label} — ${b.label}` }))
)

// ─────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────

interface AlertaRow {
  id: string
  pregunta: string
  usuario_id: string
  created_at: string
  usuarios: { nombre: string }[] | null
}

type EstadoBloque = 'vacio' | 'parcial' | 'completo'

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function estadoBloque(contenido?: ContenidoBloque): EstadoBloque {
  if (!contenido) return 'vacio'
  if (contenido.contenido.length < 100) return 'parcial'
  return 'completo'
}

function tiempoRelativo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutos = Math.floor(diffMs / 60000)
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas}h`
  return `hace ${Math.floor(horas / 24)}d`
}

// ─────────────────────────────────────────────
// Mini Markdown Preview (sin librerías externas)
// ─────────────────────────────────────────────

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={i} className="text-white/90 font-semibold">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <em key={i} className="text-white/70">{part.slice(1, -1)}</em>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function MiniMarkdownPreview({ text }: { text: string }) {
  if (!text.trim()) {
    return <p className="text-white/25 text-sm italic">El preview aparecerá aquí...</p>
  }

  const lines = text.split('\n')
  const elementos: React.ReactNode[] = []
  let listBuffer: React.ReactNode[] = []

  const flushList = (key: string) => {
    if (listBuffer.length > 0) {
      elementos.push(
        <ul key={key} className="list-disc ml-4 space-y-0.5 text-sm text-white/65">
          {listBuffer}
        </ul>
      )
      listBuffer = []
    }
  }

  lines.forEach((line, i) => {
    if (line.startsWith('# ')) {
      flushList(`list-${i}`)
      elementos.push(<h2 key={i} className="text-base font-bold text-white/90 mt-3 mb-1 first:mt-0">{formatInline(line.slice(2))}</h2>)
    } else if (line.startsWith('## ')) {
      flushList(`list-${i}`)
      elementos.push(<h3 key={i} className="text-sm font-semibold text-white/80 mt-3 mb-1 first:mt-0">{formatInline(line.slice(3))}</h3>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listBuffer.push(<li key={i}>{formatInline(line.slice(2))}</li>)
    } else if (line.trim() === '') {
      flushList(`list-${i}`)
      elementos.push(<br key={i} />)
    } else {
      flushList(`list-${i}`)
      elementos.push(<p key={i} className="text-sm text-white/65 leading-relaxed">{formatInline(line)}</p>)
    }
  })

  flushList('final')

  return <div className="space-y-1">{elementos}</div>
}

// ─────────────────────────────────────────────
// Indicador de estado del bloque
// ─────────────────────────────────────────────

function EstadoDot({ estado }: { estado: EstadoBloque }) {
  if (estado === 'completo') return <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
  if (estado === 'parcial') return <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
  return <span className="w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function ConocimientoPage() {
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [alertas, setAlertas] = useState<AlertaRow[]>([])
  const [conocimientoMap, setConocimientoMap] = useState<Record<string, ContenidoBloque>>({})

  // Modal contenido: agregar/editar un bloque
  const [modalContenido, setModalContenido] = useState<{
    modulo: string
    bloque: string
    label: string
  } | null>(null)
  const [editTitulo, setEditTitulo] = useState('')
  const [editContenido, setEditContenido] = useState('')

  // Modal alerta: responder pregunta sin respuesta
  const [alertaActiva, setAlertaActiva] = useState<AlertaRow | null>(null)
  const [alertaBloqueKey, setAlertaBloqueKey] = useState('')
  const [alertaContenido, setAlertaContenido] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [guardadoFeedback, setGuardadoFeedback] = useState(false)

  // ── Carga de datos ──
  const cargarDatos = useCallback(async (empId: string) => {
    const supabase = createClient()

    const [alertasRes, conocimientoRes] = await Promise.all([
      supabase
        .from('alertas_conocimiento')
        .select('id, pregunta, usuario_id, created_at, usuarios(nombre)')
        .eq('empresa_id', empId)
        .eq('resuelta', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('conocimiento')
        .select('*')
        .eq('empresa_id', empId),
    ])

    setAlertas((alertasRes.data ?? []) as AlertaRow[])

    const mapa: Record<string, ContenidoBloque> = {}
    for (const item of conocimientoRes.data ?? []) {
      mapa[`${item.modulo}-${item.bloque}`] = item as ContenidoBloque
    }
    setConocimientoMap(mapa)
  }, [])

  // ── Inicialización ──
  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data: adminData } = await supabase
          .from('usuarios')
          .select('empresa_id')
          .eq('id', user.id)
          .single()

        if (!adminData?.empresa_id) return

        setEmpresaId(adminData.empresa_id)
        await cargarDatos(adminData.empresa_id)
      } catch (err) {
        console.error('Error cargando conocimiento:', err)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [cargarDatos])

  // ── Abrir modal contenido ──
  const abrirModalContenido = (modulo: string, bloque: string, label: string) => {
    const existing = conocimientoMap[`${modulo}-${bloque}`]
    setEditTitulo(existing?.titulo ?? label)
    setEditContenido(existing?.contenido ?? '')
    setModalContenido({ modulo, bloque, label })
  }

  // ── Guardar contenido ──
  const guardarContenido = async () => {
    if (!empresaId || !modalContenido || !editContenido.trim()) return
    setGuardando(true)

    try {
      const supabase = createClient()
      const key = `${modalContenido.modulo}-${modalContenido.bloque}`
      const existing = conocimientoMap[key]

      let savedRow: ContenidoBloque

      if (existing) {
        await supabase
          .from('conocimiento')
          .update({ titulo: editTitulo, contenido: editContenido })
          .eq('id', existing.id)
        savedRow = { ...existing, titulo: editTitulo, contenido: editContenido }
      } else {
        const { data } = await supabase
          .from('conocimiento')
          .insert({
            empresa_id: empresaId,
            modulo: modalContenido.modulo,
            bloque: modalContenido.bloque,
            titulo: editTitulo,
            contenido: editContenido,
          })
          .select()
          .single()
        savedRow = data as ContenidoBloque
      }

      setConocimientoMap(prev => ({ ...prev, [key]: savedRow }))
      setGuardadoFeedback(true)
      setTimeout(() => {
        setGuardadoFeedback(false)
        setModalContenido(null)
      }, 800)
    } catch (err) {
      console.error('Error guardando conocimiento:', err)
    } finally {
      setGuardando(false)
    }
  }

  // ── Guardar respuesta a alerta ──
  const guardarRespuestaAlerta = async () => {
    if (!empresaId || !alertaActiva || !alertaBloqueKey || !alertaContenido.trim()) return
    setGuardando(true)

    try {
      const supabase = createClient()
      const [modulo, bloque] = alertaBloqueKey.split('-')
      const key = alertaBloqueKey
      const existing = conocimientoMap[key]
      const bloqueLabel =
        TODOS_LOS_BLOQUES.find(b => `${b.modulo}-${b.bloque}` === key)?.label.split(' — ')[1] ?? bloque

      const nuevoContenido = existing
        ? `${existing.contenido}\n\n---\n\n${alertaContenido}`
        : alertaContenido

      let savedRow: ContenidoBloque

      if (existing) {
        await supabase
          .from('conocimiento')
          .update({ contenido: nuevoContenido })
          .eq('id', existing.id)
        savedRow = { ...existing, contenido: nuevoContenido }
      } else {
        const { data } = await supabase
          .from('conocimiento')
          .insert({
            empresa_id: empresaId,
            modulo,
            bloque,
            titulo: bloqueLabel,
            contenido: nuevoContenido,
          })
          .select()
          .single()
        savedRow = data as ContenidoBloque
      }

      // Marcar alerta como resuelta
      await supabase
        .from('alertas_conocimiento')
        .update({ resuelta: true })
        .eq('id', alertaActiva.id)

      // Actualizar estado local
      setAlertas(prev => prev.filter(a => a.id !== alertaActiva.id))
      setConocimientoMap(prev => ({ ...prev, [key]: savedRow }))

      setAlertaActiva(null)
      setAlertaBloqueKey('')
      setAlertaContenido('')
    } catch (err) {
      console.error('Error guardando respuesta:', err)
    } finally {
      setGuardando(false)
    }
  }

  // ─────────────────────────────────────────────
  // Loading skeleton
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="shimmer rounded-xl h-24" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="shimmer rounded-xl h-48" />
          <div className="shimmer rounded-xl h-48" />
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────
  // Render principal
  // ─────────────────────────────────────────────

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-5xl mx-auto space-y-6"
      >
        {/* ── Alertas de conocimiento faltante ── */}
        {alertas.length > 0 && (
          <motion.div variants={cardVariants} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-medium text-white/80">
                Alertas de conocimiento faltante
              </h2>
              <span className="ml-auto text-[11px] font-mono text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                {alertas.length} sin resolver
              </span>
            </div>

            <div className="space-y-2">
              {alertas.map(alerta => (
                <motion.div
                  key={alerta.id}
                  layout
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="flex items-start gap-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/15 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/75 leading-snug line-clamp-2">
                      &ldquo;{alerta.pregunta}&rdquo;
                    </p>
                    <p className="text-[11px] text-white/35 mt-1">
                      {alerta.usuarios?.[0]?.nombre ?? 'Empleado'} · {tiempoRelativo(alerta.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setAlertaActiva(alerta)
                      setAlertaBloqueKey('')
                      setAlertaContenido('')
                    }}
                    className="flex-shrink-0 text-xs font-medium text-amber-400/80 hover:text-amber-300
                      border border-amber-500/25 hover:border-amber-400/40
                      px-2.5 py-1.5 rounded-lg transition-colors duration-150 whitespace-nowrap"
                  >
                    Responder
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Módulos de conocimiento ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {MODULOS.map(modulo => (
            <motion.div key={modulo.key} variants={cardVariants} className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-white/35">{modulo.icon}</span>
                <h2 className="text-sm font-medium text-white/80">{modulo.label}</h2>
              </div>

              <div className="space-y-1.5">
                {modulo.bloques.map(bloque => {
                  const key = `${modulo.key}-${bloque.key}`
                  const contenido = conocimientoMap[key]
                  const estado = estadoBloque(contenido)

                  return (
                    <div
                      key={bloque.key}
                      className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0"
                    >
                      <EstadoDot estado={estado} />
                      <span className="flex-1 text-sm text-white/65 truncate">{bloque.label}</span>
                      {contenido && (
                        <span className="text-[10px] text-white/25 font-mono mr-2">
                          {contenido.contenido.length} chars
                        </span>
                      )}
                      <button
                        onClick={() => abrirModalContenido(modulo.key, bloque.key, bloque.label)}
                        className={cn(
                          'flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md',
                          'transition-colors duration-150',
                          estado === 'vacio'
                            ? 'text-indigo-400/80 hover:text-indigo-300 border border-indigo-500/25 hover:border-indigo-400/40'
                            : 'text-white/35 hover:text-white/70 border border-white/[0.08] hover:border-white/[0.15]'
                        )}
                      >
                        {estado === 'vacio' ? (
                          <><Plus className="w-3 h-3" /> Agregar</>
                        ) : (
                          <><Edit3 className="w-3 h-3" /> Editar</>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════
          Modal: Editar/Agregar contenido
      ═══════════════════════════════════════ */}
      <AnimatePresence>
        {modalContenido && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/70 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => !guardando && setModalContenido(null)}
            />

            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <div
                className="glass-card rounded-xl w-full max-w-3xl flex flex-col"
                style={{ maxHeight: 'min(85vh, 680px)' }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/[0.06] flex-shrink-0">
                  <div>
                    <p className="text-[11px] text-white/35 uppercase tracking-widest">
                      {conocimientoMap[`${modalContenido.modulo}-${modalContenido.bloque}`]
                        ? 'Editar contenido'
                        : 'Agregar contenido'}
                    </p>
                    <h3 className="text-sm font-medium text-white mt-0.5">{modalContenido.label}</h3>
                  </div>
                  <button
                    onClick={() => !guardando && setModalContenido(null)}
                    className="text-white/30 hover:text-white/70 transition-colors duration-150 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body: split editor / preview */}
                <div className="flex-1 overflow-hidden grid grid-cols-2 min-h-0">
                  {/* Editor */}
                  <div className="flex flex-col gap-3 p-4 border-r border-white/[0.06] min-h-0">
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">
                        Título
                      </label>
                      <input
                        value={editTitulo}
                        onChange={e => setEditTitulo(e.target.value)}
                        className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2
                          text-white outline-none focus:border-indigo-500/40 transition-colors"
                        placeholder="Título de la sección"
                      />
                    </div>
                    <div className="flex-1 flex flex-col min-h-0">
                      <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">
                        Contenido (Markdown)
                      </label>
                      <textarea
                        value={editContenido}
                        onChange={e => setEditContenido(e.target.value)}
                        className="flex-1 w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg
                          px-3 py-2 text-white/80 outline-none focus:border-indigo-500/40
                          resize-none font-mono transition-colors placeholder:text-white/20"
                        placeholder={'# Título\n\nEscribí el contenido acá...\n\n**negrita** *itálica*\n- lista'}
                        style={{ minHeight: '200px' }}
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="flex flex-col p-4 overflow-y-auto min-h-0">
                    <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-2 flex-shrink-0">
                      Preview
                    </label>
                    <MiniMarkdownPreview text={editContenido} />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-white/[0.06] flex-shrink-0">
                  <button
                    onClick={() => !guardando && setModalContenido(null)}
                    className="text-sm text-white/40 hover:text-white/70 px-4 py-2 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarContenido}
                    disabled={guardando || !editContenido.trim()}
                    className={cn(
                      'flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-lg transition-all duration-150',
                      'bg-indigo-600 hover:bg-indigo-500 text-white',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {guardadoFeedback ? (
                      <><Check className="w-3.5 h-3.5 text-teal-300" /> Guardado</>
                    ) : guardando ? (
                      <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" /> Guardando...</>
                    ) : (
                      'Guardar'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════
          Modal: Responder alerta
      ═══════════════════════════════════════ */}
      <AnimatePresence>
        {alertaActiva && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/70 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => !guardando && setAlertaActiva(null)}
            />

            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <div
                className="glass-card rounded-xl w-full max-w-2xl flex flex-col"
                style={{ maxHeight: 'min(85vh, 640px)' }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="p-4 border-b border-white/[0.06] flex-shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] text-amber-400/70 uppercase tracking-widest mb-1">
                        Pregunta sin respuesta
                      </p>
                      <p className="text-sm text-white/80 leading-snug">
                        &ldquo;{alertaActiva.pregunta}&rdquo;
                      </p>
                      <p className="text-[11px] text-white/30 mt-1">
                        {alertaActiva.usuarios?.[0]?.nombre ?? 'Empleado'} · {tiempoRelativo(alertaActiva.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => !guardando && setAlertaActiva(null)}
                      className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
                  {/* Selector de bloque */}
                  <div>
                    <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">
                      ¿A qué sección pertenece esta respuesta?
                    </label>
                    <select
                      value={alertaBloqueKey}
                      onChange={e => setAlertaBloqueKey(e.target.value)}
                      className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5
                        text-white outline-none focus:border-indigo-500/40 transition-colors"
                    >
                      <option value="" disabled className="bg-surface-900">
                        Seleccioná una sección...
                      </option>
                      {TODOS_LOS_BLOQUES.map(b => (
                        <option key={`${b.modulo}-${b.bloque}`} value={`${b.modulo}-${b.bloque}`} className="bg-surface-900">
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Textarea */}
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] text-white/30 uppercase tracking-widest">
                      Contenido a agregar (Markdown)
                    </label>
                    <textarea
                      value={alertaContenido}
                      onChange={e => setAlertaContenido(e.target.value)}
                      className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg
                        px-3 py-2 text-white/80 outline-none focus:border-indigo-500/40
                        resize-none font-mono transition-colors placeholder:text-white/20"
                      placeholder="Escribí la respuesta aquí..."
                      rows={6}
                    />
                    <p className="text-[10px] text-white/25">
                      {alertaBloqueKey && conocimientoMap[alertaBloqueKey]
                        ? 'Este contenido se agregará al final de la sección existente.'
                        : alertaBloqueKey
                        ? 'Se creará una nueva sección con este contenido.'
                        : ''}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-white/[0.06] flex-shrink-0">
                  <button
                    onClick={() => !guardando && setAlertaActiva(null)}
                    className="text-sm text-white/40 hover:text-white/70 px-4 py-2 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarRespuestaAlerta}
                    disabled={guardando || !alertaBloqueKey || !alertaContenido.trim()}
                    className={cn(
                      'flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-lg transition-all duration-150',
                      'bg-amber-600 hover:bg-amber-500 text-white',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {guardando ? (
                      <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" /> Guardando...</>
                    ) : (
                      'Agregar al conocimiento'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
cd C:/Users/Maxi/onboardai && git add src/app/admin/conocimiento/ && git commit -m "feat(admin): add knowledge management page with markdown editor and alert responses"
```

---

## Task 6: Update admin layout nav + final verification

The admin layout has `Conocimiento` as a disabled nav item. Now that the page exists, enable the link.

**Files:**
- Modify: `src/app/admin/layout.tsx`

**Step 1: Enable the Conocimiento nav item**

In `src/app/admin/layout.tsx`, find the navItems array and change the `conocimiento` entry:

```typescript
// BEFORE:
{
  label: 'Conocimiento',
  href: '/admin/conocimiento',
  icon: <BookOpen className="w-4 h-4" />,
  disabled: true,
},

// AFTER:
{
  label: 'Conocimiento',
  href: '/admin/conocimiento',
  icon: <BookOpen className="w-4 h-4" />,
  disabled: false,
},
```

**Step 2: Full TypeScript check**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors.

**Step 3: Build check**

```bash
cd C:/Users/Maxi/onboardai && npm run build
```

Expected: clean build with routes `/admin`, `/admin/empleado/[id]`, `/admin/conocimiento`.

**Step 4: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/app/admin/layout.tsx && git commit -m "feat(admin): enable Conocimiento nav link"
```

---

## Verification checklist

1. `npx tsc --noEmit` → zero errors
2. `npm run build` → routes `/admin`, `/admin/empleado/[id]`, `/admin/conocimiento` appear
3. Navegar a `/admin` → employee cards son clickeables y llevan a `/admin/empleado/[id]`
4. En `/admin/empleado/[id]` → se ven progreso, timeline, tareas, botón de reporte
5. Click "Generar reporte 30 días" → texto aparece en streaming
6. Navegar a `/admin/conocimiento` → se ven bloques con estados (vacío/parcial/completo)
7. Click "Agregar" en un bloque → modal con split editor/preview
8. Escribir markdown → preview se actualiza en tiempo real
9. Guardar → estado del bloque cambia, modal cierra
10. Click "Responder" en una alerta → modal con select + textarea → guardar marca alerta resuelta
