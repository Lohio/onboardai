'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, Wrench, CheckSquare, Target,
  ChevronDown, ExternalLink, Check,
  Clock, Zap, AlertTriangle,
  MessageSquare, FileText, Code, Globe,
  Mail, Calendar, BarChart2,
  ArrowRight, Sparkles, GitBranch, Scale,
} from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { useLanguage } from '@/components/LanguageProvider'
import { ErrorState } from '@/components/shared/ErrorState'
import Organigrama from '@/components/empleado/Organigrama'
import OrgChart from '@/components/shared/OrgChart'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/utils'
import { construirArbol, generarNodosDesdeUsuarios } from '@/lib/organigrama'
import type {
  TareaOnboarding, HerramientaRol, ObjetivoRol,
  DecisionAutonomia, OrgNodo,
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
// Markdown renderer
// ─────────────────────────────────────────────

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n')

  const renderInline = (raw: string): React.ReactNode => {
    const parts = raw.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} className="text-gray-900 font-semibold">{part.slice(2, -2)}</strong>
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
        <h3 key={key++} className="flex items-center gap-2 text-sm font-bold text-amber-600 mt-5 mb-2">
          <span className="w-1 h-4 rounded-full bg-amber-400 flex-shrink-0" />
          {renderInline(trimmed.slice(4))}
        </h3>
      )
    } else if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={key++} className="text-base font-bold text-gray-900 mt-6 mb-3 pb-2 border-b border-gray-200">
          {renderInline(trimmed.slice(3))}
        </h2>
      )
    } else if (trimmed.startsWith('# ')) {
      flushList()
      elements.push(
        <h1 key={key++} className="text-lg font-bold text-gray-900 mt-6 mb-3">
          {renderInline(trimmed.slice(2))}
        </h1>
      )
    } else if (/^\d+\.\s/.test(trimmed)) {
      listCounter++
      const content = trimmed.replace(/^\d+\.\s/, '')
      orderedItems.push(
        <li key={key++} className="flex items-start gap-3 text-gray-600">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold font-mono flex items-center justify-center mt-0.5">
            {listCounter}
          </span>
          <span className="leading-relaxed">{renderInline(content)}</span>
        </li>
      )
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushList()
      const content = trimmed.slice(2)
      listItems.push(
        <li key={key++} className="flex items-start gap-2.5 text-gray-500">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
          <span className="leading-relaxed">{renderInline(content)}</span>
        </li>
      )
    } else {
      flushList()
      elements.push(
        <p key={key++} className="text-gray-500 leading-relaxed">
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
// Semáforo de autonomía
// ─────────────────────────────────────────────

function SemaforoNivel({ nivel, active }: { nivel: 'solo' | 'consultar' | 'escalar'; active: boolean }) {
  const styles: Record<string, { active: string; inactive: string }> = {
    solo:      { active: 'bg-teal-100 text-teal-600 border-teal-300', inactive: 'bg-gray-50 text-gray-300 border-gray-200' },
    consultar: { active: 'bg-amber-100 text-amber-600 border-amber-300', inactive: 'bg-gray-50 text-gray-300 border-gray-200' },
    escalar:   { active: 'bg-red-100 text-red-600 border-red-300', inactive: 'bg-gray-50 text-gray-300 border-gray-200' },
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
      <div className="h-36 rounded-xl bg-white border border-gray-200 shadow-sm" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-3">
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
// SectionHeader — label de sección
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
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// HerramientaCard
// ─────────────────────────────────────────────

function HerramientaCard({ herramienta }: { herramienta: HerramientaRol }) {
  const [expandida, setExpandida] = useState(false)
  const guia = herramienta.guia ?? []

  return (
    <motion.div variants={itemVariants}>
      <div
        className={cn(
          'rounded-xl border overflow-hidden transition-all duration-200',
          expandida
            ? 'border-amber-300 bg-amber-50/50 shadow-sm'
            : 'border-gray-200 bg-white hover:shadow-md hover:border-gray-300',
        )}
      >
        {/* Header */}
        <div className="p-4 flex items-start gap-3">
          <div className={cn(
            'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200',
            expandida ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500',
          )}>
            {getIcono(herramienta.icono)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate">{herramienta.nombre}</p>
              {herramienta.url && (
                <a
                  href={herramienta.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex-shrink-0 flex items-center gap-1 text-[10px] text-gray-400 hover:text-amber-600 transition-colors px-2 py-1 rounded-lg hover:bg-amber-50"
                >
                  <ExternalLink className="w-3 h-3" />
                  Abrir
                </a>
              )}
            </div>
            {herramienta.guia && herramienta.guia[0] && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                {herramienta.guia[0].pasos[0]}
              </p>
            )}
          </div>
        </div>

        {/* Toggle guía */}
        {guia.length > 0 && (
          <button
            onClick={() => setExpandida(v => !v)}
            className="w-full px-4 py-2.5 flex items-center justify-between border-t border-gray-200 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
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
              <div className="px-4 pb-5 pt-3 space-y-4 border-t border-gray-200">
                {guia.map((seccion, si) => (
                  <div key={si}>
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-2">
                      {seccion.titulo}
                    </p>
                    <ol className="space-y-2">
                      {seccion.pasos.map((paso, pi) => (
                        <li key={pi} className="flex items-start gap-2.5 text-xs text-gray-600">
                          <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[9px] font-mono font-bold">
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
// TareaItem
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
          'w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 text-left group',
          tarea.completada
            ? 'bg-teal-50 border border-teal-200'
            : 'border border-transparent hover:bg-gray-50 hover:border-gray-200',
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
                className="w-5 h-5 rounded-md bg-teal-500 shadow-sm flex items-center justify-center"
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
                className="w-5 h-5 rounded-md border-2 border-gray-300 group-hover:border-gray-400 transition-colors"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Texto */}
        <motion.span
          animate={{ opacity: tarea.completada ? 0.5 : 1 }}
          transition={{ duration: 0.2 }}
          className={cn('text-sm flex-1 text-gray-900', tarea.completada && 'line-through text-gray-400')}
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
// SemanaTareas
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
        'rounded-xl border overflow-hidden transition-all duration-300 bg-white shadow-sm',
        todoCompleto ? 'border-teal-200' : 'border-gray-200',
      )}
    >
      {/* Header semana */}
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-300',
            todoCompleto ? 'bg-teal-100' : 'bg-amber-100',
          )}>
            <span className={cn('text-xs font-mono font-bold', todoCompleto ? 'text-teal-600' : 'text-amber-600')}>
              {semana}
            </span>
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-900">Semana {semana}</span>
            <span className="text-xs text-gray-500 ml-2">{completadas}/{total} tareas</span>
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
      <div className="px-4 pb-3 border-t border-gray-200">
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
// ObjetivoItem — timeline
// ─────────────────────────────────────────────

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
        {!isLast && <div className="flex-1 w-px bg-gray-200 my-1.5 min-h-[1.5rem]" />}
      </div>

      {/* Contenido */}
      <div className={cn('pb-5 flex-1 min-w-0', isLast && 'pb-0')}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className={cn(
            'text-sm font-medium',
            objetivo.estado === 'completado' ? 'text-gray-400' : 'text-gray-900',
          )}>
            {objetivo.titulo}
          </p>
          <Badge variant={cfg.variant} className="flex-shrink-0 text-[10px]">
            <cfg.Icon className="w-3 h-3 mr-1" />
            {cfg.label}
          </Badge>
        </div>
        {objetivo.descripcion && (
          <p className="text-xs text-gray-500 leading-relaxed">{objetivo.descripcion}</p>
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
    pendiente:   { label: t('rol.estado.pendiente'),   variant: 'default' as const, Icon: Clock, color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200' },
    en_progreso: { label: t('rol.estado.en_progreso'), variant: 'warning' as const, Icon: Zap,   color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300' },
    completado:  { label: t('rol.estado.completada'),  variant: 'success' as const, Icon: Check, color: 'text-teal-600',  bg: 'bg-teal-50',  border: 'border-teal-300'  },
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
  const [orgArbol, setOrgArbol] = useState<OrgNodo[]>([])
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

      const [conocimientoRes, herramientasRes, tareasRes, objetivosRes, orgRes, managerRes, orgNodosRes] = await Promise.all([
        supabase.from('conocimiento').select('bloque, contenido').eq('empresa_id', eid).eq('modulo', 'rol'),
        supabase.from('herramientas_rol').select('*').eq('empresa_id', eid).order('orden'),
        supabase.from('tareas_onboarding').select('*').eq('empresa_id', eid).eq('usuario_id', user.id).order('semana').order('orden'),
        supabase.from('objetivos_rol').select('*').eq('empresa_id', eid).order('semana'),
        supabase.from('conocimiento').select('contenido').eq('empresa_id', eid).eq('modulo', 'organigrama').eq('bloque', 'descripcion').maybeSingle(),
        supabase.from('equipo_relaciones').select('miembro:usuarios!equipo_relaciones_miembro_id_fkey(nombre)').eq('empleado_id', user.id).eq('relacion', 'manager').maybeSingle(),
        supabase.from('organigrama_nodos').select('*').eq('empresa_id', eid).eq('visible', true).order('orden'),
      ])

      if (conocimientoRes.error) console.warn('[M3] conocimiento:', conocimientoRes.error.message)
      if (herramientasRes.error) console.warn('[M3] herramientas_rol:', herramientasRes.error.message)
      if (tareasRes.error)       console.warn('[M3] tareas_onboarding:', tareasRes.error.message)
      if (objetivosRes.error)    console.warn('[M3] objetivos_rol:', objetivosRes.error.message)
      if (orgRes.error)          console.warn('[M3] organigrama:', orgRes.error.message)
      setOrgDescripcion((orgRes.data?.contenido as string | null) ?? '')
      const mgr = managerRes.data?.miembro as unknown as { nombre: string } | null
      setManagerNombre(mgr?.nombre ?? '')

      // Organigrama: si hay nodos personalizados usarlos, sino generar desde usuarios
      const nodosOrg = (orgNodosRes.data ?? []) as OrgNodo[]
      if (nodosOrg.length > 0) {
        setOrgArbol(construirArbol(nodosOrg))
      } else {
        const { data: usuariosOrg } = await supabase
          .from('usuarios')
          .select('id, nombre, puesto, area, foto_url, manager_id')
          .eq('empresa_id', eid)
        if (usuariosOrg?.length) {
          setOrgArbol(construirArbol(generarNodosDesdeUsuarios(usuariosOrg, eid)))
        }
      }

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
    <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto"><SkeletonRol /></div>
    </div>
  )
  if (error) return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-6">
      <ErrorState mensaje={error} onRetry={cargarDatos} />
    </div>
  )

  const semanas = [1, 2, 3, 4].filter(s => tareas.some(t => t.semana === s))

  return (
    <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* ── Page header M2 ── */}
        <div className="mb-3">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-1">Módulo 2</p>
          <h1 className="text-xl font-bold text-gray-900 leading-tight flex items-center gap-2">
            <Image src="/heero-icons4.svg" alt="" width={45} height={45} />
            Rol
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Conocé tu puesto, las herramientas y tus objetivos del mes
          </p>
        </div>

        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4">

          {/* ── Mi progreso en Rol ── */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">
                Mi progreso en Rol
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {tareas.filter(t => t.completada).length} / {tareas.length} tareas
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
                <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="28" cy="28" r="22" fill="none"
                    stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                  <motion.circle
                    cx="28" cy="28" r="22" fill="none"
                    stroke="url(#rolProgressGrad)" strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={138.2}
                    initial={{ strokeDashoffset: 138.2 }}
                    animate={{ strokeDashoffset: 138.2 - (138.2 * progresoGlobal / 100) }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                  />
                  <defs>
                    <linearGradient id="rolProgressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3B4FD8" />
                      <stop offset="100%" stopColor="#0D9488" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-gray-900 leading-none">{progresoGlobal}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Progreso del módulo</p>
                <p className="text-xs text-gray-500">Completá las tareas para avanzar</p>
              </div>
            </div>
          </div>

          {/* ══ Tab bar ══ */}
          <motion.div variants={sectionVariants}>
            <div className="flex gap-1 p-1 rounded-xl bg-gray-100 border border-gray-200">
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
                    activeTab === tab.key
                      ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
                  )}
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
                    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
                      <SectionHeader
                        icon={<Briefcase className="w-4 h-4" />}
                        title="Descripción de mi rol"
                        iconBg="bg-amber-100"
                        iconText="text-amber-600"
                      />

                      {!puesto && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 mb-4">
                          <p className="text-xs text-amber-700 flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            Tu admin aún no completó la descripción del rol.
                          </p>
                        </div>
                      )}

                      <div className="space-y-3 mt-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-20">Puesto</span>
                          <span className="text-sm text-gray-900 font-medium">{puestoEmpleado || '—'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-20">Área</span>
                          <span className="text-sm text-gray-900 font-medium">{areaEmpleado || '—'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-20">Reporta a</span>
                          <span className="text-sm text-gray-900 font-medium">{managerNombre || '—'}</span>
                        </div>
                        {modalidadEmpleado && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-20">Modalidad</span>
                            <Badge variant={modalidadVariant(modalidadEmpleado)}>{modalidadEmpleado}</Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Columna derecha: responsabilidades + métricas */}
                    <div className="space-y-4">
                      {/* Responsabilidades */}
                      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
                        <h3 className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-3">
                          Responsabilidades
                        </h3>
                        {(() => {
                          const items = responsabilidadesKnowledge.length > 0 ? responsabilidadesKnowledge : rolResponsabilidades
                          return items.length > 0 ? (
                            <div className="space-y-2.5">
                              {items.map((r, i) => (
                                <div key={i} className="flex items-start gap-3">
                                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                    {i + 1}
                                  </span>
                                  <span className="text-sm text-gray-600">{r}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">Próximamente configuradas por tu admin</p>
                          )
                        })()}
                      </div>

                      {/* Métricas de éxito */}
                      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
                        <h3 className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-3">
                          Métricas de éxito
                        </h3>
                        {metricasKnowledge ? (
                          <p className="text-sm text-gray-600">{metricasKnowledge}</p>
                        ) : rolKpis.length > 0 ? (
                          <div className="space-y-2.5">
                            {rolKpis.map((k, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                  {i + 1}
                                </span>
                                <span className="text-sm text-gray-600">{k}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">Próximamente configuradas por tu manager</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Autonomía de decisiones */}
                  {autonomia.length > 0 && (
                    <section>
                      <SectionHeader
                        icon={<Scale className="w-4 h-4" />}
                        title="Autonomía de decisiones"
                        subtitle="Qué podés decidir solo, qué consultar y qué escalar"
                        iconBg="bg-teal-100"
                        iconText="text-teal-600"
                      />
                      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Decisión</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-teal-600 uppercase tracking-wide">Solo ✓</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-amber-600 uppercase tracking-wide">Consultar</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-red-600 uppercase tracking-wide">Escalar ▲</th>
                              </tr>
                            </thead>
                            <tbody>
                              {autonomia.map((dec, i) => (
                                <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                                  <td className="px-5 py-3 text-sm text-gray-700">{dec.decision}</td>
                                  <td className="text-center px-4 py-3"><div className="flex justify-center"><SemaforoNivel nivel="solo" active={dec.nivel === 'solo'} /></div></td>
                                  <td className="text-center px-4 py-3"><div className="flex justify-center"><SemaforoNivel nivel="consultar" active={dec.nivel === 'consultar'} /></div></td>
                                  <td className="text-center px-4 py-3"><div className="flex justify-center"><SemaforoNivel nivel="escalar" active={dec.nivel === 'escalar'} /></div></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </section>
                  )}
                </>
              )}

              {/* ── Tab: Mi equipo ── */}
              {activeTab === 'equipo' && userId && empresaId && (
                <section>
                  <SectionHeader
                    icon={<GitBranch className="w-4 h-4" />}
                    title={t('rol.organigrama')}
                    subtitle={t('rol.organigrama.subtitle')}
                    iconBg="bg-sky-100"
                    iconText="text-sky-600"
                  />
                  {orgDescripcion && (
                    <p className="text-sm text-gray-500 mb-4">{orgDescripcion}</p>
                  )}
                  {orgArbol.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm p-2">
                      <OrgChart
                        raices={orgArbol}
                        usuarioActualId={userId}
                        modo="lectura"
                      />
                    </div>
                  ) : (
                    <Organigrama
                      usuarioId={userId}
                      empresaId={empresaId}
                      descripcion={orgDescripcion}
                    />
                  )}
                </section>
              )}

              {/* ── Tab: Herramientas ── */}
              {activeTab === 'herramientas' && (
                <section>
                  <SectionHeader
                    icon={<Wrench className="w-4 h-4" />}
                    title={t('rol.herramientas.title')}
                    subtitle={t('rol.herramientas.subtitle')}
                    iconBg="bg-sky-100"
                    iconText="text-sky-600"
                  />
                  {herramientas.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {herramientas.map(h => <HerramientaCard key={h.id} herramienta={h} />)}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-8 text-center">
                      <Wrench className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Tu empresa aún no ha configurado las herramientas del rol.</p>
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
                        iconBg="bg-teal-100"
                        iconText="text-teal-600"
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
                      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-8 text-center">
                        <CheckSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Tu empresa aún no ha asignado tareas para tu onboarding.</p>
                      </div>
                    )}
                  </section>

                  <section>
                    <SectionHeader
                      icon={<Target className="w-4 h-4" />}
                      title={t('rol.objetivos.title')}
                      subtitle={t('rol.objetivos.subtitle')}
                      iconBg="bg-rose-100"
                      iconText="text-rose-600"
                    />
                    {objetivos.length > 0 ? (
                      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
                        <motion.div variants={containerVariants} initial="hidden" animate="show">
                          {objetivos.map((obj, i) => (
                            <ObjetivoItem key={obj.id} objetivo={obj} isLast={i === objetivos.length - 1} estadoConfig={ESTADO_CONFIG} />
                          ))}
                        </motion.div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-8 text-center">
                        <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Tu empresa aún no ha definido los objetivos del mes.</p>
                      </div>
                    )}
                  </section>

                  {/* CTA al chat */}
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-sky-200 bg-sky-50">
                    <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-sky-600" />
                    </div>
                    <p className="text-xs text-gray-500 flex-1">
                      ¿Tenés dudas sobre tu rol? Preguntale al asistente de onboarding.
                    </p>
                    <a href="/empleado/asistente"
                      className="flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700 transition-colors flex-shrink-0">
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
  )
}
