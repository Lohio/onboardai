'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion'
import {
  Briefcase, Wrench, CheckSquare, Target,
  ChevronDown, ExternalLink, Check,
  Clock, Zap, AlertTriangle,
  MessageSquare, FileText, Code, Globe,
  Mail, Calendar, BarChart2,
  ArrowRight, Sparkles, GitBranch,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { useLanguage } from '@/components/LanguageProvider'
import { ErrorState } from '@/components/shared/ErrorState'
import Organigrama from '@/components/empleado/Organigrama'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/utils'
import type {
  TareaOnboarding, HerramientaRol, ObjetivoRol,
  DecisionAutonomia,
} from '@/types'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function modalidadVariant(m: string): 'info' | 'default' | 'success' {
  if (m === 'presencial') return 'info'
  if (m === 'remoto') return 'success'
  return 'default'
}

// ─────────────────────────────────────────────
// Scroll progress bar (sticky top)
// ─────────────────────────────────────────────

function ScrollProgressBar() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 })
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-50 h-[3px] origin-left"
      style={{
        scaleX,
        background: 'linear-gradient(90deg, #f59e0b, #ef4444, #a78bfa)',
        boxShadow: '0 0 12px rgba(245,158,11,0.5)',
      }}
    />
  )
}

// ─────────────────────────────────────────────
// Markdown renderer
// ─────────────────────────────────────────────

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n')

  const renderInline = (raw: string): React.ReactNode => {
    const parts = raw.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} className="text-white/90 font-semibold">{part.slice(2, -2)}</strong>
        : part
    )
  }

  const elements: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []
  let orderedItems: React.ReactNode[] = []
  let listCounter = 0
  let key = 0

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="space-y-2 my-3">
          {listItems}
        </ul>
      )
      listItems = []
    }
    if (orderedItems.length > 0) {
      elements.push(
        <ol key={key++} className="space-y-2 my-3">
          {orderedItems}
        </ol>
      )
      orderedItems = []
      listCounter = 0
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { flushList(); continue }

    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={key++} className="flex items-center gap-2 text-sm font-bold text-amber-300/90 mt-5 mb-2">
          <span className="w-1 h-4 rounded-full bg-amber-400/60 flex-shrink-0" />
          {renderInline(trimmed.slice(4))}
        </h3>
      )
    } else if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={key++} className="text-base font-bold text-white/95 mt-6 mb-3 pb-2 border-b border-white/[0.07]">
          {renderInline(trimmed.slice(3))}
        </h2>
      )
    } else if (trimmed.startsWith('# ')) {
      flushList()
      elements.push(
        <h1 key={key++} className="text-lg font-bold text-white mt-6 mb-3">
          {renderInline(trimmed.slice(2))}
        </h1>
      )
    } else if (/^\d+\.\s/.test(trimmed)) {
      listCounter++
      const content = trimmed.replace(/^\d+\.\s/, '')
      orderedItems.push(
        <li key={key++} className="flex items-start gap-3 text-white/70">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold font-mono flex items-center justify-center mt-0.5">
            {listCounter}
          </span>
          <span className="leading-relaxed">{renderInline(content)}</span>
        </li>
      )
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushList()
      const content = trimmed.slice(2)
      listItems.push(
        <li key={key++} className="flex items-start gap-2.5 text-white/65">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-400/50 flex-shrink-0" />
          <span className="leading-relaxed">{renderInline(content)}</span>
        </li>
      )
    } else {
      flushList()
      elements.push(
        <p key={key++} className="text-white/65 leading-relaxed">
          {renderInline(trimmed)}
        </p>
      )
    }
  }
  flushList()

  return <div className="text-sm space-y-1">{elements}</div>
}

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
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
// Semáforo de autonomía (chips en lugar de dots)
// ─────────────────────────────────────────────

