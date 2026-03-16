'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckSquare, Square, Trophy, Target, Briefcase, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ErrorState } from '@/components/shared/ErrorState'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface ContenidoRol {
  bloque: string
  titulo: string
  contenido: string
}

interface Tarea {
  id: string
  titulo: string
  descripcion: string | null
  completada: boolean
  orden: number
}

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const blockVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

// ─────────────────────────────────────────────
// Bloque de contenido expandible
// ─────────────────────────────────────────────

function BloqueContenido({ titulo, contenido, icon }: {
  titulo: string
  contenido: string
  icon: React.ReactNode
}) {
  const [abierto, setAbierto] = useState(true)

  return (
    <motion.div variants={blockVariants} className="glass-card rounded-xl overflow-hidden">
      <button
        onClick={() => setAbierto(p => !p)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors duration-150"
      >
        <span className="w-8 h-8 rounded-lg bg-indigo-600/15 flex items-center justify-center flex-shrink-0 text-indigo-400">
          {icon}
        </span>
        <span className="flex-1 text-sm font-medium text-white/80">{titulo}</span>
        <ChevronDown
          className={`w-4 h-4 text-white/30 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <div className="px-4 pb-4 border-t border-white/[0.05]">
              <p className="text-sm text-white/55 leading-relaxed whitespace-pre-wrap pt-3">
                {contenido}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="shimmer h-8 w-52 rounded-md" />
        <div className="shimmer h-4 w-36 rounded-md" />
        <div className="shimmer rounded-xl h-24" />
        <div className="shimmer rounded-xl h-24" />
        <div className="shimmer rounded-xl h-40" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function RolPage() {
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [contenidos, setContenidos] = useState<ContenidoRol[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [completando, setCompletando] = useState<string | null>(null)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setHasError(false)
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

      const [contenidosRes, tareasRes] = await Promise.all([
        supabase
          .from('conocimiento')
          .select('bloque, titulo, contenido')
          .eq('empresa_id', perfil.empresa_id)
          .eq('modulo', 'rol'),
        supabase
          .from('tareas_onboarding')
          .select('id, titulo, descripcion, completada, orden')
          .eq('usuario_id', user.id)
          .order('orden', { ascending: true }),
      ])

      setContenidos(contenidosRes.data ?? [])
      setTareas((tareasRes.data ?? []) as Tarea[])
    } catch (err) {
      console.error('Error cargando rol:', err)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // ── Completar tarea ──
  const toggleTarea = async (tarea: Tarea) => {
    if (completando) return
    setCompletando(tarea.id)

    const nuevaCompletada = !tarea.completada
    setTareas(prev =>
      prev.map(t => t.id === tarea.id ? { ...t, completada: nuevaCompletada } : t)
    )

    const supabase = createClient()
    const { error } = await supabase
      .from('tareas_onboarding')
      .update({ completada: nuevaCompletada })
      .eq('id', tarea.id)

    if (error) {
      setTareas(prev =>
        prev.map(t => t.id === tarea.id ? { ...t, completada: tarea.completada } : t)
      )
      toast.error('No se pudo actualizar la tarea')
    } else {
      if (nuevaCompletada) toast.success('¡Tarea completada!')

      // Marcar progreso en progreso_modulos si todas están completas
      if (userId && nuevaCompletada) {
        const todasCompletadas = tareas.every(t =>
          t.id === tarea.id ? true : t.completada
        )
        if (todasCompletadas) {
          await supabase.from('progreso_modulos').upsert({
            usuario_id: userId,
            modulo: 'rol',
            bloque: 'general',
            completado: true,
            completado_at: new Date().toISOString(),
          }, { onConflict: 'usuario_id,modulo,bloque' })
        }
      }
    }

    setCompletando(null)
  }

  if (loading) return <Skeleton />

  if (hasError) {
    return (
      <div className="min-h-dvh gradient-bg flex items-center justify-center p-6">
        <ErrorState mensaje="No se pudo cargar el módulo de rol." onRetry={cargarDatos} />
      </div>
    )
  }

  const tareasCompletadas = tareas.filter(t => t.completada).length
  const progresoPct = tareas.length > 0
    ? Math.round((tareasCompletadas / tareas.length) * 100)
    : 0

  const iconPorBloque: Record<string, React.ReactNode> = {
    descripcion: <Briefcase className="w-4 h-4" />,
    autonomia: <Target className="w-4 h-4" />,
    objetivos: <Trophy className="w-4 h-4" />,
  }

  return (
    <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >
          {/* Encabezado */}
          <motion.div variants={blockVariants} className="mb-2">
            <h1 className="text-2xl font-semibold text-white">Rol y herramientas</h1>
            <p className="text-sm text-white/40 mt-0.5">
              Conocé tu puesto, responsabilidades y tareas
            </p>
          </motion.div>

          {/* Bloques de contenido */}
          {contenidos.length > 0 ? (
            contenidos.map(c => (
              <BloqueContenido
                key={c.bloque}
                titulo={c.titulo || c.bloque}
                contenido={c.contenido}
                icon={iconPorBloque[c.bloque] ?? <Briefcase className="w-4 h-4" />}
              />
            ))
          ) : (
            <motion.div
              variants={blockVariants}
              className="glass-card rounded-xl p-6 text-center"
            >
              <Briefcase className="w-8 h-8 text-white/15 mx-auto mb-2" />
              <p className="text-sm text-white/35">
                El contenido de este módulo está siendo preparado por tu equipo.
              </p>
            </motion.div>
          )}

          {/* Tareas de onboarding */}
          {tareas.length > 0 && (
            <motion.div variants={blockVariants} className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-medium text-white/80">Tareas de onboarding</h2>
                </div>
                <span className="text-[11px] font-mono text-white/30 tabular-nums">
                  {tareasCompletadas}/{tareas.length}
                </span>
              </div>

              <ProgressBar value={progresoPct} className="mb-3" />

              <div className="space-y-1.5">
                {tareas.map(tarea => (
                  <button
                    key={tarea.id}
                    onClick={() => toggleTarea(tarea)}
                    disabled={completando === tarea.id}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left
                      transition-colors duration-150
                      ${tarea.completada
                        ? 'bg-teal-500/5 hover:bg-teal-500/10'
                        : 'hover:bg-white/[0.03]'
                      }`}
                  >
                    {tarea.completada ? (
                      <CheckSquare className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-white/25 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${tarea.completada ? 'line-through text-white/30' : 'text-white/70'}`}>
                        {tarea.titulo}
                      </p>
                      {tarea.descripcion && !tarea.completada && (
                        <p className="text-[11px] text-white/30 mt-0.5 line-clamp-1">
                          {tarea.descripcion}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
