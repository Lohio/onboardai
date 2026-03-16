# Módulo 2 — Cultura e Identidad: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `/empleado/cultura` — una página con 5 bloques que se desbloquean en orden (modelo Duolingo), con contenido desde Supabase, progreso de lectura por scroll, quiz de comprensión, y confetti al completar cada bloque.

**Architecture:** Single-file Client Component en `src/app/empleado/cultura/page.tsx`. Todos los subcomponentes definidos localmente en el mismo archivo (mismo patrón que M1 perfil). Estado manejado con múltiples `useState`. Scroll tracking con un único `window` scroll listener que mide todos los bloques a la vez usando refs guardados en un `Map`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion, Supabase (browser client), canvas-confetti, react-hot-toast, lucide-react.

**Design doc:** `docs/plans/2026-03-15-cultura-design.md`

---

## Task 1: Instalar canvas-confetti

**Files:**
- Modify: `package.json` (vía npm install)

**Step 1: Instalar dependencia**

```bash
cd C:/Users/Maxi/onboardai
npm install canvas-confetti @types/canvas-confetti
```

**Step 2: Verificar que TypeScript no rompe**

```bash
npx tsc --noEmit
```
Expected: sin errores.

---

## Task 2: Agregar tipos a src/types/index.ts

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Agregar las dos interfaces al final del archivo**

```typescript
export interface ContenidoBloque {
  id: string
  empresa_id: string
  modulo: string
  bloque: string
  titulo: string
  contenido: string
  created_at: string
}

export interface ProgresoModulo {
  id: string
  usuario_id: string
  modulo: string
  bloque: string
  completado: boolean
  completado_at?: string
}
```

**Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```
Expected: sin errores.

---

## Task 3: Crear la página con constantes, preguntas y skeleton

**Files:**
- Create: `src/app/empleado/cultura/page.tsx`

**Step 1: Crear el directorio**

```bash
mkdir -p C:/Users/Maxi/onboardai/src/app/empleado/cultura
```

**Step 2: Crear el archivo con el bloque de imports, tipos locales, constantes de bloques y preguntas hardcodeadas**

Crear `src/app/empleado/cultura/page.tsx` con el siguiente contenido completo — se irá extendiendo en tareas siguientes, pero este es el núcleo estático:

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, CheckCircle2, BookOpen, Target, Users,
  ClipboardList, Trophy, ChevronDown, ChevronUp,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import toast, { Toaster } from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
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

const overlayExitVariants = {
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.25 } },
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
}

function BloqueQuiz({ bloqueKey, respuestas, onRespuesta, onComplete, completando }: BloqueQuizProps) {
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
              onClick={() => {
                // Limpiar solo respuestas incorrectas para reintentar
                // (manejado en el padre vía onRespuesta con -1 para reset)
              }}
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
}: BloqueCardProps) {
  const config = BLOQUES_CONFIG[bloqueKey]
  const [expandido, setExpandido] = useState(true)
  const showQuiz = readProgress >= 80 && !completado
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
            <div className="flex-shrink-0">
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
                  <div className="text-sm text-white/30 italic">
                    Contenido no disponible. El administrador aún no cargó este bloque.
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
              {...overlayExitVariants}
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

  // Refs para medir el área de contenido de cada bloque
  const contentRefs = useRef<Map<BloqueKey, HTMLDivElement>>(new Map())

  const setContentRef = (key: BloqueKey) => (el: HTMLDivElement | null) => {
    if (el) contentRefs.current.set(key, el)
    else contentRefs.current.delete(key)
  }

  // ── Carga de datos ──
  useEffect(() => {
    async function cargarDatos() {
      try {
        const supabase = createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)

        // Obtener empresa_id del perfil
        const { data: perfil } = await supabase
          .from('usuarios')
          .select('empresa_id')
          .eq('id', user.id)
          .single()

        if (!perfil) return

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
        toast.error('Error al cargar el módulo')
      } finally {
        setLoading(false)
      }
    }

    cargarDatos()
  }, [])

  // ── Scroll tracking ──
  const handleScroll = useCallback(() => {
    const vh = window.innerHeight
    const updates: Partial<Record<BloqueKey, number>> = {}

    for (const bloque of BLOQUES_ORDEN) {
      const el = contentRefs.current.get(bloque)
      if (!el) continue
      const { top, height } = el.getBoundingClientRect()
      // % del área que ya pasó por el viewport
      const scrolled = (vh - top) / height
      updates[bloque] = Math.min(100, Math.max(0, Math.round(scrolled * 100)))
    }

    setReadProgress(prev => ({ ...prev, ...updates }))
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // check initial state
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll, progreso]) // re-register when progreso changes (new blocks unlock)

  // ── Responder una pregunta ──
  const handleRespuesta = (bloqueKey: BloqueKey, qIdx: number, opIdx: number) => {
    setRespuestas(prev => ({
      ...prev,
      [bloqueKey]: prev[bloqueKey].map((r, i) => (i === qIdx ? opIdx : r)),
    }))
  }

  // ── Completar un bloque ──
  const handleComplete = async (bloqueKey: BloqueKey) => {
    if (!userId || completando) return
    setCompletando(bloqueKey)

    try {
      const supabase = createClient()

      await supabase.from('progreso_modulos').upsert(
        {
          usuario_id: userId,
          modulo: 'cultura',
          bloque: bloqueKey,
          completado: true,
          completado_at: new Date().toISOString(),
        },
        { onConflict: 'usuario_id,modulo,bloque' },
      )

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
        <Toaster position="top-right" />
        <div className="max-w-2xl mx-auto">
          <div className="shimmer rounded-md h-8 w-52 mb-2" />
          <div className="shimmer rounded-md h-4 w-36 mb-6" />
          <div className="shimmer rounded-full h-1.5 w-full mb-8" />
          <SkeletonCultura />
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
          className="mb-6"
        >
          <h1 className="text-2xl font-semibold text-white">Cultura e identidad</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {totalCompletados === BLOQUES_ORDEN.length
              ? '¡Módulo completado! 🎉'
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
              contentRef={setContentRef(bloqueKey)}
            />
          ))}
        </motion.div>
      </div>
    </div>
  )
}
```

**Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: sin errores.

**Step 4: Verificar build**

```bash
npm run build 2>&1 | tail -20
```
Expected: `/empleado/cultura` aparece en el listado de rutas, sin errores de compilación.

---

## Task 4: Corrección del comportamiento "reintentar quiz"

El quiz actualmente muestra "Revisá las respuestas incorrectas" pero el botón no hace nada porque la lógica de reset está incompleta. Hay que asegurarse de que las respuestas incorrectas se puedan limpiar.

**Files:**
- Modify: `src/app/empleado/cultura/page.tsx`

**El problema:** Cuando el usuario responde una pregunta incorrectamente, queda "bloqueado" (el botón está `disabled={respondida}`). Para permitir reintento, hay que limpiar las respuestas incorrectas cuando el usuario hace click en "Revisá las respuestas incorrectas".

**Step 1: Agregar prop `onReset` a `BloqueQuiz`**

En la interfaz `BloqueQuizProps`, agregar:
```typescript
onReset: () => void
```

En la llamada `<BloqueQuiz ... />` dentro de `BloqueCard`, pasar el prop:
```typescript
onReset={onReset}
```

En `BloqueCard`'s props interface, agregar:
```typescript
onReset: () => void
```

**Step 2: Implementar el botón de reset en `BloqueQuiz`**

Reemplazar el `onClick` vacío del botón "Revisá las respuestas incorrectas" con:
```typescript
onClick={onReset}
```

**Step 3: Implementar `handleReset` en `CulturaPage`**

Agregar función:
```typescript
const handleReset = (bloqueKey: BloqueKey) => {
  setRespuestas(prev => ({
    ...prev,
    [bloqueKey]: PREGUNTAS[bloqueKey].map(() => null),
  }))
}
```

En el JSX del map de bloques, agregar `onReset`:
```typescript
onReset={() => handleReset(bloqueKey)}
```

**Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: sin errores.

---

## Task 5: Verificación final y build

**Step 1: TypeScript check completo**

```bash
cd C:/Users/Maxi/onboardai && npx tsc --noEmit
```
Expected: sin errores.

**Step 2: Build de producción**

```bash
npm run build 2>&1 | tail -25
```
Expected output incluye:
```
✓ Compiled successfully
Route (app)
├ ○ /empleado/cultura
└ ○ /empleado/perfil
```

**Step 3: Verificación manual**

```bash
npm run dev
```

Verificar en el browser:
1. Navegar a `http://localhost:3000/empleado/cultura`
2. Si no hay sesión → redirige a `/auth/login`
3. Con sesión → ver skeleton 200ms → ver 5 bloques
4. Bloque 1 desbloqueado, bloques 2-5 con overlay de candado
5. Scrollear bloque 1 → barra de lectura avanza → quiz aparece al 80%
6. Responder correctamente → botón "¡Completé este bloque!" aparece
7. Click completar → confetti → bloque 2 se desbloquea
8. Barra de progreso global avanza de 0% a 20%

---

## Nota para el implementador

### Schema SQL a crear en Supabase ANTES de probar

```sql
CREATE TABLE conocimiento (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  modulo text NOT NULL,
  bloque text NOT NULL,
  titulo text NOT NULL,
  contenido text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE progreso_modulos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  bloque text NOT NULL,
  completado boolean DEFAULT false,
  completado_at timestamptz,
  UNIQUE(usuario_id, modulo, bloque)
);
```

### Datos de prueba para conocimiento

```sql
INSERT INTO conocimiento (empresa_id, modulo, bloque, titulo, contenido)
VALUES
  ('<tu-empresa-id>', 'cultura', 'historia', 'Nuestra historia', 'Fundada en 2018 con la visión de...'),
  ('<tu-empresa-id>', 'cultura', 'mision', 'Misión y valores', 'Nuestra misión es...'),
  ('<tu-empresa-id>', 'cultura', 'como_trabajamos', 'Cómo trabajamos', 'Trabajamos de forma ágil...'),
  ('<tu-empresa-id>', 'cultura', 'expectativas', 'Qué se espera de vos', 'En los primeros 30 días...'),
  ('<tu-empresa-id>', 'cultura', 'hitos', 'Nuestros hitos', 'En 2019 lanzamos... En 2022...');
```

### Si `contenido` es `null` (empresa no cargó el bloque aún)

La app muestra: *"Contenido no disponible. El administrador aún no cargó este bloque."* — no rompe.
