'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Lock, CheckCircle2, BookOpen, Target, Users,
  ClipboardList, Trophy, ChevronDown, ArrowRight,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { ErrorState } from '@/components/shared/ErrorState'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/utils'
import type { ContenidoBloque, ProgresoModulo } from '@/types'

// ─────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────

type BloqueKey = 'historia' | 'mision' | 'como_trabajamos' | 'expectativas' | 'hitos'

interface Pregunta {
  pregunta: string
  opciones: string[]
  correcta: number
}

// ─────────────────────────────────────────────
// Orden y metadatos de los bloques
// ─────────────────────────────────────────────

const BLOQUES_ORDEN: BloqueKey[] = [
  'historia',
  'mision',
  'como_trabajamos',
  'expectativas',
  'hitos',
]

const BLOQUES_CONFIG: Record<BloqueKey, { label: string; icon: React.ReactNode; iconColor: string }> = {
  historia: {
    label: 'Nuestra historia',
    icon: <BookOpen className="w-5 h-5" />,
    iconColor: 'text-indigo-400 bg-indigo-600/15',
  },
  mision: {
    label: 'Misión, visión y valores',
    icon: <Target className="w-5 h-5" />,
    iconColor: 'text-teal-400 bg-teal-600/15',
  },
  como_trabajamos: {
    label: 'Cómo trabajamos',
    icon: <Users className="w-5 h-5" />,
    iconColor: 'text-sky-400 bg-sky-600/15',
  },
  expectativas: {
    label: 'Qué se espera de mí',
    icon: <ClipboardList className="w-5 h-5" />,
    iconColor: 'text-amber-400 bg-amber-600/15',
  },
  hitos: {
    label: 'Nuestros hitos',
    icon: <Trophy className="w-5 h-5" />,
    iconColor: 'text-rose-400 bg-rose-600/15',
  },
}

// ─────────────────────────────────────────────
// Preguntas hardcodeadas (genéricas por tema)
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
  show: { opacity: 1, transition: { staggerChildren: 0.12 } },
}

const blockVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

const quizEntryVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 26 },
  },
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function SkeletonCultura() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="shimmer rounded-lg w-10 h-10 flex-shrink-0" />
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
// Subcomponente: Barra de lectura dentro del header
// ─────────────────────────────────────────────

function ReadProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden mt-2">
      <motion.div
        className="h-full rounded-full bg-indigo-500"
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{ boxShadow: value > 0 ? '0 0 6px rgba(79,99,231,0.5)' : 'none' }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// Subcomponente: Quiz de comprensión
// ─────────────────────────────────────────────

interface BloqueQuizProps {
  bloqueKey: BloqueKey
  respuestas: (number | null)[]
  onRespuesta: (qIdx: number, opIdx: number) => void
  onComplete: () => void
  completando: boolean
  onReset: () => void
}

