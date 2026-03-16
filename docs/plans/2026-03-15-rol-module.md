# Módulo 3 — Rol y Herramientas: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `/empleado/rol` — single scrollable page with 4 sections: puesto + autonomy table, expandable tool cards grid, interactive weekly task checkboxes, and a read-only 4-week objectives timeline.

**Architecture:** Single Client Component file (`src/app/empleado/rol/page.tsx`) with all subcomponents defined locally — same pattern as M2 (`cultura/page.tsx`). Data loaded via `Promise.all` from 4 Supabase tables. Task toggles use optimistic updates with rollback on error. Module progress is recalculated client-side and upserted on every toggle.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, Framer Motion v12, Supabase (`@supabase/ssr`), lucide-react, react-hot-toast.

---

## Reference files (read these before coding)

- `src/app/empleado/cultura/page.tsx` — follow this exact pattern (single file, Client Component, Framer Motion, Supabase, toaster)
- `src/types/index.ts` — add new types here in Task 1
- `src/components/ui/Badge.tsx` — variants: `default`, `success`, `warning`, `error`, `info`
- `src/components/ui/ProgressBar.tsx` — props: `value`, `label`, `showPercentage`, `animated`
- `src/lib/supabase.ts` — import `createClient` from here
- `src/lib/utils.ts` — import `cn` from here
- `src/app/globals.css` — has `.shimmer`, `.glass-card`, `.gradient-bg` utilities

---

## Task 1: Add TypeScript types to `src/types/index.ts`

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Append the 5 new interfaces**

Add at the end of `src/types/index.ts`:

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

**Step 2: Verify TypeScript (from project root)**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors.