function SemaforoNivel({ nivel, active }: { nivel: 'solo' | 'consultar' | 'escalar'; active: boolean }) {
  const styles: Record<string, { active: string; inactive: string }> = {
    solo:      { active: 'bg-teal-500/20 text-teal-300 border-teal-500/30', inactive: 'bg-white/[0.03] text-white/15 border-white/[0.06]' },
    consultar: { active: 'bg-amber-500/20 text-amber-300 border-amber-500/30', inactive: 'bg-white/[0.03] text-white/15 border-white/[0.06]' },
    escalar:   { active: 'bg-red-500/20 text-red-300 border-red-500/30', inactive: 'bg-white/[0.03] text-white/15 border-white/[0.06]' },
  }
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-5 h-5 rounded-full border transition-all duration-200',
      active ? styles[nivel].active : styles[nivel].inactive,
    )}>
      {active && <span className="w-2 h-2 rounded-full bg-current opacity-80" />}
    </span>
  )
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function SkeletonRol() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-36 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="shimmer w-8 h-8 rounded-xl" />
            <div className="shimmer h-4 w-36 rounded" />
          </div>
          <div className="shimmer h-3 w-full rounded" />
          <div className="shimmer h-3 w-3/4 rounded" />
          <div className="shimmer h-3 w-5/6 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// SectionHeader — label de sección premium