function BloqueQuiz({ bloqueKey, respuestas, onRespuesta, onComplete, completando, onReset }: BloqueQuizProps) {
  const preguntas = PREGUNTAS[bloqueKey]
  const todasRespondidas = respuestas.every(r => r !== null)
  const todasCorrectas = preguntas.every((p, i) => respuestas[i] === p.correcta)

  return (
    <motion.div
      variants={quizEntryVariants}
      initial="hidden"
      animate="show"
      className="mt-6 pt-6 border-t border-white/[0.07] space-y-6"
    >
      <p className="text-[11px] font-medium text-white/35 uppercase tracking-widest">
        Verificá tu comprensión
      </p>

      {preguntas.map((p, qIdx) => {
        const respuesta = respuestas[qIdx]
        const respondida = respuesta !== null
        const esCorrecta = respondida && respuesta === p.correcta

        return (
          <div key={qIdx} className="space-y-2">
            <p className="text-sm text-white/80 font-medium leading-snug">
              {qIdx + 1}. {p.pregunta}
            </p>
            <div className="space-y-1.5">
              {p.opciones.map((op, opIdx) => {
                const seleccionada = respuesta === opIdx
                const esLaCorrecta = opIdx === p.correcta

                let bgClass = 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06] hover:border-white/15'
                if (respondida && seleccionada && esCorrecta)
                  bgClass = 'bg-teal-600/15 border-teal-500/40'
                else if (respondida && seleccionada && !esCorrecta)
                  bgClass = 'bg-red-500/10 border-red-500/30'
                else if (respondida && esLaCorrecta && !esCorrecta)
                  bgClass = 'bg-teal-600/10 border-teal-500/20'

                return (
                  <button
                    key={opIdx}
                    onClick={() => !respondida && onRespuesta(qIdx, opIdx)}
                    disabled={respondida}
                    className={cn(
                      'w-full text-left text-sm px-3 py-2.5 rounded-lg border transition-all duration-150',
                      'disabled:cursor-default',
                      bgClass,
                      !respondida ? 'text-white/70 cursor-pointer' : 'text-white/60',
                    )}
                  >
                    {op}
                  </button>
                )
              })}
            </div>

            {/* Feedback por pregunta */}
            {respondida && !esCorrecta && (
              <p className="text-xs text-red-400 mt-1">
                Respuesta incorrecta. Revisá el contenido e intentá de nuevo.
              </p>
            )}
          </div>
        )
      })}

      {/* Botón completar — aparece cuando todas están respondidas y son correctas */}
      <AnimatePresence>
        {todasRespondidas && todasCorrectas && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <button
              onClick={onComplete}
              disabled={completando}
              className={cn(
                'w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                'bg-teal-600 text-white hover:bg-teal-500',
                'shadow-[0_0_20px_rgba(13,148,136,0.3)]',
                'hover:shadow-[0_0_28px_rgba(13,148,136,0.45)]',
                'disabled:opacity-60 disabled:cursor-wait',
              )}
            >
              {completando ? 'Guardando...' : '¡Completé este bloque! →'}
            </button>
          </motion.div>
        )}

        {todasRespondidas && !todasCorrectas && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <button
              onClick={onReset}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Revisá las respuestas incorrectas y volvé a intentarlo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Subcomponente: BloqueCard
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
}: BloqueCardProps) {
  const config = BLOQUES_CONFIG[bloqueKey]
  const [expandido, setExpandido] = useState(true)
  const showQuiz = readProgress >= 80 && !completado && contenido !== null
  const locked = !unlocked

  return (
    <motion.div variants={blockVariants} className="relative">
      <div
        className={cn(
          'glass-card rounded-xl overflow-hidden transition-all duration-300',
          completado && 'border-teal-500/20',
          locked && 'opacity-70',
        )}
      >
        {/* ── Header ── */}
        <div
          className={cn(
            'p-5',
            unlocked && !completado && 'cursor-default',
            completado && 'cursor-pointer',
          )}
          onClick={() => completado && setExpandido(v => !v)}
        >
          <div className="flex items-start gap-3">
            {/* Ícono del bloque */}
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', config.iconColor)}>
              {completado ? <CheckCircle2 className="w-5 h-5" /> : config.icon}
            </div>

            {/* Título + progreso */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-white/30 font-mono tabular-nums">
                  {numero.toString().padStart(2, '0')}
                </span>
                <h3 className="text-sm font-semibold text-white">{config.label}</h3>
              </div>

              {/* Barra de lectura — solo en bloque activo */}
              {unlocked && !completado && (
                <ReadProgressBar value={readProgress} />
              )}
            </div>

            {/* Badge de estado */}
            <div className="flex-shrink-0 flex items-center gap-1">
              {completado && (
                <Badge variant="success">Completado</Badge>
              )}
              {unlocked && !completado && (
                <Badge variant="info">{Math.round(readProgress)}% leído</Badge>
              )}
              {locked && (
                <Lock className="w-4 h-4 text-white/20" />
              )}
              {completado && (
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-white/30 ml-1 transition-transform duration-200',
                    !expandido && 'rotate-180',
                  )}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Contenido ── */}
        <AnimatePresence>
          {unlocked && (!completado || expandido) && (
            <motion.div
              initial={completado ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div ref={contentRef} className="px-5 pb-5">
                {/* Texto del bloque */}
                {contenido ? (
                  <div className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">
                    {contenido.contenido}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-white/30 italic">
                      Contenido no disponible. El administrador aún no cargó este bloque.
                    </p>
                    <p className="text-xs text-white/20">
                      Este bloque no puede completarse hasta que el contenido esté disponible.
                    </p>
                  </div>
                )}

                {/* Quiz — aparece al 80% de lectura */}
                <AnimatePresence>
                  {showQuiz && (
                    <BloqueQuiz
                      bloqueKey={bloqueKey}
                      respuestas={respuestas}
                      onRespuesta={onRespuesta}
                      onComplete={onComplete}
                      completando={completando}
                      onReset={onReset}
                    />
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
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.25 } }}
              className="absolute inset-0 bg-surface-900/70 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center gap-2"
            >
              <Lock className="w-6 h-6 text-white/20" />
              <p className="text-xs text-white/30 text-center px-4">
                Completá el anterior para desbloquear
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
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

  // Refs para medir el área de contenido de cada bloque
  const contentRefsObj = useRef<Partial<Record<BloqueKey, HTMLDivElement | null>>>({})
  const contentRefCallbacks = useRef<Partial<Record<BloqueKey, (el: HTMLDivElement | null) => void>>>({})

  // Inicializar callbacks estables una vez por BloqueKey
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

      // Obtener empresa_id del perfil
      const { data: perfil, error: perfilError } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()

      if (perfilError || !perfil) throw new Error(perfilError?.message ?? 'Perfil no encontrado')

      // Cargar contenido y progreso en paralelo
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

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // ── Scroll tracking ──
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleScroll = useCallback(() => {
    const vh = window.innerHeight
    const updates: Partial<Record<BloqueKey, number>> = {}

    for (const bloque of BLOQUES_ORDEN) {
      const el = contentRefsObj.current[bloque]
      if (!el) continue
      const { top, height } = el.getBoundingClientRect()
      // % del área que ya pasó por el viewport
      const scrolled = (vh - top) / height
      updates[bloque] = Math.min(100, Math.max(0, Math.round(scrolled * 100)))
    }

    setReadProgress(prev => ({ ...prev, ...updates }))
  }, [])

  useEffect(() => {
    const onScroll = () => {
      if (scrollThrottleRef.current) return
      scrollThrottleRef.current = setTimeout(() => {
        scrollThrottleRef.current = null
        handleScroll()
      }, 100)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    handleScroll() // check estado inicial
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (scrollThrottleRef.current) clearTimeout(scrollThrottleRef.current)
    }
  }, [handleScroll])

  // ── Responder una pregunta ──
  const handleRespuesta = (bloqueKey: BloqueKey, qIdx: number, opIdx: number) => {
    setRespuestas(prev => ({
      ...prev,
      [bloqueKey]: prev[bloqueKey].map((r, i) => (i === qIdx ? opIdx : r)),
    }))
  }

  // ── Reiniciar respuestas de un bloque ──
  const handleReset = (bloqueKey: BloqueKey) => {
    const preguntas = PREGUNTAS[bloqueKey]
    setRespuestas(prev => ({
      ...prev,
      [bloqueKey]: prev[bloqueKey].map((r, i) =>
        r === preguntas[i].correcta ? r : null  // keep correct, reset incorrect
      ),
    }))
  }

  // ── Completar un bloque ──
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

      // Actualizar estado local
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

      // Confetti burst con colores del design system
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3B4FD8', '#0D9488', '#6B7CF0', '#2DD4BF', '#ffffff'],
      })

      toast.success('¡Bloque completado!')
    } catch (err) {
      console.error('Error guardando progreso:', err)
      toast.error('No se pudo guardar el progreso')
    } finally {
      setCompletando(null)
    }
  }

  // ── Progreso global (X/5 bloques) ──
  const totalCompletados = BLOQUES_ORDEN.filter(
    b => progreso[b]?.completado,
  ).length
  const porcentajeGlobal = (totalCompletados / BLOQUES_ORDEN.length) * 100

  // ── Derivar unlocked por bloque ──
  const isUnlocked = (bloque: BloqueKey): boolean => {
    const idx = BLOQUES_ORDEN.indexOf(bloque)
    if (idx === 0) return true
    return progreso[BLOQUES_ORDEN[idx - 1]]?.completado === true
  }

  // ── Render: loading ──
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

  // ── Render: error ──
  if (hasError) {
    return (
      <div className="min-h-dvh gradient-bg flex items-center justify-center p-6">
        <ErrorState
          mensaje="No se pudo cargar el módulo de cultura."
          onRetry={cargarDatos}
        />
      </div>
    )
  }

  // ── Render: principal ──
  return (
    <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Encabezado */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-semibold text-white">Cultura e identidad</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {totalCompletados === BLOQUES_ORDEN.length
              ? '¡Módulo completado!'
              : `${totalCompletados} de ${BLOQUES_ORDEN.length} bloques completados`}
          </p>
        </motion.div>

        {/* Barra de progreso global del módulo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <ProgressBar
            value={porcentajeGlobal}
            label="Progreso del módulo"
            showPercentage
          />
        </motion.div>

        {/* Bloques */}
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
            />
          ))}
        </motion.div>

        {/* Banner de módulo completado */}
        {totalCompletados === BLOQUES_ORDEN.length && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.3 }}
            className="mt-6 rounded-xl border border-teal-500/25 bg-teal-500/10 px-5 py-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-teal-200">
                    ¡Completaste el módulo de Cultura!
                  </p>
                  <p className="text-xs text-teal-300/60 mt-0.5">
                    Ya conocés la empresa. Ahora es momento de conocer tu rol.
                  </p>
                </div>
              </div>
              <Link
                href="/empleado/rol"
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium
                  text-teal-300 hover:text-teal-200 transition-colors duration-150"
              >
                Ir a Mi Rol
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