**Step 3: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/types/index.ts && git commit -m "feat(types): add M3 types — TareaOnboarding, HerramientaRol, ObjetivoRol, DecisionAutonomia"
```

---

## Task 2: Create `src/app/empleado/rol/page.tsx`

**Files:**
- Create: `src/app/empleado/rol/page.tsx`

This is a single file containing all subcomponents. Write the entire file as shown below.

**Step 1: Create the file with the complete implementation**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, ExternalLink,
  MessageSquare, Mail, FileText, Code, Globe, Wrench,
  Zap, Database, BarChart2, Shield, Package, Briefcase,
  Monitor, Layers, Settings, Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/utils'
import type { TareaOnboarding, HerramientaRol, ObjetivoRol, DecisionAutonomia } from '@/types'

// ─────────────────────────────────────────
// Mapeo de íconos por nombre (string → componente Lucide)
// ─────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  MessageSquare, Mail, FileText, Code, Globe, Wrench,
  Zap, Database, BarChart2, Shield, Package, Briefcase,
  Monitor, Layers, Settings, Users,
}

function ToolIcon({ icono, className }: { icono?: string; className?: string }) {
  const Icon = (icono && ICON_MAP[icono]) ? ICON_MAP[icono] : Globe
  return <Icon className={className} />
}

// ─────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 24 } },
}

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 26 } },
}

// ─────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────

function SkeletonRol() {
  return (
    <div className="space-y-6">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="glass-card rounded-xl p-5">
          <div className="shimmer rounded-md h-5 w-40 mb-4" />
          <div className="space-y-2">
            <div className="shimmer rounded-md h-3 w-full" />
            <div className="shimmer rounded-md h-3 w-4/5" />
            <div className="shimmer rounded-md h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────
// SeccionPuesto: descripción del rol + tabla de autonomía
// ─────────────────────────────────────────

function SeccionPuesto({ puesto, autonomia }: { puesto: string; autonomia: DecisionAutonomia[] }) {
  return (
    <motion.section variants={sectionVariants}>
      <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
        Mi puesto
      </h2>
      <div className="glass-card rounded-xl overflow-hidden">
        {puesto && (
          <div className="p-5 border-b border-white/[0.06]">
            <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{puesto}</p>
          </div>
        )}
        {autonomia.length > 0 && (
          <div className="p-5">
            <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest mb-3">
              Tabla de autonomía
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="pb-2 pr-4 text-left text-xs font-medium text-white/30 w-1/2">
                      Decisión
                    </th>
                    <th className="pb-2 pr-3 text-xs font-medium text-teal-400/70 text-center">
                      Puedo solo
                    </th>
                    <th className="pb-2 pr-3 text-xs font-medium text-amber-400/70 text-center">
                      Debo consultar
                    </th>
                    <th className="pb-2 text-xs font-medium text-red-400/70 text-center">
                      Debo escalar
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {autonomia.map((item, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 text-xs text-white/60">{item.decision}</td>
                      <td className="py-2 pr-3 text-center">
                        {item.nivel === 'solo' && <span className="text-teal-400">●</span>}
                      </td>
                      <td className="py-2 pr-3 text-center">
                        {item.nivel === 'consultar' && <span className="text-amber-400">●</span>}
                      </td>
                      <td className="py-2 text-center">
                        {item.nivel === 'escalar' && <span className="text-red-400">●</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!puesto && autonomia.length === 0 && (
          <div className="p-5">
            <p className="text-sm text-white/30 italic">
              El administrador aún no cargó la descripción del puesto.
            </p>
          </div>
        )}
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────
// HerramientaCard: card con expand/collapse de guía
// ─────────────────────────────────────────

function HerramientaCard({ herramienta }: { herramienta: HerramientaRol }) {
  const [expandida, setExpandida] = useState(false)
  const guia = herramienta.guia ?? []
  const todosLosPasos = guia.flatMap(g => g.pasos)
  const preview = todosLosPasos.slice(0, 3)

  return (
    <motion.div variants={itemVariants} className="flex flex-col gap-1">
      <div className="glass-card rounded-xl p-4 flex flex-col">
        {/* Header: ícono + nombre + link */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600/15 flex items-center justify-center flex-shrink-0">
            <ToolIcon icono={herramienta.icono} className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white leading-tight">{herramienta.nombre}</p>
            {herramienta.url && (
              <a
                href={herramienta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-0.5 transition-colors"
              >
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Preview: top 3 pasos */}
        {preview.length > 0 && (
          <ul className="space-y-1 mb-3 flex-1">
            {preview.map((paso, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-white/45 leading-snug">
                <span className="text-white/25 flex-shrink-0">·</span>
                <span className="line-clamp-2">{paso}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Botón expandir/colapsar */}
        {todosLosPasos.length > 0 && (
          <button
            onClick={() => setExpandida(v => !v)}
            className="flex items-center gap-1 text-xs text-indigo-400/70 hover:text-indigo-400 transition-colors mt-auto pt-2"
          >
            {expandida
              ? <><span>Cerrar guía</span> <ChevronUp className="w-3.5 h-3.5" /></>
              : <><span>Ver guía completa</span> <ChevronDown className="w-3.5 h-3.5" /></>}
          </button>
        )}
      </div>

      {/* Contenido expandido: todos los pasos numerados */}
      <AnimatePresence>
        {expandida && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-xl p-4">
              {guia.map((seccion, si) => (
                <div key={si} className={cn(si > 0 && 'mt-4')}>
                  {seccion.titulo && (
                    <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                      {seccion.titulo}
                    </p>
                  )}
                  <ol className="space-y-1.5">
                    {seccion.pasos.map((paso, pi) => (
                      <li key={pi} className="flex gap-2 text-xs text-white/60 leading-relaxed">
                        <span className="font-mono text-white/25 flex-shrink-0 tabular-nums">
                          {(pi + 1).toString().padStart(2, '0')}.
                        </span>
                        <span>{paso}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─────────────────────────────────────────
// SeccionHerramientas: grid 2→3 columnas
// ─────────────────────────────────────────

function SeccionHerramientas({ herramientas }: { herramientas: HerramientaRol[] }) {
  if (herramientas.length === 0) return null

  return (
    <motion.section variants={sectionVariants}>
      <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
        Mis herramientas
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {herramientas.map(h => (
          <HerramientaCard key={h.id} herramienta={h} />
        ))}
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────
// TareaItem: checkbox animado + texto con line-through
// ─────────────────────────────────────────

function TareaItem({
  tarea,
  toggling,
  onToggle,
}: {
  tarea: TareaOnboarding
  toggling: boolean
  onToggle: () => void
}) {
  return (
    <motion.div variants={itemVariants} className="flex items-start gap-3 py-2.5">
      <button
        onClick={onToggle}
        disabled={toggling}
        className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
        aria-label={tarea.completada ? 'Marcar como pendiente' : 'Marcar como completada'}
      >
        <motion.div
          animate={tarea.completada ? { scale: [0.8, 1.1, 1] } : { scale: 1 }}
          transition={{ duration: 0.25, type: 'spring' }}
        >
          {tarea.completada
            ? <CheckCircle2 className="w-5 h-5 text-teal-400" />
            : <Circle className="w-5 h-5 text-white/20" />}
        </motion.div>
      </button>
      <span
        className={cn(
          'text-sm leading-snug transition-colors duration-200',
          tarea.completada ? 'text-white/30 line-through' : 'text-white/70',
        )}
      >
        {tarea.titulo}
      </span>
    </motion.div>
  )
}

// ─────────────────────────────────────────
// SemanaTareas: progress bar por semana + lista de tareas
// ─────────────────────────────────────────

function SemanaTareas({
  semana,
  tareas,
  togglingId,
  onToggle,
}: {
  semana: number
  tareas: TareaOnboarding[]
  togglingId: string | null
  onToggle: (tarea: TareaOnboarding) => void
}) {
  const completadas = tareas.filter(t => t.completada).length
  const pct = tareas.length > 0 ? Math.round(completadas / tareas.length * 100) : 0

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Semana {semana}</h3>
        <span className="text-xs text-white/40 font-mono tabular-nums">
          {completadas}/{tareas.length}
        </span>
      </div>
      <div className="mb-4">
        <ProgressBar value={pct} animated />
      </div>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="divide-y divide-white/[0.04]"
      >
        {tareas.map(tarea => (
          <TareaItem
            key={tarea.id}
            tarea={tarea}
            toggling={togglingId === tarea.id}
            onToggle={() => onToggle(tarea)}
          />
        ))}
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────
// SeccionTareas: progress global + semanas agrupadas
// ─────────────────────────────────────────

function SeccionTareas({
  tareas,
  progresoModulo,
  togglingId,
  onToggle,
}: {
  tareas: TareaOnboarding[]
  progresoModulo: number
  togglingId: string | null
  onToggle: (tarea: TareaOnboarding) => void
}) {
  return (
    <motion.section variants={sectionVariants}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest">
          Mis primeras tareas
        </h2>
        <span className="text-xs text-white/40 font-mono tabular-nums">
          {tareas.filter(t => t.completada).length}/{tareas.length}
        </span>
      </div>
      <div className="mb-4">
        <ProgressBar value={progresoModulo} label="Progreso del módulo" showPercentage animated />
      </div>
      <div className="space-y-4">
        {([1, 2, 3, 4] as const).map(s => {
          const semTareas = tareas.filter(t => t.semana === s)
          if (semTareas.length === 0) return null
          return (
            <SemanaTareas
              key={s}
              semana={s}
              tareas={semTareas}
              togglingId={togglingId}
              onToggle={onToggle}
            />
          )
        })}
        {tareas.length === 0 && (
          <div className="glass-card rounded-xl p-5">
            <p className="text-sm text-white/30 italic">
              El administrador aún no cargó tareas para este onboarding.
            </p>
          </div>
        )}
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────
// SeccionObjetivos: timeline vertical 4 semanas (solo lectura)
// ─────────────────────────────────────────

const ESTADO_CONFIG: Record<
  ObjetivoRol['estado'],
  { label: string; variant: 'default' | 'warning' | 'success' }
> = {
  pendiente:   { label: 'Pendiente',   variant: 'default' },
  en_progreso: { label: 'En progreso', variant: 'warning' },
  completado:  { label: 'Completado',  variant: 'success' },
}

function SeccionObjetivos({ objetivos }: { objetivos: ObjetivoRol[] }) {
  if (objetivos.length === 0) return null

  return (
    <motion.section variants={sectionVariants}>
      <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
        Mis objetivos del mes
      </h2>
      <div className="glass-card rounded-xl p-5">
        <div className="relative">
          {/* Línea vertical conectora */}
          <div className="absolute left-4 top-5 bottom-5 w-px bg-white/[0.08]" />
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            {objetivos.map((obj, i) => {
              const { label, variant } = ESTADO_CONFIG[obj.estado]
              return (
                <motion.div key={obj.id} variants={itemVariants} className="flex gap-4">
                  {/* Círculo numerado */}
                  <div className="relative z-10 w-9 h-9 rounded-full bg-[#0F1F3D] flex items-center justify-center border border-white/[0.12] flex-shrink-0">
                    <span className="text-[10px] font-mono font-medium text-white/40 tabular-nums">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                  </div>
                  {/* Contenido */}
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[11px] text-white/30">Semana {obj.semana}</span>
                      <Badge variant={variant}>{label}</Badge>
                    </div>
                    <p className="text-sm font-medium text-white/85">{obj.titulo}</p>
                    {obj.descripcion && (
                      <p className="text-xs text-white/40 mt-1 leading-relaxed">{obj.descripcion}</p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </div>
    </motion.section>
  )
}

// ─────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────

export default function RolPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [puesto, setPuesto] = useState<string>('')
  const [autonomia, setAutonomia] = useState<DecisionAutonomia[]>([])
  const [herramientas, setHerramientas] = useState<HerramientaRol[]>([])
  const [tareas, setTareas] = useState<TareaOnboarding[]>([])
  const [objetivos, setObjetivos] = useState<ObjetivoRol[]>([])
  const [progresoModulo, setProgresoModulo] = useState<number>(0)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // ── Carga inicial de datos ──
  useEffect(() => {
    async function cargarDatos() {
      try {
        const supabase = createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)

        const { data: perfil } = await supabase
          .from('usuarios')
          .select('empresa_id')
          .eq('id', user.id)
          .single()

        if (!perfil) return

        // Cargar todas las entidades en paralelo
        const [conocimientoRes, herramientasRes, tareasRes, objetivosRes] = await Promise.all([
          supabase
            .from('conocimiento')
            .select('*')
            .eq('empresa_id', perfil.empresa_id)
            .eq('modulo', 'rol'),
          supabase
            .from('herramientas_rol')
            .select('*')
            .eq('empresa_id', perfil.empresa_id)
            .order('orden'),
          supabase
            .from('tareas_onboarding')
            .select('*')
            .eq('empresa_id', perfil.empresa_id)
            .eq('usuario_id', user.id)
            .order('semana')
            .order('orden'),
          supabase
            .from('objetivos_rol')
            .select('*')
            .eq('empresa_id', perfil.empresa_id)
            .order('semana'),
        ])

        // Conocimiento: bloque='puesto' → texto, bloque='autonomia' → JSON
        if (conocimientoRes.data) {
          const puestoBloque = conocimientoRes.data.find(c => c.bloque === 'puesto')
          const autonomiaBloque = conocimientoRes.data.find(c => c.bloque === 'autonomia')
          if (puestoBloque) setPuesto(puestoBloque.contenido)
          if (autonomiaBloque) {
            try {
              setAutonomia(JSON.parse(autonomiaBloque.contenido) as DecisionAutonomia[])
            } catch {
              setAutonomia([])
            }
          }
        }

        if (herramientasRes.data) {
          setHerramientas(herramientasRes.data as HerramientaRol[])
        }

        if (tareasRes.data) {
          const tareasData = tareasRes.data as TareaOnboarding[]
          setTareas(tareasData)
          // Calcular progreso inicial desde el estado real de las tareas
          const completadas = tareasData.filter(t => t.completada).length
          setProgresoModulo(
            tareasData.length > 0 ? Math.round(completadas / tareasData.length * 100) : 0
          )
        }

        if (objetivosRes.data) {
          setObjetivos(objetivosRes.data as ObjetivoRol[])
        }
      } catch (err) {
        console.error('Error cargando módulo rol:', err)
        toast.error('Error al cargar el módulo')
      } finally {
        setLoading(false)
      }
    }

    cargarDatos()
  }, [])

  // ── Toggle de tarea: optimistic update + upsert progreso ──
  const handleToggleTarea = async (tarea: TareaOnboarding) => {
    if (togglingId) return
    setTogglingId(tarea.id)

    const nuevaCompletada = !tarea.completada
    const tareasActualizadas = tareas.map(t =>
      t.id === tarea.id
        ? { ...t, completada: nuevaCompletada, completada_at: nuevaCompletada ? new Date().toISOString() : undefined }
        : t
    )

    // Actualización optimista del estado local
    setTareas(tareasActualizadas)
    const completadas = tareasActualizadas.filter(t => t.completada).length
    const porcentaje = tareasActualizadas.length > 0
      ? Math.round(completadas / tareasActualizadas.length * 100)
      : 0
    setProgresoModulo(porcentaje)

    try {
      const supabase = createClient()

      // PATCH de la tarea
      const { error: tareaError } = await supabase
        .from('tareas_onboarding')
        .update({
          completada: nuevaCompletada,
          completada_at: nuevaCompletada ? new Date().toISOString() : null,
        })
        .eq('id', tarea.id)
      if (tareaError) throw tareaError

      // Upsert del progreso del módulo
      const { error: progresoError } = await supabase
        .from('progreso_modulos')
        .upsert(
          {
            usuario_id: userId!,
            modulo: 'rol',
            bloque: 'general',
            completado: porcentaje === 100,
            completado_at: porcentaje === 100 ? new Date().toISOString() : null,
          },
          { onConflict: 'usuario_id,modulo,bloque' },
        )
      if (progresoError) throw progresoError

    } catch (err) {
      console.error('Error actualizando tarea:', err)
      // Rollback: restaurar estado previo al toggle
      setTareas(prev =>
        prev.map(t =>
          t.id === tarea.id
            ? { ...t, completada: tarea.completada, completada_at: tarea.completada_at }
            : t
        )
      )
      const rollbackCompletadas = tareas.filter(t => t.completada).length
      setProgresoModulo(
        tareas.length > 0 ? Math.round(rollbackCompletadas / tareas.length * 100) : 0
      )
      toast.error('Error al actualizar la tarea')
    } finally {
      setTogglingId(null)
    }
  }

  // ── Render: loading ──
  if (loading) {
    return (
      <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8">
        <Toaster position="top-right" />
        <div className="max-w-2xl mx-auto">
          <div className="shimmer rounded-md h-8 w-52 mb-2" />
          <div className="shimmer rounded-md h-4 w-36 mb-8" />
          <SkeletonRol />
        </div>
      </div>
    )
  }

  // ── Render: principal ──
  return (
    <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />

      <div className="max-w-2xl mx-auto">
        {/* Encabezado */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-semibold text-white">Rol y herramientas</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Tu puesto, herramientas y primeras tareas
          </p>
        </motion.div>

        {/* Secciones */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          <SeccionPuesto puesto={puesto} autonomia={autonomia} />
          <SeccionHerramientas herramientas={herramientas} />
          <SeccionTareas
            tareas={tareas}
            progresoModulo={progresoModulo}
            togglingId={togglingId}
            onToggle={handleToggleTarea}
          />
          <SeccionObjetivos objetivos={objetivos} />
        </motion.div>
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript (from project root)**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```

