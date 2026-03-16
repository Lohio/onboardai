'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, Wrench, CheckSquare, Target,
  ChevronDown, ExternalLink, Check,
  Clock, Zap,
  MessageSquare, FileText, Code, Globe,
  Mail, Calendar, BarChart2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { ErrorState } from '@/components/shared/ErrorState'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/utils'
import type {
  TareaOnboarding, HerramientaRol, ObjetivoRol,
  DecisionAutonomia,
} from '@/types'

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1, x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 26 },
  },
}

// ─────────────────────────────────────────────
// Helpers — ícono de herramienta
// ─────────────────────────────────────────────

const ICONO_MAP: Record<string, React.ReactNode> = {
  MessageSquare: <MessageSquare className="w-5 h-5" />,
  FileText:      <FileText      className="w-5 h-5" />,
  Code:          <Code          className="w-5 h-5" />,
  Globe:         <Globe         className="w-5 h-5" />,
  Mail:          <Mail          className="w-5 h-5" />,
  Calendar:      <Calendar      className="w-5 h-5" />,
  BarChart2:     <BarChart2     className="w-5 h-5" />,
  Briefcase:     <Briefcase     className="w-5 h-5" />,
  Wrench:        <Wrench        className="w-5 h-5" />,
}

function getIcono(nombre?: string): React.ReactNode {
  if (!nombre) return <Wrench className="w-5 h-5" />
  return ICONO_MAP[nombre] ?? <Wrench className="w-5 h-5" />
}

// ─────────────────────────────────────────────
// Helpers — semáforo de autonomía
// ─────────────────────────────────────────────

