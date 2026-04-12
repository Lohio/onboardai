'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  Lock, CheckCircle2, BookOpen, Target, Users,
  ClipboardList, Trophy, ChevronDown, ArrowRight,
  Sparkles, Star, GitBranch,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { ErrorState } from '@/components/shared/ErrorState'
import OrgChart from '@/components/shared/OrgChart'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { construirArbol } from '@/lib/organigrama'
import type { ContenidoBloque, ProgresoModulo, OrgNodo } from '@/types'
import { useLanguage } from '@/components/LanguageProvider'

// ─────────────────────────────────────────────
// Renderer simple de Markdown
// ─────────────────────────────────────────────

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n')

  const renderInline = (raw: string): React.ReactNode => {
    const parts = raw.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} className="text-gray-800 font-semibold">{part.slice(2, -2)}</strong>
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
        <h3 key={key++} className="text-sm font-bold text-gray-900 mt-4 mb-1.5">
          {renderInline(trimmed.slice(4))}
        </h3>
      )
    } else if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={key++} className="text-base font-bold text-gray-900 mt-5 mb-2">
          {renderInline(trimmed.slice(3))}
        </h2>
      )
    } else if (trimmed.startsWith('# ')) {
      flushList()
      elements.push(
        <h1 key={key++} className="text-base font-bold text-gray-900 mt-5 mb-2">
          {renderInline(trimmed.slice(2))}
        </h1>
      )
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(
        <li key={key++} className="flex items-start gap-2 text-gray-600">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
          <span>{renderInline(trimmed.slice(2))}</span>
        </li>
      )
    } else {
      flushList()
      elements.push(
        <p key={key++} className="text-gray-600 leading-relaxed">
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
  iconBg: string
  iconText: string
  accent: string
}> = {
  historia: {
    label: 'Nuestra historia',
    icon: <BookOpen className="w-5 h-5" />,
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-600',
    accent: 'border-sky-200',
  },
  mision: {
    label: 'Misión, visión y valores',
    icon: <Target className="w-5 h-5" />,
    iconBg: 'bg-teal-100',
    iconText: 'text-teal-600',
    accent: 'border-teal-200',
  },
  como_trabajamos: {
    label: 'Cómo trabajamos',
    icon: <Users className="w-5 h-5" />,
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    accent: 'border-blue-200',
  },
  expectativas: {
    label: 'Cultura en el día a día',
    icon: <ClipboardList className="w-5 h-5" />,
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    accent: 'border-amber-200',
  },
  hitos: {
    label: 'Nuestros hitos',
    icon: <Trophy className="w-5 h-5" />,
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-600',
    accent: 'border-rose-200',
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
        <div key={i} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 animate-pulse">
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
// Quiz de comprensión
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
  const { t } = useLanguage()
  const preguntas = PREGUNTAS[bloqueKey]
  const todasRespondidas = respuestas.every(r => r !== null)
  const todasCorrectas = preguntas.every((p, i) => respuestas[i] === p.correcta)
  const cfg = BLOQUES_CONFIG[bloqueKey]

  return (
    <div className="mt-6 space-y-5">
      {/* Divider con label */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium', cfg.iconBg, cfg.iconText)}>
          <Sparkles className="w-3 h-3" />
          {t('cultura.quiz.title')}
        </div>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {preguntas.map((p, qIdx) => {
        const respuesta = respuestas[qIdx]
        const respondida = respuesta !== null
        const esCorrecta = respondida && respuesta === p.correcta

        return (
          <div key={qIdx} className="space-y-3">
            <p className="text-sm text-gray-800 font-medium leading-snug">
              <span className={cn('inline-block w-5 h-5 rounded-full text-center text-[11px] font-bold mr-2 leading-5', cfg.iconBg, cfg.iconText)}>
                {qIdx + 1}
              </span>
              {p.pregunta}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {p.opciones.map((op, opIdx) => {
                const seleccionada = respuesta === opIdx
                const esLaCorrecta = opIdx === p.correcta

                let style = 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300 text-gray-700'
                if (respondida && seleccionada && esCorrecta)
                  style = 'bg-teal-50 border-teal-300 text-teal-700'
                else if (respondida && seleccionada && !esCorrecta)
                  style = 'bg-red-50 border-red-300 text-red-700'
                else if (respondida && esLaCorrecta)
                  style = 'bg-teal-50/60 border-teal-200 text-teal-600'
                else if (respondida)
                  style = 'bg-gray-50 border-gray-100 text-gray-400'

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
                'shadow-sm hover:shadow-md',
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
            className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200"
          >
            <p className="text-xs text-amber-700">{t('cultura.quiz.error')}</p>
            <button
              onClick={onReset}
              className="text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors ml-3 flex-shrink-0"
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
// BloqueCard
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
          'relative bg-white rounded-xl overflow-hidden border transition-all duration-300',
          completado
            ? 'border-teal-200 shadow-sm'
            : isActive
            ? cn('border-gray-300 shadow-md', cfg.accent)
            : 'border-gray-200 shadow-sm',
          locked && 'opacity-60',
        )}
      >
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
                  ? 'bg-teal-100 text-teal-600'
                  : isActive
                  ? cn(cfg.iconBg, cfg.iconText)
                  : 'bg-gray-100 text-gray-300',
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
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-200 text-gray-500',
            )}>
              {numero}
            </div>
          </div>

          {/* Título y progreso */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className={cn(
              'text-sm font-semibold leading-tight',
              completado ? 'text-gray-400' : 'text-gray-900',
            )}>
              {cfg.label}
            </h3>

            {completado && (
              <p className="text-xs text-teal-600 mt-1">Completado ✓</p>
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
                  'w-4 h-4 text-gray-400 transition-transform duration-200',
                  !expandido && 'rotate-180',
                )}
              />
            ) : locked ? (
              <Lock className="w-4 h-4 text-gray-300" />
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
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                    <MarkdownContent text={contenido.contenido} />
                  </div>
                ) : (
                  <div className="py-4 text-center space-y-1">
                    <p className="text-sm text-gray-400 italic">
                      Contenido no disponible. El administrador aún no cargó este bloque.
                    </p>
                    <p className="text-xs text-gray-300">
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
              className="absolute inset-0 backdrop-blur-[1px] rounded-xl flex flex-col items-center justify-center gap-2"
              style={{ background: 'rgba(255,255,255,0.75)' }}
            >
              <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                <Lock className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500 text-center px-6">
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
// OrgBloqueCard
// ─────────────────────────────────────────────

function OrgBloqueCard({
  arbol,
  completado,
  onAutoComplete,
}: {
  arbol: OrgNodo[]
  completado: boolean
  onAutoComplete: () => void
}) {
  useEffect(() => {
    if (completado) return
    const timer = setTimeout(onAutoComplete, 3000)
    return () => clearTimeout(timer)
  }, [completado, onAutoComplete])

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-100 text-indigo-600 flex-shrink-0">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Organigrama de la empresa</h3>
            {completado ? (
              <p className="text-xs text-teal-600 mt-0.5">Completado ✓</p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">Se marcará como visto en unos segundos</p>
            )}
          </div>
          {completado && <CheckCircle2 className="w-4 h-4 text-teal-500 ml-auto flex-shrink-0" />}
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50">
          <OrgChart raices={arbol} modo="lectura" />
        </div>
      </div>
    </div>
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
  const [empresaId, setEmpresaId] = useState<string | null>(null)
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
  const initialSelectDoneRef = useRef(false)

  // Bloque organigrama (opcional)
  const [orgArbol, setOrgArbol] = useState<OrgNodo[]>([])
  const [orgCompletado, setOrgCompletado] = useState(false)
  const [orgCompletando, setOrgCompletando] = useState(false)
  const [orgActivo, setOrgActivo] = useState(false)

  // Cuando se selecciona un bloque normal, desactivar org
  useEffect(() => {
    if (bloqueActivo) setOrgActivo(false)
  }, [bloqueActivo])

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

      const eid = perfil.empresa_id
      setEmpresaId(eid)

      const [contenidosRes, progresoRes, orgNodosRes] = await Promise.all([
        supabase
          .from('conocimiento')
          .select('*')
          .eq('empresa_id', eid)
          .eq('modulo', 'cultura'),
        supabase
          .from('progreso_modulos')
          .select('*')
          .eq('usuario_id', user.id)
          .eq('modulo', 'cultura'),
        supabase
          .from('organigrama_nodos')
          .select('*')
          .eq('empresa_id', eid)
          .eq('visible', true)
          .order('orden'),
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
          if (p.bloque === 'organigrama') {
            setOrgCompletado(true)
          } else {
            mapa[p.bloque as BloqueKey] = p as ProgresoModulo
          }
        }
        setProgreso(mapa)
      }

      if (orgNodosRes.data && orgNodosRes.data.length > 0) {
        setOrgArbol(construirArbol(orgNodosRes.data as OrgNodo[]))
      }
    } catch (err) {
      console.error('Error cargando cultura:', err)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Seleccionar primer bloque no completado al cargar ──
  useEffect(() => {
    if (loading || initialSelectDoneRef.current) return
    initialSelectDoneRef.current = true
    const first = BLOQUES_ORDEN.find(b => !progreso[b]?.completado) ?? BLOQUES_ORDEN[0]
    setBloqueActivo(first)
    setReadProgress(prev => ({ ...prev, [first]: 100 }))
  }, [loading, progreso])

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
        colors: ['#0EA5E9', '#0D9488', '#38BDF8', '#2DD4BF', '#ffffff'],
      })
      toast.success('¡Bloque completado! 🎉')
      window.dispatchEvent(new CustomEvent('progreso-actualizado'))
    } catch (err) {
      console.error('Error guardando progreso:', err)
      toast.error('No se pudo guardar el progreso')
    } finally {
      setCompletando(null)
    }
  }

  // ── Selección de bloque activo ──
  const handleSelectBloque = (key: BloqueKey) => {
    const idx = BLOQUES_ORDEN.indexOf(key)
    const unlocked = idx === 0 || progreso[BLOQUES_ORDEN[idx - 1]]?.completado === true
    if (!unlocked) return
    setOrgActivo(false)
    setBloqueActivo(key)
    setReadProgress(prev => ({ ...prev, [key]: 100 }))
  }

  // ── Completar bloque organigrama (auto tras 3s de visualización) ──
  const completarOrgBloque = useCallback(async () => {
    if (orgCompletado || orgCompletando || !userId) return
    setOrgCompletando(true)
    try {
      const supabase = createClient()
      await supabase.from('progreso_modulos').upsert({
        usuario_id: userId,
        modulo: 'cultura',
        bloque: 'organigrama',
        completado: true,
        completado_at: new Date().toISOString(),
      })
      setOrgCompletado(true)
    } catch (err) {
      console.warn('[Cultura] completar organigrama:', err)
    } finally {
      setOrgCompletando(false)
    }
  }, [userId, orgCompletado, orgCompletando])

  // ── Derivados ──
  const { totalCompletados, porcentajeGlobal, todoCompleto } = useMemo(() => {
    const total = BLOQUES_ORDEN.filter(b => progreso[b]?.completado).length
    return {
      totalCompletados: total,
      porcentajeGlobal: (total / BLOQUES_ORDEN.length) * 100,
      todoCompleto: total === BLOQUES_ORDEN.length,
    }
  }, [progreso])

  const isUnlocked = (bloque: BloqueKey): boolean => {
    const idx = BLOQUES_ORDEN.indexOf(bloque)
    if (idx === 0) return true
    return progreso[BLOQUES_ORDEN[idx - 1]]?.completado === true
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8">
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
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-6">
        <ErrorState mensaje="No se pudo cargar el módulo de cultura." onRetry={cargarDatos} />
      </div>
    )
  }

  // ── Render principal ──
  return (
    <>
      <ScrollProgressBar />

      <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8 pt-6">
        <div className="max-w-6xl mx-auto">

          {/* ── Page header ── */}
          <div className="flex items-center gap-4 mb-6">
            <Image src="/heero-icons1.svg" alt="" width={45} height={45} />
            <div>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-1">Módulo 2</p>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">Cultura</h1>
              <p className="text-sm text-gray-500 mt-0.5">Historia, misión, valores y reglas de trabajo</p>
            </div>
          </div>

          {/* Pills navegación */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {BLOQUES_ORDEN.map((bKey, idx) => {
              const completado = progreso[bKey]?.completado
              const activo = bloqueActivo === bKey
              const desbloqueado = idx === 0 || progreso[BLOQUES_ORDEN[idx - 1]]?.completado === true
              const cfg = BLOQUES_CONFIG[bKey]
              return (
                <button
                  key={bKey}
                  onClick={() => handleSelectBloque(bKey)}
                  disabled={!desbloqueado}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                    activo && !completado
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                      : activo && completado
                      ? 'bg-teal-100 text-teal-700 border border-teal-300'
                      : completado
                      ? 'bg-teal-50 text-teal-600 border border-teal-200'
                      : desbloqueado
                      ? 'bg-white border border-gray-200 text-gray-600 hover:text-gray-800 hover:border-gray-300 hover:shadow-sm'
                      : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed opacity-50',
                  )}
                >
                  {completado ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-current opacity-60" />
                  )}
                  {cfg.label}
                </button>
              )
            })}

            {/* Pill organigrama */}
            {orgArbol.length > 0 && (
              <button
                onClick={() => { setOrgActivo(v => !v); setBloqueActivo(null) }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                  orgActivo && !orgCompletado
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                    : orgActivo && orgCompletado
                    ? 'bg-teal-100 text-teal-700 border border-teal-300'
                    : orgCompletado
                    ? 'bg-teal-50 text-teal-600 border border-teal-200'
                    : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-800 hover:border-gray-300 hover:shadow-sm',
                )}
              >
                {orgCompletado ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <GitBranch className="w-3 h-3 opacity-60" />
                )}
                Organigrama
              </button>
            )}
          </div>

          {/* Card de progreso */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">
                Mi progreso en Cultura
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {totalCompletados} / {BLOQUES_ORDEN.length} bloques
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
                <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                  <motion.circle
                    cx="28" cy="28" r="22" fill="none"
                    stroke="url(#culturaProgressGrad)" strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={138.2}
                    animate={{ strokeDashoffset: 138.2 - (138.2 * porcentajeGlobal / 100) }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                  />
                  <defs>
                    <linearGradient id="culturaProgressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3B4FD8" />
                      <stop offset="100%" stopColor="#0D9488" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-gray-900 leading-none">{Math.round(porcentajeGlobal)}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Progreso del módulo</p>
                <p className="text-xs text-gray-500">Completá los bloques para avanzar</p>
              </div>
            </div>
          </div>

          {/* Bloque activo */}
          <AnimatePresence mode="wait">
            {bloqueActivo && (
              <motion.div
                key={bloqueActivo}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              >
                <BloqueCard
                  bloqueKey={bloqueActivo}
                  numero={BLOQUES_ORDEN.indexOf(bloqueActivo) + 1}
                  contenido={contenidos[bloqueActivo] ?? null}
                  unlocked={isUnlocked(bloqueActivo)}
                  completado={progreso[bloqueActivo]?.completado === true}
                  readProgress={readProgress[bloqueActivo]}
                  respuestas={respuestas[bloqueActivo]}
                  completando={completando === bloqueActivo}
                  onRespuesta={(qIdx, opIdx) => handleRespuesta(bloqueActivo, qIdx, opIdx)}
                  onComplete={() => handleComplete(bloqueActivo)}
                  onReset={() => handleReset(bloqueActivo)}
                  contentRef={() => {}}
                  isActive
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bloque organigrama */}
          <AnimatePresence mode="wait">
            {orgActivo && orgArbol.length > 0 && (
              <motion.div
                key="organigrama"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              >
                <OrgBloqueCard
                  arbol={orgArbol}
                  completado={orgCompletado}
                  onAutoComplete={completarOrgBloque}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Banner de módulo completado */}
          <AnimatePresence>
            {todoCompleto && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.2 }}
                className="mt-6 bg-teal-50 border border-teal-200 rounded-xl overflow-hidden"
              >
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <Star className="w-5 h-5 text-teal-600 fill-teal-200" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-teal-800">
                        ¡Completaste Cultura e identidad!
                      </p>
                      <p className="text-xs text-teal-600 mt-0.5">
                        Conocés la empresa y sus valores. Ahora es el momento de conocer tu rol.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/empleado/rol"
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold
                      bg-teal-100 text-teal-700 hover:bg-teal-200 hover:text-teal-800
                      border border-teal-300 transition-all duration-150"
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
    </>
  )
}