Expected: zero errors. Common issues to fix:
- If `LucideIcon` isn't exported from lucide-react, replace `import type { LucideIcon } from 'lucide-react'` with `type LucideIcon = React.ComponentType<{ className?: string }>`
- If `Badge` variant prop doesn't accept `'default'`, check `src/components/ui/Badge.tsx` and adjust

**Step 3: Commit**

```bash
cd C:/Users/Maxi/onboardai && git add src/app/empleado/rol/page.tsx && git commit -m "feat(empleado): M3 — Rol y herramientas page"
```

---

## Task 3: Final build verification

**Files:** none (verification only)

**Step 1: Run full Next.js build**

```bash
cd C:/Users/Maxi/onboardai && npm run build
```

Expected: build completes with zero TypeScript errors. Warnings about unused variables are acceptable; errors are not.

**Step 2: If build fails**

- TypeScript error on `LucideIcon` type → replace import with local type alias:
  ```ts
  type LucideIcon = React.ComponentType<{ className?: string }>
  ```
- TypeScript error on `Badge` variant → read `src/components/ui/Badge.tsx` to see accepted variants
- TypeScript error on `ProgressBar` props → read `src/components/ui/ProgressBar.tsx`
- Any other error → read the error message carefully, fix the specific line

**Step 3: Commit if any fixes were needed**

```bash
cd C:/Users/Maxi/onboardai && git add -p && git commit -m "fix(rol): resolve build errors"
```

---

## Supabase schema reminder

The page reads from these tables (must exist in Supabase):

```sql
-- Reutilizado de M2, con modulo='rol':
-- conocimiento WHERE empresa_id AND modulo='rol' AND bloque IN ('puesto', 'autonomia')

-- Nuevas tablas (crear si no existen):
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
  icono text,
  guia jsonb,
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

The page handles empty tables gracefully (empty states, null guards) — it won't crash if tables are empty.