function SemaforoNivel({ nivel, active }: { nivel: 'solo' | 'consultar' | 'escalar'; active: boolean }) {
  const styles: Record<string, string> = {
    solo:      active ? 'bg-teal-500 ring-2 ring-teal-400/40' : 'bg-white/10',
    consultar: active ? 'bg-amber-500 ring-2 ring-amber-400/40' : 'bg-white/10',
    escalar:   active ? 'bg-red-500 ring-2 ring-red-400/40' : 'bg-white/10',
  }
  return <span className={cn('inline-block w-3 h-3 rounded-full', styles[nivel])} />
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function SkeletonRol() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6 space-y-3">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="h-3 w-full rounded bg-white/[0.06]" />
          <div className="h-3 w-3/4 rounded bg-white/[0.06]" />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Componente: HerramientaCard
// ─────────────────────────────────────────────

function HerramientaCard({ herramienta }: { herramienta: HerramientaRol }) {
  const [expandida, setExpandida] = useState(false)
  const guia = herramienta.guia ?? []
  const primerSeccion = guia[0]

  return (
    <motion.div variants={itemVariants}>
      <div
        className={cn(
          'rounded-xl border bg-white/[0.03] overflow-hidden',
          'transition-colors duration-200',
          expandida ? 'border-indigo-500/30' : 'border-white/[0.07] hover:border-white/[0.12]',
        )}
      >
        {/* Header */}
        <div className="p-4 flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-600/15 text-indigo-400 flex items-center justify-center">
            {getIcono(herramienta.icono)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-white/90 truncate">{herramienta.nombre}</p>
              {herramienta.url && (
                <a
                  href={herramienta.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex-shrink-0 text-white/30 hover:text-indigo-400 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            {/* Preview: primeros 3 pasos de la primera sección */}
            {primerSeccion && (
              <ul className="mt-1.5 space-y-0.5">
                {primerSeccion.pasos.slice(0, 3).map((paso, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-white/45">
                    <span className="flex-shrink-0 mt-0.5 w-1 h-1 rounded-full bg-white/30" />
                    <span className="line-clamp-1">{paso}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Toggle guía */}
        {guia.length > 0 && (
          <button
            onClick={() => setExpandida(v => !v)}
            className="w-full px-4 py-2 flex items-center justify-between border-t border-white/[0.05] text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.02] transition-colors"
          >
            <span>{expandida ? 'Cerrar guía' : 'Ver guía completa'}</span>
            <motion.div animate={{ rotate: expandida ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
              <ChevronDown className="w-3.5 h-3.5" />
            </motion.div>
          </button>
        )}

        {/* Guía expandida */}
        <AnimatePresence>
          {expandida && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05]">
                {guia.map((seccion, si) => (
                  <div key={si} className="pt-3">
                    <p className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-2">
                      {seccion.titulo}
                    </p>
                    <ol className="space-y-1.5">
                      {seccion.pasos.map((paso, pi) => (
                        <li key={pi} className="flex items-start gap-2 text-xs text-white/60">
                          <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-[10px] font-mono font-bold">
                            {pi + 1}
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
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Componente: TareaItem
// ─────────────────────────────────────────────

function TareaItem({
  tarea,
  onToggle,
}: {
  tarea: TareaOnboarding
  onToggle: (id: string, completada: boolean) => void
}) {
  return (
    <motion.div variants={itemVariants} layout>
      <button
        onClick={() => onToggle(tarea.id, !tarea.completada)}
        className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors text-left group"
      >
        {/* Checkbox animado */}
        <div className="flex-shrink-0 mt-0.5 relative w-5 h-5">
          <AnimatePresence mode="wait">
            {tarea.completada ? (
              <motion.div
                key="checked"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-5 h-5 rounded-md bg-teal-600 flex items-center justify-center"
              >
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </motion.div>
            ) : (
              <motion.div
                key="unchecked"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-5 h-5 rounded-md border border-white/20 group-hover:border-white/40 transition-colors"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Texto con tachado animado */}
        <motion.span
          animate={{ opacity: tarea.completada ? 0.45 : 0.85 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'text-sm transition-all duration-300',
            tarea.completada && 'line-through',
          )}
        >
          {tarea.titulo}
        </motion.span>
      </button>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Componente: SemanaTareas
// ─────────────────────────────────────────────

function SemanaTareas({
  semana,
  tareas,
  onToggle,
}: {
  semana: number
  tareas: TareaOnboarding[]
  onToggle: (id: string, completada: boolean) => void
}) {
  const completadas = tareas.filter(t => t.completada).length
  const total = tareas.length
  const pct = total > 0 ? Math.round(completadas / total * 100) : 0

  return (
    <motion.div variants={sectionVariants} className="rounded-xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">
      {/* Header semana */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/15 flex items-center justify-center">
            <span className="text-xs font-mono font-bold text-indigo-400">{semana}</span>
          </div>
          <span className="text-sm font-semibold text-white/80">Semana {semana}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40 font-mono">{completadas}/{total}</span>
          <div className="w-24">
            <ProgressBar value={pct} showPercentage={false} animated />
          </div>
        </div>
      </div>

      {/* Lista de tareas */}
      <div className="px-3 py-2">
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          {tareas.map(tarea => (
            <TareaItem key={tarea.id} tarea={tarea} onToggle={onToggle} />
          ))}
        </motion.div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Componente: ObjetivoItem (timeline)
// ─────────────────────────────────────────────

const ESTADO_CONFIG = {
  pendiente:   { label: 'Pendiente',   variant: 'default' as const, Icon: Clock },
  en_progreso: { label: 'En progreso', variant: 'warning' as const, Icon: Zap  },
  completado:  { label: 'Completado',  variant: 'success' as const, Icon: Check },
}

function ObjetivoItem({ objetivo, isLast }: { objetivo: ObjetivoRol; isLast: boolean }) {
  const cfg = ESTADO_CONFIG[objetivo.estado]

  return (
    <motion.div variants={itemVariants} className="flex gap-4">
      {/* Círculo numerado + línea conectora */}
      <div className="flex flex-col items-center">
        <div className={cn(
          'flex-shrink-0 w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-mono font-bold transition-all duration-300',
          objetivo.estado === 'completado'  ? 'border-teal-500/60 text-teal-400 bg-teal-600/10' :
          objetivo.estado === 'en_progreso' ? 'border-amber-500/60 text-amber-400 bg-amber-600/10' :
          'border-white/15 text-white/35 bg-white/[0.03]',
        )}>
          {String(objetivo.semana).padStart(2, '0')}
        </div>
        {!isLast && <div className="flex-1 w-px bg-white/[0.07] my-1 min-h-[1rem]" />}
      </div>

      {/* Contenido */}
      <div className={cn('pb-6 flex-1 min-w-0', isLast && 'pb-0')}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className={cn(
            'text-sm font-medium',
            objetivo.estado === 'completado' ? 'text-white/75' : 'text-white/90',
          )}>
            {objetivo.titulo}
          </p>
          <Badge variant={cfg.variant}>
            <cfg.Icon className="w-3 h-3" />
            {cfg.label}
          </Badge>
        </div>
        {objetivo.descripcion && (
          <p className="text-xs text-white/40 leading-relaxed">{objetivo.descripcion}</p>
        )}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function RolPage() {
  const [puesto, setPuesto] = useState<string>('')
  const [autonomia, setAutonomia] = useState<DecisionAutonomia[]>([])
  const [herramientas, setHerramientas] = useState<HerramientaRol[]>([])
  const [tareas, setTareas] = useState<TareaOnboarding[]>([])
  const [objetivos, setObjetivos] = useState<ObjetivoRol[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  const progresoGlobal = tareas.length > 0
    ? Math.round(tareas.filter(t => t.completada).length / tareas.length * 100)
    : 0

  // ── Carga de datos ──────────────────────────
  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: usuario, error: uErr } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()
      if (uErr || !usuario) throw new Error(uErr?.message ?? 'Usuario no encontrado')

      const eid = usuario.empresa_id

      // Cada query es independiente — si una tabla aún no existe, las demás igual cargan
      const [conocimientoRes, herramientasRes, tareasRes, objetivosRes] = await Promise.all([
        supabase
          .from('conocimiento')
          .select('bloque, contenido')
          .eq('empresa_id', eid)
          .eq('modulo', 'rol'),

        supabase
          .from('herramientas_rol')
          .select('*')
          .eq('empresa_id', eid)
          .order('orden'),

        supabase
          .from('tareas_onboarding')
          .select('*')
          .eq('empresa_id', eid)
          .eq('usuario_id', user.id)
          .order('semana')
          .order('orden'),

        supabase
          .from('objetivos_rol')
          .select('*')
          .eq('empresa_id', eid)
          .order('semana'),
      ])

      // Loguear errores individuales sin bloquear toda la vista
      if (conocimientoRes.error) console.warn('[M3] conocimiento:', conocimientoRes.error.message)
      if (herramientasRes.error) console.warn('[M3] herramientas_rol:', herramientasRes.error.message)
      if (tareasRes.error) console.warn('[M3] tareas_onboarding:', tareasRes.error.message)
      if (objetivosRes.error) console.warn('[M3] objetivos_rol:', objetivosRes.error.message)

      // Si la query crítica (usuarios) falló, lanzar error
      // Las demás muestran empty state en lugar de bloquear la página

      const bloques = conocimientoRes.data ?? []
      const puestoBloque = bloques.find(b => b.bloque === 'puesto')
      const autonomiaBloque = bloques.find(b => b.bloque === 'autonomia')

      setPuesto(puestoBloque?.contenido ?? '')
      try {
        setAutonomia(autonomiaBloque ? JSON.parse(autonomiaBloque.contenido) : [])
      } catch {
        setAutonomia([])
      }

      setHerramientas(herramientasRes.data ?? [])
      setTareas(tareasRes.data ?? [])
      setObjetivos(objetivosRes.data ?? [])

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar datos'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Toggle tarea ────────────────────────────
  const toggleTarea = useCallback(async (id: string, completada: boolean) => {
    if (togglingIds.has(id)) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Optimistic update
    setTogglingIds(prev => new Set(prev).add(id))
    setTareas(prev => prev.map(t =>
      t.id === id
        ? { ...t, completada, completada_at: completada ? new Date().toISOString() : undefined }
        : t,
    ))

    try {
      const { error } = await supabase
        .from('tareas_onboarding')
        .update({
          completada,
          completada_at: completada ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .eq('usuario_id', user.id)

      if (error) throw error

      // Recalcular progreso y upsert en progreso_modulos
      setTareas(prev => {
        const updated = prev.map(t => t.id === id ? { ...t, completada } : t)
        const completadas = updated.filter(t => t.completada).length
        const total = updated.length
        const pct = total > 0 ? Math.round(completadas / total * 100) : 0

        supabase.from('progreso_modulos').upsert({
          usuario_id: user.id,
          modulo: 'rol',
          bloque: 'general',
          completado: pct === 100,
          completado_at: pct === 100 ? new Date().toISOString() : null,
        }, { onConflict: 'usuario_id,modulo,bloque' }).then(() => {})

        return updated
      })

    } catch {
      // Rollback
      setTareas(prev => prev.map(t =>
        t.id === id ? { ...t, completada: !completada } : t,
      ))
      toast.error('No se pudo actualizar la tarea')
    } finally {
      setTogglingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }, [togglingIds])

  // ── Render ──────────────────────────────────

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-0 py-6">
      <SkeletonRol />
    </div>
  )

  if (error) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-0 py-6">
      <ErrorState mensaje={error} onRetry={cargarDatos} />
    </div>
  )

  const semanas = [1, 2, 3, 4].filter(s => tareas.some(t => t.semana === s))

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-0 py-6">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >

        {/* ── Header con progreso global ── */}
        <motion.div variants={sectionVariants}>
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h1 className="text-xl font-bold text-white/90">Mi rol y herramientas</h1>
              <p className="text-sm text-white/45 mt-0.5">
                Conocé tu puesto, las herramientas y tus objetivos del mes
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-xs text-white/40 mb-1">Progreso del módulo</p>
              <span className="text-2xl font-mono font-bold text-white/80">{progresoGlobal}%</span>
            </div>
          </div>
          <ProgressBar value={progresoGlobal} showPercentage={false} animated className="mt-3" />
        </motion.div>

        {/* ══ SECCIÓN 1: Mi puesto ══ */}
        <motion.section variants={sectionVariants}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/15 text-indigo-400 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-white/80">Mi puesto</h2>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">
            {/* Descripción del puesto */}
            <div className="p-5 border-b border-white/[0.05]">
              {puesto ? (
                <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{puesto}</p>
              ) : (
                <p className="text-sm text-white/30 italic">
                  Tu empresa aún no ha cargado la descripción del puesto.
                </p>
              )}
            </div>

            {/* Tabla de autonomía */}
            {autonomia.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.05]">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide">
                        Decisión
                      </th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-teal-400/70 uppercase tracking-wide">
                        Solo
                      </th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-amber-400/70 uppercase tracking-wide">
                        Consultar
                      </th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-red-400/70 uppercase tracking-wide">
                        Escalar
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {autonomia.map((dec, i) => (
                      <tr
                        key={i}
                        className={cn(
                          'border-b border-white/[0.04] last:border-0',
                          'hover:bg-white/[0.02] transition-colors',
                        )}
                      >
                        <td className="px-5 py-3 text-sm text-white/70">{dec.decision}</td>
                        <td className="text-center px-3 py-3">
                          <div className="flex justify-center">
                            <SemaforoNivel nivel="solo" active={dec.nivel === 'solo'} />
                          </div>
                        </td>
                        <td className="text-center px-3 py-3">
                          <div className="flex justify-center">
                            <SemaforoNivel nivel="consultar" active={dec.nivel === 'consultar'} />
                          </div>
                        </td>
                        <td className="text-center px-3 py-3">
                          <div className="flex justify-center">
                            <SemaforoNivel nivel="escalar" active={dec.nivel === 'escalar'} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-4">
                <p className="text-sm text-white/30 italic">Tabla de autonomía no configurada aún.</p>
              </div>
            )}
          </div>
        </motion.section>

        {/* ══ SECCIÓN 2: Mis herramientas ══ */}
        <motion.section variants={sectionVariants}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-teal-600/15 text-teal-400 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-white/80">Mis herramientas</h2>
          </div>

          {herramientas.length > 0 ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {herramientas.map(h => (
                <HerramientaCard key={h.id} herramienta={h} />
              ))}
            </motion.div>
          ) : (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6 text-center">
              <Wrench className="w-8 h-8 text-white/15 mx-auto mb-2" />
              <p className="text-sm text-white/35">
                Tu empresa aún no ha configurado las herramientas del rol.
              </p>
            </div>
          )}
        </motion.section>

        {/* ══ SECCIÓN 3: Mis primeras tareas ══ */}
        <motion.section variants={sectionVariants}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-white/80">Mis primeras tareas</h2>
          </div>

          {semanas.length > 0 ? (
            <div className="space-y-3">
              {semanas.map(s => (
                <SemanaTareas
                  key={s}
                  semana={s}
                  tareas={tareas.filter(t => t.semana === s)}
                  onToggle={toggleTarea}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6 text-center">
              <CheckSquare className="w-8 h-8 text-white/15 mx-auto mb-2" />
              <p className="text-sm text-white/35">
                Tu empresa aún no ha asignado tareas para tu onboarding.
              </p>
            </div>
          )}
        </motion.section>

        {/* ══ SECCIÓN 4: Mis objetivos del mes ══ */}
        <motion.section variants={sectionVariants} className="pb-6">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-white/80">Mis objetivos del mes</h2>
          </div>

          {objetivos.length > 0 ? (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-5">
              <motion.div variants={containerVariants} initial="hidden" animate="show">
                {objetivos.map((obj, i) => (
                  <ObjetivoItem
                    key={obj.id}
                    objetivo={obj}
                    isLast={i === objetivos.length - 1}
                  />
                ))}
              </motion.div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6 text-center">
              <Target className="w-8 h-8 text-white/15 mx-auto mb-2" />
              <p className="text-sm text-white/35">
                Tu empresa aún no ha definido los objetivos del mes.
              </p>
            </div>
          )}
        </motion.section>

      </motion.div>
    </div>
  )
}
