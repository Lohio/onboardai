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
        fecha: p.completado_at as string,
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
                  <div className="flex-shrink-0 mt-0.5 relative z-10 bg-[var(--surface-900,#0f1f3d)]">
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