// ─────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
  iconBg,
  iconText,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  iconBg: string
  iconText: string
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', iconBg, iconText)}>
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-bold text-white/90">{title}</h2>
        {subtitle && <p className="text-xs text-white/35 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// HerramientaCard — rediseñada
// ─────────────────────────────────────────────

function HerramientaCard({ herramienta }: { herramienta: HerramientaRol }) {
  const [expandida, setExpandida] = useState(false)
  const guia = herramienta.guia ?? []

  return (
    <motion.div variants={itemVariants}>
      <div
        className={cn(
          'rounded-2xl border overflow-hidden transition-all duration-200',
          expandida
            ? 'border-amber-500/25 bg-amber-600/5'
            : 'border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.04]',
        )}
      >
        {/* Header */}
        <div className="p-4 flex items-start gap-3">
          <div className={cn(
            'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200',
            expandida ? 'bg-amber-500/20 text-amber-400' : 'bg-white/[0.06] text-white/40',
          )}>
            {getIcono(herramienta.icono)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white/85 truncate">{herramienta.nombre}</p>
              {herramienta.url && (
                <a
                  href={herramienta.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex-shrink-0 flex items-center gap-1 text-[10px] text-white/30 hover:text-amber-400 transition-colors px-2 py-1 rounded-lg hover:bg-amber-500/10"
                >
                  <ExternalLink className="w-3 h-3" />
                  Abrir
                </a>
              )}
            </div>
            {herramienta.guia && herramienta.guia[0] && (
              <p className="text-xs text-white/35 mt-1 line-clamp-1">
                {herramienta.guia[0].pasos[0]}
              </p>
            )}
          </div>
        </div>

        {/* Toggle guía */}
        {guia.length > 0 && (
          <button
            onClick={() => setExpandida(v => !v)}
            className="w-full px-4 py-2.5 flex items-center justify-between border-t border-white/[0.05] text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.02] transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              {expandida ? 'Cerrar guía' : 'Ver guía de uso'}
            </span>
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
              <div className="px-4 pb-5 pt-3 space-y-4 border-t border-white/[0.05]">
                {guia.map((seccion, si) => (
                  <div key={si}>
                    <p className="text-[11px] font-semibold text-amber-400/70 uppercase tracking-widest mb-2">
                      {seccion.titulo}
                    </p>
                    <ol className="space-y-2">
                      {seccion.pasos.map((paso, pi) => (
                        <li key={pi} className="flex items-start gap-2.5 text-xs text-white/60">
                          <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full bg-amber-600/20 text-amber-400 flex items-center justify-center text-[9px] font-mono font-bold">
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
// TareaItem — rediseñada con más feedback visual
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
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left group',
          tarea.completada
            ? 'bg-teal-500/5 border border-teal-500/15'
            : 'border border-transparent hover:bg-white/[0.04] hover:border-white/[0.08]',
        )}
      >
        {/* Checkbox */}
        <div className="flex-shrink-0 relative w-5 h-5">
          <AnimatePresence mode="wait">
            {tarea.completada ? (
              <motion.div
                key="checked"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-5 h-5 rounded-md bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.4)] flex items-center justify-center"
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
                className="w-5 h-5 rounded-md border-2 border-white/20 group-hover:border-white/40 transition-colors"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Texto */}
        <motion.span
          animate={{ opacity: tarea.completada ? 0.4 : 0.85 }}
          transition={{ duration: 0.2 }}
          className={cn('text-sm flex-1', tarea.completada && 'line-through')}
        >
          {tarea.titulo}
        </motion.span>

        {tarea.completada && (
          <Badge variant="success" className="flex-shrink-0 text-[10px]">✓</Badge>
        )}
      </button>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// SemanaTareas — rediseñada
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
  const { t } = useLanguage()
  const completadas = tareas.filter(tarea => tarea.completada).length
  const total = tareas.length
  const pct = total > 0 ? Math.round(completadas / total * 100) : 0
  const todoCompleto = completadas === total

  return (
    <motion.div
      variants={sectionVariants}
      className={cn(
        'rounded-2xl border overflow-hidden transition-all duration-300',
        todoCompleto ? 'border-teal-500/20' : 'border-white/[0.07]',
      )}
      style={{ background: todoCompleto ? 'rgba(20,184,166,0.04)' : 'rgba(255,255,255,0.02)' }}
    >
      {/* Header semana */}
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-300',
            todoCompleto ? 'bg-teal-500/20' : 'bg-amber-500/15',
          )}>
            <span className={cn('text-xs font-mono font-bold', todoCompleto ? 'text-teal-400' : 'text-amber-400')}>
              {semana}
            </span>
          </div>
          <div>
            <span className="text-sm font-semibold text-white/85">Semana {semana}</span>
            <span className="text-xs text-white/35 ml-2">{completadas}/{total} tareas</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {todoCompleto && <Badge variant="success">{t('rol.estado.completada')}</Badge>}
          <div className="w-20">
            <ProgressBar value={pct} showPercentage={false} animated />
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 pb-3 border-t border-white/[0.05]">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="pt-2 space-y-1">
          {tareas.map(tarea => (
            <TareaItem key={tarea.id} tarea={tarea} onToggle={onToggle} />
          ))}
        </motion.div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// ObjetivoItem — rediseñado (timeline)
// ─────────────────────────────────────────────

// ESTADO_CONFIG se genera dentro del componente con useMemo para soporte i18n

function ObjetivoItem({ objetivo, isLast, estadoConfig }: { objetivo: ObjetivoRol; isLast: boolean; estadoConfig: Record<string, { label: string; variant: 'default' | 'warning' | 'success'; Icon: React.FC<{ className?: string }>; color: string; bg: string; border: string }> }) {
  const cfg = estadoConfig[objetivo.estado]

  return (
    <motion.div variants={itemVariants} className="flex gap-4">
      {/* Círculo + línea */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn(
          'w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-mono font-bold transition-all duration-300',
          cfg.border, cfg.color, cfg.bg,
        )}>
          {String(objetivo.semana).padStart(2, '0')}
        </div>
        {!isLast && <div className="flex-1 w-px bg-white/[0.07] my-1.5 min-h-[1.5rem]" />}
      </div>

      {/* Contenido */}
      <div className={cn('pb-5 flex-1 min-w-0', isLast && 'pb-0')}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className={cn(
            'text-sm font-medium',
            objetivo.estado === 'completado' ? 'text-white/70' : 'text-white/90',
          )}>
            {objetivo.titulo}
          </p>
          <Badge variant={cfg.variant} className="flex-shrink-0 text-[10px]">
            <cfg.Icon className="w-3 h-3 mr-1" />
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
  const { t } = useLanguage()

  const ESTADO_CONFIG = useMemo(() => ({
    pendiente:   { label: t('rol.estado.pendiente'),   variant: 'default' as const, Icon: Clock, color: 'text-white/30', bg: 'bg-white/[0.04]', border: 'border-white/10' },
    en_progreso: { label: t('rol.estado.en_progreso'), variant: 'warning' as const, Icon: Zap,   color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25' },
    completado:  { label: t('rol.estado.completada'),  variant: 'success' as const, Icon: Check, color: 'text-teal-400',  bg: 'bg-teal-500/10',  border: 'border-teal-500/25'  },
  }), [t])

  const [puesto, setPuesto] = useState<string>('')
  const [autonomia, setAutonomia] = useState<DecisionAutonomia[]>([])
  const [herramientas, setHerramientas] = useState<HerramientaRol[]>([])
  const [tareas, setTareas] = useState<TareaOnboarding[]>([])
  const [objetivos, setObjetivos] = useState<ObjetivoRol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  // Datos por empleado (M3 dinámico)
  const [rolResponsabilidades, setRolResponsabilidades] = useState<string[]>([])
  const [rolKpis, setRolKpis] = useState<string[]>([])
  const [modalidadEmpleado, setModalidadEmpleado] = useState<string>('')
  const [managerNombre, setManagerNombre] = useState<string>('')
  const [responsabilidadesKnowledge, setResponsabilidadesKnowledge] = useState<string[]>([])
  const [metricasKnowledge, setMetricasKnowledge] = useState<string | null>(null)
  const [rolHerramientasEmpleado, setRolHerramientasEmpleado] = useState<Array<{ nombre: string; uso: string }>>([])
  const [rolAutonomiaEmpleado, setRolAutonomiaEmpleado] = useState<string>('')
  const [nombreEmpleado, setNombreEmpleado] = useState<string>('')
  const [puestoEmpleado, setPuestoEmpleado] = useState<string>('')
  const [areaEmpleado, setAreaEmpleado] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [empresaId, setEmpresaId] = useState<string>('')
  const [orgDescripcion, setOrgDescripcion] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'rol' | 'equipo' | 'herramientas' | 'tareas'>('rol')

  const progresoGlobal = tareas.length > 0
    ? Math.round(tareas.filter(t => t.completada).length / tareas.length * 100)
    : 0

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: usuario, error: uErr } = await supabase
        .from('usuarios')
        .select('empresa_id, nombre, puesto, area, modalidad, rol_responsabilidades, rol_kpis, rol_herramientas, rol_autonomia')
        .eq('id', user.id)
        .single()
      if (uErr || !usuario) throw new Error(uErr?.message ?? 'Usuario no encontrado')

      const eid = usuario.empresa_id
      setUserId(user.id)
      setEmpresaId(eid)
      setNombreEmpleado((usuario.nombre as string) ?? '')
      setPuestoEmpleado((usuario.puesto as string | null) ?? '')
      setAreaEmpleado((usuario.area as string | null) ?? '')
      setRolResponsabilidades((usuario.rol_responsabilidades as string[] | null) ?? [])
      setRolKpis((usuario.rol_kpis as string[] | null) ?? [])
      setRolHerramientasEmpleado((usuario.rol_herramientas as Array<{ nombre: string; uso: string }> | null) ?? [])
      setRolAutonomiaEmpleado((usuario.rol_autonomia as string | null) ?? '')
      setModalidadEmpleado((usuario.modalidad as string | null) ?? '')

      const [conocimientoRes, herramientasRes, tareasRes, objetivosRes, orgRes, managerRes] = await Promise.all([
        supabase.from('conocimiento').select('bloque, contenido').eq('empresa_id', eid).eq('modulo', 'rol'),
        supabase.from('herramientas_rol').select('*').eq('empresa_id', eid).order('orden'),
        supabase.from('tareas_onboarding').select('*').eq('empresa_id', eid).eq('usuario_id', user.id).order('semana').order('orden'),
        supabase.from('objetivos_rol').select('*').eq('empresa_id', eid).order('semana'),
        supabase.from('conocimiento').select('contenido').eq('empresa_id', eid).eq('modulo', 'organigrama').eq('bloque', 'descripcion').maybeSingle(),
        supabase.from('equipo_relaciones').select('miembro:usuarios!equipo_relaciones_miembro_id_fkey(nombre)').eq('empleado_id', user.id).eq('relacion', 'manager').maybeSingle(),
      ])

      if (conocimientoRes.error) console.warn('[M3] conocimiento:', conocimientoRes.error.message)
      if (herramientasRes.error) console.warn('[M3] herramientas_rol:', herramientasRes.error.message)
      if (tareasRes.error)       console.warn('[M3] tareas_onboarding:', tareasRes.error.message)
      if (objetivosRes.error)    console.warn('[M3] objetivos_rol:', objetivosRes.error.message)
      if (orgRes.error)          console.warn('[M3] organigrama:', orgRes.error.message)
      setOrgDescripcion((orgRes.data?.contenido as string | null) ?? '')
      const mgr = managerRes.data?.miembro as unknown as { nombre: string } | null
      setManagerNombre(mgr?.nombre ?? '')

      const bloques = conocimientoRes.data ?? []
      const puestoBloque = bloques.find(b => b.bloque === 'puesto')
      const autonomiaBloque = bloques.find(b => b.bloque === 'autonomia')
      const responsabilidadesBloque = bloques.find(b => b.bloque === 'responsabilidades')
      const metricasBloque = bloques.find(b => b.bloque === 'metricas')

      setPuesto(puestoBloque?.contenido ?? '')
      try {
        setAutonomia(autonomiaBloque ? JSON.parse(autonomiaBloque.contenido) : [])
      } catch {
        setAutonomia([])
      }
      try {
        setResponsabilidadesKnowledge(
          responsabilidadesBloque?.contenido ? JSON.parse(responsabilidadesBloque.contenido) : []
        )
      } catch {
        setResponsabilidadesKnowledge([])
      }
      setMetricasKnowledge(metricasBloque?.contenido ?? null)

      setHerramientas(herramientasRes.data ?? [])
      setTareas(tareasRes.data ?? [])
      setObjetivos(objetivosRes.data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const toggleTarea = useCallback(async (id: string, completada: boolean) => {
    if (togglingIds.has(id)) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setTogglingIds(prev => new Set(prev).add(id))
    setTareas(prev => prev.map(t =>
      t.id === id ? { ...t, completada, completada_at: completada ? new Date().toISOString() : undefined } : t,
    ))

    try {
      const { error } = await supabase
        .from('tareas_onboarding')
        .update({ completada, completada_at: completada ? new Date().toISOString() : null })
        .eq('id', id)
        .eq('usuario_id', user.id)

      if (error) throw error

      setTareas(prev => {
        const updated = prev.map(t => t.id === id ? { ...t, completada } : t)
        const pct = updated.length > 0 ? Math.round(updated.filter(t => t.completada).length / updated.length * 100) : 0
        supabase.from('progreso_modulos').upsert({
          usuario_id: user.id, modulo: 'rol', bloque: 'general',
          completado: pct === 100, completado_at: pct === 100 ? new Date().toISOString() : null,
        }, { onConflict: 'usuario_id,modulo,bloque' }).then(() => {})
        return updated
      })
    } catch {
      setTareas(prev => prev.map(t => t.id === id ? { ...t, completada: !completada } : t))
      toast.error('No se pudo actualizar la tarea')
    } finally {
      setTogglingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }, [togglingIds])

  // ── Loading / Error ──
  if (loading) return (
    <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto"><SkeletonRol /></div>
    </div>
  )
  if (error) return (
    <div className="min-h-dvh gradient-bg flex items-center justify-center p-6">
      <ErrorState mensaje={error} onRetry={cargarDatos} />
    </div>
  )

  const semanas = [1, 2, 3, 4].filter(s => tareas.some(t => t.semana === s))

  return (
    <>
      <ScrollProgressBar />
      <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8 pt-6">
        <div className="max-w-3xl mx-auto">
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">

            {/* ── Page header M2 ── */}
            <div
              className="rounded-2xl mb-6 p-5 flex items-center justify-between gap-6"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.05) 100%)',
                border: '1px solid rgba(245,158,11,0.22)',
              }}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/20 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-5 h-5" style={{ color: '#FCD34D' }} />
                </div>
                <div>
                  <p className="tag-m2 mb-1" style={{ color: '#FCD34D' }}>MÓDULO 2</p>
                  <h1 className="text-xl font-bold text-white">Mi rol y herramientas</h1>
                  <p className="text-sm text-white/45 mt-0.5">Conocé tu puesto, las herramientas y tus objetivos del mes</p>
                </div>
              </div>
              {/* Círculo de progreso */}
              <div className="flex-shrink-0 relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                  <motion.circle
                    cx="32" cy="32" r="26" fill="none"
                    stroke="#F59E0B"
                    strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - progresoGlobal / 100) }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-bold text-white">{progresoGlobal}%</span>
                </div>
              </div>
            </div>

            {/* ══ Tab bar ══ */}
            <motion.div variants={sectionVariants}>
              <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                {([
                  { key: 'rol' as const,          label: 'Mi rol',        icon: <Briefcase className="w-3.5 h-3.5" /> },
                  { key: 'equipo' as const,        label: 'Mi equipo',     icon: <GitBranch className="w-3.5 h-3.5" /> },
                  { key: 'herramientas' as const,  label: 'Herramientas',  icon: <Wrench className="w-3.5 h-3.5" /> },
                  { key: 'tareas' as const,        label: 'Tareas',        icon: <CheckSquare className="w-3.5 h-3.5" /> },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium transition-all rounded-lg',
                      activeTab !== tab.key && 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]',
                    )}
                    style={activeTab === tab.key ? { background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.22)' } : undefined}
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* ══ Contenido por tab ══ */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="space-y-4 pb-8"
              >

                {/* ── Tab: Mi rol ── */}
                {activeTab === 'rol' && (
                  <>
                    {/* Descripción del rol — 2 columnas */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Columna izquierda: datos del puesto */}
                      <div className="glass-card rounded-2xl p-5 border border-white/[0.06]">
                        <SectionHeader
                          icon={<Briefcase className="w-4 h-4" />}
                          title="Descripción de mi rol"
                          iconBg="bg-amber-500/15"
                          iconText="text-amber-400"
                        />

                        {!puesto && (
                          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 mb-4">
                            <p className="text-xs text-amber-300/80">
                              Tu admin aún no completó la descripción del rol.
                            </p>
                          </div>
                        )}

                        <div className="space-y-3 mt-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-white/40 w-20">Puesto</span>
                            <span className="text-sm text-white font-medium">{puestoEmpleado || '—'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-white/40 w-20">Área</span>
                            <span className="text-sm text-white font-medium">{areaEmpleado || '—'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-white/40 w-20">Reporta a</span>
                            <span className="text-sm text-white font-medium">{managerNombre || '—'}</span>
                          </div>
                          {modalidadEmpleado && (
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-white/40 w-20">Modalidad</span>
                              <Badge variant={modalidadVariant(modalidadEmpleado)}>{modalidadEmpleado}</Badge>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Columna derecha: responsabilidades + métricas */}
                      <div className="space-y-4">
                        {/* Responsabilidades */}
                        <div className="glass-card rounded-2xl p-5 border border-white/[0.06]">
                          <h3 className="text-[11px] font-medium text-amber-400/60 uppercase tracking-widest mb-3">
                            Responsabilidades
                          </h3>
                          {(() => {
                            const items = responsabilidadesKnowledge.length > 0 ? responsabilidadesKnowledge : rolResponsabilidades
                            return items.length > 0 ? (
                              <div className="space-y-2.5">
                                {items.map((r, i) => (
                                  <div key={i} className="flex items-start gap-3">
                                    <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                      {i + 1}
                                    </span>
                                    <span className="text-sm text-white/70">{r}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-white/25 italic">Próximamente configuradas por tu admin</p>
                            )
                          })()}
                        </div>

                        {/* Métricas de éxito */}
                        <div className="glass-card rounded-2xl p-5 border border-white/[0.06]">
                          <h3 className="text-[11px] font-medium text-blue-400/60 uppercase tracking-widest mb-3">
                            Métricas de éxito
                          </h3>
                          {metricasKnowledge ? (
                            <p className="text-sm text-white/70">{metricasKnowledge}</p>
                          ) : rolKpis.length > 0 ? (
                            <div className="space-y-2.5">
                              {rolKpis.map((k, i) => (
                                <div key={i} className="flex items-start gap-3">
                                  <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                    {i + 1}
                                  </span>
                                  <span className="text-sm text-white/70">{k}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-white/25 italic">Próximamente configuradas por tu manager</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mi puesto (conocimiento empresa) */}
                    <section>
                      <SectionHeader
                        icon={<Briefcase className="w-4 h-4" />}
                        title={t('rol.puesto.title')}
                        subtitle={t('rol.puesto.subtitle')}
                        iconBg="bg-amber-500/15"
                        iconText="text-amber-400"
                      />
                      <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="p-5">
                          {puesto ? (
                            <MarkdownContent text={puesto} />
                          ) : (
                            <div className="py-6 text-center">
                              <Briefcase className="w-8 h-8 text-white/10 mx-auto mb-2" />
                              <p className="text-sm text-white/30 italic">
                                Tu empresa aún no ha cargado la descripción del puesto.
                              </p>
                            </div>
                          )}
                        </div>
                        {autonomia.length > 0 && (
                          <div className="border-t border-white/[0.06]">
                            <div className="px-5 py-3">
                              <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">
                                Tabla de autonomía
                              </span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-white/[0.05]">
                                    <th className="text-left px-5 py-3 text-xs font-semibold text-white/35 uppercase tracking-wide">Decisión</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-teal-400/60 uppercase tracking-wide">Solo ✓</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-amber-400/60 uppercase tracking-wide">Consultar</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-red-400/60 uppercase tracking-wide">Escalar ▲</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {autonomia.map((dec, i) => (
                                    <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                                      <td className="px-5 py-3 text-sm text-white/70">{dec.decision}</td>
                                      <td className="text-center px-4 py-3"><div className="flex justify-center"><SemaforoNivel nivel="solo" active={dec.nivel === 'solo'} /></div></td>
                                      <td className="text-center px-4 py-3"><div className="flex justify-center"><SemaforoNivel nivel="consultar" active={dec.nivel === 'consultar'} /></div></td>
                                      <td className="text-center px-4 py-3"><div className="flex justify-center"><SemaforoNivel nivel="escalar" active={dec.nivel === 'escalar'} /></div></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {autonomia.length === 0 && puesto && (
                          <div className="border-t border-white/[0.05] px-5 py-3">
                            <p className="text-xs text-white/25 italic">Tabla de autonomía no configurada aún.</p>
                          </div>
                        )}
                      </div>
                    </section>
                  </>
                )}

                {/* ── Tab: Mi equipo ── */}
                {activeTab === 'equipo' && userId && empresaId && (
                  <section>
                    <SectionHeader
                      icon={<GitBranch className="w-4 h-4" />}
                      title={t('rol.organigrama')}
                      subtitle={t('rol.organigrama.subtitle')}
                      iconBg="bg-sky-500/15"
                      iconText="text-sky-400"
                    />
                    {orgDescripcion && (
                      <p className="text-sm text-white/50 mb-4">{orgDescripcion}</p>
                    )}
                    <Organigrama
                      usuarioId={userId}
                      empresaId={empresaId}
                      descripcion={orgDescripcion}
                    />
                  </section>
                )}

                {/* ── Tab: Herramientas ── */}
                {activeTab === 'herramientas' && (
                  <section>
                    <SectionHeader
                      icon={<Wrench className="w-4 h-4" />}
                      title={t('rol.herramientas.title')}
                      subtitle={t('rol.herramientas.subtitle')}
                      iconBg="bg-sky-500/15"
                      iconText="text-sky-400"
                    />
                    {herramientas.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {herramientas.map(h => <HerramientaCard key={h.id} herramienta={h} />)}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/[0.06] p-8 text-center"
                        style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <Wrench className="w-8 h-8 text-white/10 mx-auto mb-2" />
                        <p className="text-sm text-white/30">Tu empresa aún no ha configurado las herramientas del rol.</p>
                      </div>
                    )}
                  </section>
                )}

                {/* ── Tab: Tareas ── */}
                {activeTab === 'tareas' && (
                  <>
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <SectionHeader
                          icon={<CheckSquare className="w-4 h-4" />}
                          title={t('rol.tareas.title')}
                          subtitle={tareas.length > 0 ? t('rol.tareas.completadas').replace('{done}', String(tareas.filter(tarea => tarea.completada).length)).replace('{total}', String(tareas.length)) : undefined}
                          iconBg="bg-teal-500/15"
                          iconText="text-teal-400"
                        />
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
                        <div className="rounded-2xl border border-white/[0.06] p-8 text-center"
                          style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <CheckSquare className="w-8 h-8 text-white/10 mx-auto mb-2" />
                          <p className="text-sm text-white/30">Tu empresa aún no ha asignado tareas para tu onboarding.</p>
                        </div>
                      )}
                    </section>

                    <section>
                      <SectionHeader
                        icon={<Target className="w-4 h-4" />}
                        title={t('rol.objetivos.title')}
                        subtitle={t('rol.objetivos.subtitle')}
                        iconBg="bg-rose-500/15"
                        iconText="text-rose-400"
                      />
                      {objetivos.length > 0 ? (
                        <div className="rounded-2xl border border-white/[0.07] p-5"
                          style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <motion.div variants={containerVariants} initial="hidden" animate="show">
                            {objetivos.map((obj, i) => (
                              <ObjetivoItem key={obj.id} objetivo={obj} isLast={i === objetivos.length - 1} estadoConfig={ESTADO_CONFIG} />
                            ))}
                          </motion.div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-white/[0.06] p-8 text-center"
                          style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <Target className="w-8 h-8 text-white/10 mx-auto mb-2" />
                          <p className="text-sm text-white/30">Tu empresa aún no ha definido los objetivos del mes.</p>
                        </div>
                      )}
                    </section>

                    {/* CTA al chat */}
                    <div className="flex items-center gap-3 p-4 rounded-2xl border border-[#0EA5E9]/15"
                      style={{ background: 'rgba(99,102,241,0.06)' }}>
                      <div className="w-9 h-9 rounded-xl bg-[#0EA5E9]/12 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-4 h-4 text-[#38BDF8]" />
                      </div>
                      <p className="text-xs text-white/50 flex-1">
                        ¿Tenés dudas sobre tu rol? Preguntale al asistente de onboarding.
                      </p>
                      <a href="/empleado/asistente"
                        className="flex items-center gap-1.5 text-xs font-medium text-[#38BDF8] hover:text-[#7DD3FC] transition-colors flex-shrink-0">
                        Ir al chat <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </>
                )}

              </motion.div>
            </AnimatePresence>

          </motion.div>
        </div>
      </div>
    </>
  )
}
