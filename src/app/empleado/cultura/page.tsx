'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion'
import Link from 'next/link'
import {
  Lock, CheckCircle2, BookOpen, Target, Users,
  ClipboardList, Trophy, ChevronDown, ArrowRight,
  Sparkles, Star,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { ErrorState } from '@/components/shared/ErrorState'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { ContenidoBloque, ProgresoModulo } from '@/types'

// ─────────────────────────────────────────────
// Renderer simple de Markdown
// Soporta: ##, ###, **, -, listas, párrafos
// ─────────────────────────────────────────────

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n')

  const renderInline = (raw: string): React.ReactNode => {
    const parts = raw.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} className="text-white/85 font-semibold">{part.slice(2, -2)}</strong>
        : part
    )
  }

  const elements: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []
  let key = 0

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="space-y-1.5 my-3">
          {listItems}
        </ul>
      )
      listItems = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList()
      continue
    }
    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={key++} className="text-sm font-bold text-white/90 mt-4 mb-1.5">
          {renderInline(trimmed.slice(4))}
        </h3>
      )
    } else if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={key++} className="text-base font-bold text-white/95 mt-5 mb-2">
          {renderInline(trimmed.slice(3))}
        </h2>
      )
    } else if (trimmed.startsWith('# ')) {
      flushList()
      elements.push(
        <h1 key={key++} className="text-base font-bold text-white mt-5 mb-2">
          {renderInline(trimmed.slice(2))}
        </h1>
      )
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(
        <li key={key++} className="flex items-start gap-2 text-white/65">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-50 flex-shrink-0" />
          <span>{renderInline(trimmed.slice(2))}</span>
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


type BloqueKey = 'historia' | 'mision' | 'como_trabajamos' | 'expectativas' | 'hitos'

interface Pregunta {
  pregunta: string
  opciones: string[]
  correcta: number
}

// ─────────────────────────────────────────────
// Configuración de bloques
// ─────────────────────────────────────────────

const BLOQUES_ORDEN: BloqueKey[] = [
  'historia',
  'mision',
  'como_trabajamos',
  'expectativas',
  'hitos',
]

const BLOQUES_CONFIG: Record<BloqueKey, {
  label: string
  icon: React.ReactNode
  gradient: string
  iconBg: string
  iconText: string
  accent: string
}> = {
  historia: {
    label: 'Nuestra historia',
    icon: <BookOpen className="w-5 h-5" />,
    gradient: 'from-indigo-600/20 via-indigo-600/5 to-transparent',
    iconBg: 'bg-indigo-600/20',
    iconText: 'text-indigo-400',
    accent: 'border-indigo-500/30',
  },
  mision: {
    label: 'Misión, visión y valores',
    icon: <Target className="w-5 h-5" />,
    gradient: 'from-teal-600/20 via-teal-600/5 to-transparent',
    iconBg: 'bg-teal-600/20',
    iconText: 'text-teal-400',
    accent: 'border-teal-500/30',
  },
  como_trabajamos: {
    label: 'Cómo trabajamos',
    icon: <Users className="w-5 h-5" />,
    gradient: 'from-sky-600/20 via-sky-600/5 to-transparent',
    iconBg: 'bg-sky-600/20',
    iconText: 'text-sky-400',
    accent: 'border-sky-500/30',
  },
  expectativas: {
    label: 'Qué se espera de mí',
    icon: <ClipboardList className="w-5 h-5" />,
    gradient: 'from-amber-600/20 via-amber-600/5 to-transparent',
    iconBg: 'bg-amber-600/20',
    iconText: 'text-amber-400',
    accent: 'border-amber-500/30',
  },
  hitos: {
    label: 'Nuestros hitos',
    icon: <Trophy className="w-5 h-5" />,
    gradient: 'from-rose-600/20 via-rose-600/5 to-transparent',
    iconBg: 'bg-rose-600/20',
    iconText: 'text-rose-400',
    accent: 'border-rose-500/30',
  },
}

// ─────────────────────────────────────────────
// Preguntas
// ─────────────────────────────────────────────

const PREGUNTAS: Record<BloqueKey, Pregunta[]> = {
  historia: [
    {
      pregunta: '¿Qué suelen reflejar los orígenes de una empresa?',
      opciones: [
        'Sus valores fundacionales y propósito inicial',
        'El número exacto de empleados en su fundación',
        'Los productos que ya no vende',
        'Solo datos financieros históricos',
      ],
      correcta: 0,
    },
    {
      pregunta: '¿Por qué es valioso conocer la historia de tu empresa?',
      opciones: [
        'Para memorizar fechas exactas en entrevistas',
        'Para entender el ADN y la cultura que moldea el presente',
        'No es realmente relevante para el trabajo diario',
        'Solo es útil en reuniones con clientes',
      ],
      correcta: 1,
    },
  ],
  mision: [
    {
      pregunta: '¿Cuál es la diferencia entre misión y visión?',
      opciones: [
        'Son sinónimos, significan lo mismo',
        'La misión describe el propósito presente; la visión, la aspiración futura',
        'La misión describe el futuro y la visión el pasado',
        'La visión describe lo que hacemos hoy',
      ],
      correcta: 1,
    },
    {
      pregunta: '¿Para qué sirven los valores en una empresa?',
      opciones: [
        'Solo para el sitio web y materiales de marketing',
        'Para decorar las paredes de la oficina',
        'Para guiar decisiones y definir comportamientos esperados',
        'Son aspiracionales, no tienen impacto real',
      ],
      correcta: 2,
    },
  ],
  como_trabajamos: [
    {
      pregunta: '¿Qué define principalmente la cultura de trabajo de un equipo?',
      opciones: [
        'Los horarios de entrada y salida',
        'Las normas, valores y comportamientos compartidos en el día a día',
        'Solo los procesos documentados en un manual',
        'El software y las herramientas que usan',
      ],
      correcta: 1,
    },
    {
      pregunta: '¿Cuál es el beneficio de tener acuerdos de trabajo claros?',
      opciones: [
        'Reducen la necesidad de comunicarse',
        'Solo son útiles para empleados nuevos',
        'Alinean expectativas y reducen fricciones innecesarias',
        'Aumentan la burocracia del equipo',
      ],
      correcta: 2,
    },
  ],
  expectativas: [
    {
      pregunta: '¿Por qué es útil conocer las expectativas de tu rol desde el día 1?',
      opciones: [
        'Para saber exactamente qué no hacer',
        'Porque así podés alinear tu esfuerzo con lo que realmente importa',
        'No es tan importante en los primeros meses',
        'Solo para los roles de liderazgo',
      ],
      correcta: 1,
    },
    {
      pregunta: '¿Qué facilita tener objetivos claros en un nuevo trabajo?',
      opciones: [
        'Trabajar más horas que los demás',
        'Evitar reuniones de seguimiento',
        'Priorizar bien y medir tu propio progreso',
        'Delegar más tareas a otros',
      ],
      correcta: 2,
    },
  ],
  hitos: [
    {
      pregunta: '¿Qué representan los hitos en la historia de una empresa?',
      opciones: [
        'Solo los problemas que se tuvieron que superar',
        'Momentos clave que marcaron el crecimiento y la evolución',
        'Únicamente cambios de nombre o logo',
        'Solo los logros financieros anuales',
      ],
      correcta: 1,
    },
    {
      pregunta: '¿Por qué es importante celebrar logros colectivos?',
      opciones: [
        'Para justificar gastos de fin de año',
        'No tiene impacto real en el equipo',
        'Refuerza el sentido de pertenencia y reconoce el esfuerzo compartido',
        'Solo sirve para comunicados externos',
      ],
      correcta: 2,
    },
  ],
}

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const blockVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

const quizVariants = {
  hidden: { opacity: 0, height: 0 },
  show: {
    opacity: 1,
    height: 'auto',
    transition: { type: 'spring' as const, stiffness: 300, damping: 28 },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.2 },
  },
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function SkeletonCultura() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="shimmer rounded-xl w-11 h-11 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="shimmer rounded-md h-4 w-40" />
              <div className="shimmer rounded-full h-1.5 w-full" />
            </div>
            <div className="shimmer rounded-full h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Barra de progreso de lectura (por bloque)
// ─────────────────────────────────────────────

function ReadBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-0.5 w-full rounded-full bg-white/[0.06] overflow-hidden mt-2">
      <motion.div
        className={cn('h-full rounded-full', color)}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          boxShadow: value > 0 ? `0 0 8px ${color.includes('indigo') ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.4)'}` : 'none',
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// Stepper lateral
// ─────────────────────────────────────────────

function StepperSidebar({
  progreso,
  bloqueActivo,
  onClickBloque,
}: {
  progreso: Partial<Record<BloqueKey, ProgresoModulo>>
  bloqueActivo: BloqueKey | null
  onClickBloque: (key: BloqueKey) => void
}) {
  const completados = BLOQUES_ORDEN.filter(b => progreso[b]?.completado).length

  return (
    <div className="hidden lg:flex flex-col gap-1 sticky top-8 self-start w-48 flex-shrink-0">
      {/* Mini progreso */}
      <div className="mb-4 px-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-white/30 uppercase tracking-widest font-medium">Progreso</span>
          <span className="text-xs font-mono text-white/50">{completados}/{BLOQUES_ORDEN.length}</span>
        </div>
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-teal-400"
            animate={{ width: `${(completados / BLOQUES_ORDEN.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {BLOQUES_ORDEN.map((key, idx) => {
        const cfg = BLOQUES_CONFIG[key]
        const completado = progreso[key]?.completado === true
        const activo = bloqueActivo === key
        const desbloqueado = idx === 0 || progreso[BLOQUES_ORDEN[idx - 1]]?.completado === true

        return (
          <button
            key={key}
            onClick={() => desbloqueado && onClickBloque(key)}
            disabled={!desbloqueado}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200',
              activo && desbloqueado
                ? 'bg-white/[0.07] border border-white/[0.1]'
                : 'hover:bg-white/[0.04]',
              !desbloqueado && 'opacity-35 cursor-not-allowed',
            )}
          >
            {/* Indicador */}
            <div className={cn(
              'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300',
              completado
                ? 'bg-teal-500/20 text-teal-400'
                : activo
                ? cn(cfg.iconBg, cfg.iconText)
                : 'bg-white/[0.05] text-white/20',
            )}>
              {completado ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <span className="text-[10px] font-mono font-bold">{idx + 1}</span>
              )}
            </div>

            {/* Label */}
            <span className={cn(
              'text-xs font-medium leading-tight',
              completado ? 'text-teal-300/70 line-through' : activo ? 'text-white/90' : 'text-white/40',
            )}>
              {cfg.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// Quiz de comprensión — rediseñado
// ─────────────────────────────────────────────

interface QuizProps {
  bloqueKey: BloqueKey
  respuestas: (number | null)[]
  onRespuesta: (qIdx: number, opIdx: number) => void
  onComplete: () => void
  completando: boolean
  onReset: () => void
}

function BloqueQuiz({ bloqueKey, respuestas, onRespuesta, onComplete, completando, onReset }: QuizProps) {
  const preguntas = PREGUNTAS[bloqueKey]
  const todasRespondidas = respuestas.every(r => r !== null)
  const todasCorrectas = preguntas.every((p, i) => respuestas[i] === p.correcta)
  const cfg = BLOQUES_CONFIG[bloqueKey]

  return (
    <div className="mt-6 space-y-5">
      {/* Divider con label */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/[0.07]" />
        <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium', cfg.iconBg, cfg.iconText)}>
          <Sparkles className="w-3 h-3" />
          Verificá tu comprensión
        </div>
        <div className="flex-1 h-px bg-white/[0.07]" />
      </div>

      {preguntas.map((p, qIdx) => {
        const respuesta = respuestas[qIdx]
        const respondida = respuesta !== null
        const esCorrecta = respondida && respuesta === p.correcta

        return (
          <div key={qIdx} className="space-y-3">
            <p className="text-sm text-white/80 font-medium leading-snug">
              <span className={cn('inline-block w-5 h-5 rounded-full text-center text-[11px] font-bold mr-2 leading-5', cfg.iconBg, cfg.iconText)}>
                {qIdx + 1}
              </span>
              {p.pregunta}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {p.opciones.map((op, opIdx) => {
                const seleccionada = respuesta === opIdx
                const esLaCorrecta = opIdx === p.correcta

                let style = 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15] text-white/70'
                if (respondida && seleccionada && esCorrecta)
                  style = 'bg-teal-600/15 border-teal-500/40 text-teal-200'
                else if (respondida && seleccionada && !esCorrecta)
                  style = 'bg-red-500/10 border-red-500/30 text-red-300'
                else if (respondida && esLaCorrecta)
                  style = 'bg-teal-600/10 border-teal-500/20 text-teal-300/80'
                else if (respondida)
                  style = 'bg-white/[0.02] border-white/[0.05] text-white/30'

                return (
                  <button
                    key={opIdx}
                    onClick={() => !respondida && onRespuesta(qIdx, opIdx)}
                    disabled={respondida}
                    className={cn(
                      'w-full text-left text-sm px-4 py-3 rounded-xl border transition-all duration-150',
                      'disabled:cursor-default',
                      style,
                    )}
                  >
                    <span className="inline-block w-4 h-4 rounded-full border border-current opacity-60 mr-2.5 align-middle text-[10px] text-center leading-[14px] flex-shrink-0 inline-flex items-center justify-center">
                      {String.fromCharCode(65 + opIdx)}
                    </span>
                    {op}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Acciones */}
      <AnimatePresence mode="wait">
        {todasRespondidas && todasCorrectas && (
          <motion.div
            key="completar"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <button
              onClick={onComplete}
              disabled={completando}
              className={cn(
                'w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200',
                'bg-gradient-to-r from-teal-600 to-teal-500 text-white',
                'hover:from-teal-500 hover:to-teal-400',
                'shadow-[0_0_24px_rgba(13,148,136,0.35)] hover:shadow-[0_0_32px_rgba(13,148,136,0.5)]',
                'disabled:opacity-60 disabled:cursor-wait',
              )}
            >
              {completando ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                  Guardando progreso...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  ¡Completé este bloque!
                </span>
              )}
            </button>
          </motion.div>
        )}

        {todasRespondidas && !todasCorrectas && (
          <motion.div
            key="reintentar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
          >
            <p className="text-xs text-amber-300/80">Hay respuestas incorrectas. Revisá el contenido.</p>
            <button
              onClick={onReset}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors ml-3 flex-shrink-0"
            >
              Reintentar →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────
// BloqueCard — rediseñado
// ─────────────────────────────────────────────

interface BloqueCardProps {
  bloqueKey: BloqueKey
  numero: number
  contenido: ContenidoBloque | null
  unlocked: boolean
  completado: boolean
  readProgress: number
  respuestas: (number | null)[]
  completando: boolean
  onRespuesta: (qIdx: number, opIdx: number) => void
  onComplete: () => void
  contentRef: (el: HTMLDivElement | null) => void
  onReset: () => void
  isActive: boolean
}

function BloqueCard({
  bloqueKey,
  numero,
  contenido,
  unlocked,
  completado,
  readProgress,
  respuestas,
  completando,
  onRespuesta,
  onComplete,
  contentRef,
  onReset,
  isActive,
}: BloqueCardProps) {
  const cfg = BLOQUES_CONFIG[bloqueKey]
  const [expandido, setExpandido] = useState(true)
  const showQuiz = readProgress >= 80 && !completado && contenido !== null
  const locked = !unlocked

  return (
    <motion.div
      variants={blockVariants}
      id={`bloque-${bloqueKey}`}
      className="relative"
    >
      <div
        className={cn(
          'relative rounded-2xl overflow-hidden border transition-all duration-300',
          completado
            ? 'border-teal-500/20 bg-surface-900/60'
            : isActive
            ? cn('border-white/[0.1] bg-surface-900/80', cfg.accent)
            : 'border-white/[0.06] bg-surface-900/50',
          locked && 'opacity-60',
        )}
      >
        {/* Gradiente decorativo en la esquina superior izquierda */}
        {!locked && (
          <div
            className={cn(
              'absolute inset-0 pointer-events-none',
              `bg-gradient-to-br ${cfg.gradient}`,
            )}
          />
        )}

        {/* ── Header ── */}
        <div
          className={cn(
            'relative flex items-start gap-3 p-5',
            completado && 'cursor-pointer',
          )}
          onClick={() => completado && setExpandido(v => !v)}
        >
          {/* Número + ícono */}
          <div className="flex-shrink-0 relative">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300',
                completado
                  ? 'bg-teal-500/15 text-teal-400 shadow-[0_0_16px_rgba(20,184,166,0.2)]'
                  : isActive
                  ? cn(cfg.iconBg, cfg.iconText)
                  : 'bg-white/[0.05] text-white/25',
              )}
            >
              {completado ? <CheckCircle2 className="w-5 h-5" /> : cfg.icon}
            </div>
            {/* Número badge */}
            <div className={cn(
              'absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full flex items-center justify-center',
              'text-[9px] font-bold font-mono',
              completado
                ? 'bg-teal-500 text-white'
                : isActive
                ? 'bg-indigo-600 text-white'
                : 'bg-white/10 text-white/30',
            )}>
              {numero}
            </div>
          </div>

          {/* Título y progreso */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className={cn(
              'text-sm font-semibold leading-tight',
              completado ? 'text-white/60' : 'text-white/90',
            )}>
              {cfg.label}
            </h3>

            {/* Barra de lectura */}
            {unlocked && !completado && (
              <ReadBar
                value={readProgress}
                color={cfg.iconText.replace('text-', 'bg-')}
              />
            )}

            {completado && (
              <p className="text-xs text-teal-400/70 mt-1">Completado ✓</p>
            )}
          </div>

          {/* Badge / estado */}
          <div className="flex-shrink-0 flex items-center gap-1.5 pt-0.5">
            {!completado && unlocked && readProgress > 0 && (
              <Badge variant="info">{Math.round(readProgress)}%</Badge>
            )}
            {completado ? (
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-white/25 transition-transform duration-200',
                  !expandido && 'rotate-180',
                )}
              />
            ) : locked ? (
              <Lock className="w-4 h-4 text-white/20" />
            ) : null}
          </div>
        </div>

        {/* ── Contenido ── */}
        <AnimatePresence initial={false}>
          {unlocked && (!completado || expandido) && (
            <motion.div
              initial={completado ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div
                ref={contentRef}
                className="relative px-5 pb-5"
              >
                {/* Texto del bloque */}
                {contenido ? (
                  <MarkdownContent text={contenido.contenido} />
                ) : (
                  <div className="py-4 text-center space-y-1">
                    <p className="text-sm text-white/30 italic">
                      Contenido no disponible. El administrador aún no cargó este bloque.
                    </p>
                    <p className="text-xs text-white/20">
                      Este bloque no puede completarse hasta que el contenido esté disponible.
                    </p>
                  </div>
                )}

                {/* Quiz */}
                <AnimatePresence>
                  {showQuiz && (
                    <motion.div
                      variants={quizVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      className="overflow-hidden"
                    >
                      <BloqueQuiz
                        bloqueKey={bloqueKey}
                        respuestas={respuestas}
                        onRespuesta={onRespuesta}
                        onComplete={onComplete}
                        completando={completando}
                        onReset={onReset}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Overlay bloqueado ── */}
        <AnimatePresence>
          {locked && (
            <motion.div
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              className="absolute inset-0 backdrop-blur-[1px] rounded-2xl flex flex-col items-center justify-center gap-2"
              style={{ background: 'rgba(7,15,30,0.6)' }}
            >
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                <Lock className="w-4 h-4 text-white/25" />
              </div>
              <p className="text-xs text-white/30 text-center px-6">
                Completá el bloque anterior para desbloquear
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Barra de scroll global (sticky top)
// ─────────────────────────────────────────────

function ScrollProgressBar() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-50 h-[3px] origin-left"
      style={{
        scaleX,
        background: 'linear-gradient(90deg, #6366f1, #3b82f6, #14b8a6)',
        boxShadow: '0 0 12px rgba(99,102,241,0.6)',
      }}
    />
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function CulturaPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [contenidos, setContenidos] = useState<Partial<Record<BloqueKey, ContenidoBloque>>>({})
  const [progreso, setProgreso] = useState<Partial<Record<BloqueKey, ProgresoModulo>>>({})
  const [readProgress, setReadProgress] = useState<Record<BloqueKey, number>>({
    historia: 0, mision: 0, como_trabajamos: 0, expectativas: 0, hitos: 0,
  })
  const [respuestas, setRespuestas] = useState<Record<BloqueKey, (number | null)[]>>({
    historia: [null, null],
    mision: [null, null],
    como_trabajamos: [null, null],
    expectativas: [null, null],
    hitos: [null, null],
  })
  const [completando, setCompletando] = useState<BloqueKey | null>(null)
  const [hasError, setHasError] = useState(false)
  const [bloqueActivo, setBloqueActivo] = useState<BloqueKey | null>(null)

  const contentRefsObj = useRef<Partial<Record<BloqueKey, HTMLDivElement | null>>>({})
  const contentRefCallbacks = useRef<Partial<Record<BloqueKey, (el: HTMLDivElement | null) => void>>>({})

  for (const key of BLOQUES_ORDEN) {
    if (!contentRefCallbacks.current[key]) {
      contentRefCallbacks.current[key] = (el: HTMLDivElement | null) => {
        contentRefsObj.current[key] = el
      }
    }
  }

  // ── Carga de datos ──
  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setHasError(false)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: perfil, error: perfilError } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()

      if (perfilError || !perfil) throw new Error(perfilError?.message ?? 'Perfil no encontrado')

      const [contenidosRes, progresoRes] = await Promise.all([
        supabase
          .from('conocimiento')
          .select('*')
          .eq('empresa_id', perfil.empresa_id)
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
      }
    } catch (err) {
      console.error('Error cargando cultura:', err)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Scroll tracking ──
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleScroll = useCallback(() => {
    const vh = window.innerHeight
    const updates: Partial<Record<BloqueKey, number>> = {}
    let closestBloque: BloqueKey | null = null
    let closestDist = Infinity

    for (const bloque of BLOQUES_ORDEN) {
      const el = contentRefsObj.current[bloque]
      if (!el) continue
      const { top, height } = el.getBoundingClientRect()
      const scrolled = (vh - top) / height
      updates[bloque] = Math.min(100, Math.max(0, Math.round(scrolled * 100)))

      // Determinar bloque más visible
      const dist = Math.abs(top - vh / 3)
      if (dist < closestDist) {
        closestDist = dist
        closestBloque = bloque
      }
    }

    setReadProgress(prev => ({ ...prev, ...updates }))
    if (closestBloque) setBloqueActivo(closestBloque)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      if (scrollThrottleRef.current) return
      scrollThrottleRef.current = setTimeout(() => {
        scrollThrottleRef.current = null
        handleScroll()
      }, 80)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    handleScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (scrollThrottleRef.current) clearTimeout(scrollThrottleRef.current)
    }
  }, [handleScroll])

  // ── Handlers quiz ──
  const handleRespuesta = (bloqueKey: BloqueKey, qIdx: number, opIdx: number) => {
    setRespuestas(prev => ({
      ...prev,
      [bloqueKey]: prev[bloqueKey].map((r, i) => (i === qIdx ? opIdx : r)),
    }))
  }

  const handleReset = (bloqueKey: BloqueKey) => {
    const preguntas = PREGUNTAS[bloqueKey]
    setRespuestas(prev => ({
      ...prev,
      [bloqueKey]: prev[bloqueKey].map((r, i) =>
        r === preguntas[i].correcta ? r : null
      ),
    }))
  }

  const handleComplete = async (bloqueKey: BloqueKey) => {
    if (!userId || completando) return
    setCompletando(bloqueKey)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('progreso_modulos').upsert(
        {
          usuario_id: userId,
          modulo: 'cultura',
          bloque: bloqueKey,
          completado: true,
          completado_at: new Date().toISOString(),
        },
        { onConflict: 'usuario_id,modulo,bloque' },
      )
      if (error) throw error

      setProgreso(prev => ({
        ...prev,
        [bloqueKey]: {
          usuario_id: userId,
          modulo: 'cultura',
          bloque: bloqueKey,
          completado: true,
          completado_at: new Date().toISOString(),
        } as ProgresoModulo,
      }))

      confetti({
        particleCount: 100,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#3B4FD8', '#0D9488', '#6B7CF0', '#2DD4BF', '#ffffff'],
      })
      toast.success('¡Bloque completado! 🎉')
    } catch (err) {
      console.error('Error guardando progreso:', err)
      toast.error('No se pudo guardar el progreso')
    } finally {
      setCompletando(null)
    }
  }

  // ── Scroll a bloque desde stepper ──
  const scrollToBloque = (key: BloqueKey) => {
    const el = document.getElementById(`bloque-${key}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // ── Derivados ──
  const totalCompletados = BLOQUES_ORDEN.filter(b => progreso[b]?.completado).length
  const porcentajeGlobal = (totalCompletados / BLOQUES_ORDEN.length) * 100
  const todoCompleto = totalCompletados === BLOQUES_ORDEN.length

  const isUnlocked = (bloque: BloqueKey): boolean => {
    const idx = BLOQUES_ORDEN.indexOf(bloque)
    if (idx === 0) return true
    return progreso[BLOQUES_ORDEN[idx - 1]]?.completado === true
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="shimmer rounded-md h-8 w-52 mb-2" />
          <div className="shimmer rounded-md h-4 w-36 mb-6" />
          <div className="shimmer rounded-full h-1.5 w-full mb-8" />
          <SkeletonCultura />
        </div>
      </div>
    )
  }

  // ── Error ──
  if (hasError) {
    return (
      <div className="min-h-dvh gradient-bg flex items-center justify-center p-6">
        <ErrorState mensaje="No se pudo cargar el módulo de cultura." onRetry={cargarDatos} />
      </div>
    )
  }

  // ── Render principal ──
  return (
    <>
      {/* Barra de desplazamiento global animada */}
      <ScrollProgressBar />

      <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8 pt-6">
        <div className="max-w-5xl mx-auto">

          {/* ── Header con banner decorativo ── */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative rounded-2xl overflow-hidden mb-8 p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(20,184,166,0.08) 50%, rgba(10,22,40,0.6) 100%)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            {/* Glow decorativo */}
            <div
              className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20 pointer-events-none"
              style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
            />
            <div
              className="absolute -bottom-4 left-8 w-24 h-24 rounded-full opacity-15 pointer-events-none"
              style={{ background: 'radial-gradient(circle, #14b8a6 0%, transparent 70%)' }}
            />

            <div className="relative flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/25 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                  </div>
                  <span className="text-[11px] font-medium text-indigo-400/70 uppercase tracking-widest">
                    Módulo 2
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-white">Cultura e identidad</h1>
                <p className="text-sm text-white/45 mt-1">
                  {todoCompleto
                    ? '¡Módulo completado! Conocés la empresa y sus valores.'
                    : 'Conocé la historia, misión y forma de trabajar de la empresa.'}
                </p>
              </div>

              {/* Círculo de progreso */}
              <div className="flex-shrink-0 relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                  <motion.circle
                    cx="32" cy="32" r="26"
                    fill="none"
                    stroke="url(#prog-gradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - porcentajeGlobal / 100) }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                  <defs>
                    <linearGradient id="prog-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-bold text-white">{Math.round(porcentajeGlobal)}%</span>
                </div>
              </div>
            </div>

            {/* Chips de progreso */}
            <div className="relative flex items-center gap-2 mt-4 flex-wrap">
              {BLOQUES_ORDEN.map((bKey, idx) => {
                const completado = progreso[bKey]?.completado
                const cfg = BLOQUES_CONFIG[bKey]
                return (
                  <button
                    key={bKey}
                    onClick={() => scrollToBloque(bKey)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200',
                      completado
                        ? 'bg-teal-500/15 text-teal-300 border border-teal-500/25'
                        : idx === 0 || progreso[BLOQUES_ORDEN[idx - 1]]?.completado
                        ? cn('border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20', 'bg-white/[0.04]')
                        : 'bg-white/[0.02] text-white/20 border border-white/[0.05] cursor-not-allowed',
                    )}
                  >
                    {completado ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-current opacity-60" />
                    )}
                    {cfg.label.split(' ')[0]}
                  </button>
                )
              })}
              <span className="ml-auto text-xs text-white/30 font-mono">
                {totalCompletados}/{BLOQUES_ORDEN.length} bloques
              </span>
            </div>
          </motion.div>

          {/* ── Layout: stepper + bloques ── */}
          <div className="flex gap-6 items-start">

            {/* Stepper lateral (solo desktop) */}
            <StepperSidebar
              progreso={progreso}
              bloqueActivo={bloqueActivo}
              onClickBloque={scrollToBloque}
            />

            {/* Bloques de contenido */}
            <div className="flex-1 min-w-0">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-4"
              >
                {BLOQUES_ORDEN.map((bloqueKey, idx) => (
                  <BloqueCard
                    key={bloqueKey}
                    bloqueKey={bloqueKey}
                    numero={idx + 1}
                    contenido={contenidos[bloqueKey] ?? null}
                    unlocked={isUnlocked(bloqueKey)}
                    completado={progreso[bloqueKey]?.completado === true}
                    readProgress={readProgress[bloqueKey]}
                    respuestas={respuestas[bloqueKey]}
                    completando={completando === bloqueKey}
                    onRespuesta={(qIdx, opIdx) => handleRespuesta(bloqueKey, qIdx, opIdx)}
                    onComplete={() => handleComplete(bloqueKey)}
                    onReset={() => handleReset(bloqueKey)}
                    contentRef={contentRefCallbacks.current[bloqueKey]!}
                    isActive={bloqueActivo === bloqueKey}
                  />
                ))}
              </motion.div>

              {/* Banner de módulo completado */}
              <AnimatePresence>
                {todoCompleto && (
                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.2 }}
                    className="mt-6 rounded-2xl overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(20,184,166,0.18) 0%, rgba(13,148,136,0.08) 100%)',
                      border: '1px solid rgba(20,184,166,0.25)',
                    }}
                  >
                    <div className="p-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(20,184,166,0.3)]">
                          <Star className="w-5 h-5 text-teal-400 fill-teal-400/30" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-teal-200">
                            ¡Completaste Cultura e identidad!
                          </p>
                          <p className="text-xs text-teal-300/60 mt-0.5">
                            Conocés la empresa y sus valores. Ahora es el momento de conocer tu rol.
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/empleado/rol"
                        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold
                          bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 hover:text-teal-200
                          border border-teal-500/25 transition-all duration-150"
                      >
                        Ir a mi Rol
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
