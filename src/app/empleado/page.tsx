'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  User, BookOpen, Briefcase, MessageSquare,
  CheckCircle2, Circle, Lock, ArrowRight, CalendarDays,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ErrorState } from '@/components/shared/ErrorState'
import { EncuestaPulsoModal, type EncuestaPendiente } from '@/components/empleado/EncuestaPulsoModal'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface DatosHome {
  nombre: string
  fechaIngreso: string | null
  preboarding: boolean
  progresoModulos: Record<string, number> // modulo → bloques completados
  totalBloquesCultura: number
  proximaTarea: string | null
}

// ─────────────────────────────────────────────
// Config de módulos
// ─────────────────────────────────────────────

const MODULOS = [
  {
    key: 'M1',
    label: 'Perfil',
    descripcion: 'Tu información y equipo',
    href: '/empleado/perfil',
    icon: <User className="w-5 h-5" />,
    color: 'indigo',
  },
  {
    key: 'M2',
    label: 'Cultura',
    descripcion: 'Historia, misión y valores',
    href: '/empleado/cultura',
    icon: <BookOpen className="w-5 h-5" />,
    color: 'teal',
  },
  {
    key: 'M3',
    label: 'Rol',
    descripcion: 'Puesto, tareas y objetivos',
    href: '/empleado/rol',
    icon: <Briefcase className="w-5 h-5" />,
    color: 'indigo',
  },
  {
    key: 'M4',
    label: 'Asistente IA',
    descripcion: 'Preguntale a la IA todo lo que necesites',
    href: '/empleado/asistente',
    icon: <MessageSquare className="w-5 h-5" />,
    color: 'teal',
  },
] as const

// ─────────────────────────────────────────────
// Animaciones
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

function diasDesdeIngreso(fecha: string | null): number {
  if (!fecha) return 1
  const diff = Date.now() - new Date(fecha).getTime()
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

/** Días hasta la fecha de ingreso (para el banner de pre-boarding) */
function diasHastaIngreso(fecha: string): number {
  const diff = new Date(fecha).getTime() - Date.now()
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// ─────────────────────────────────────────────
// Banner Pre-boarding
// ─────────────────────────────────────────────

function BannerPreboarding({ fechaIngreso }: { fechaIngreso: string }) {
  const dias = diasHastaIngreso(fechaIngreso)
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className="rounded-xl border border-indigo-500/20 bg-indigo-600/10 px-4 py-3.5"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center mt-0.5">
          <CalendarDays className="w-4 h-4 text-indigo-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-indigo-200">
            Tu onboarding oficial empieza en {dias} {dias === 1 ? 'día' : 'días'} — ¡Bienvenido/a!
          </p>
          <p className="text-xs text-indigo-300/60 mt-0.5">
            Mientras tanto, podés explorar la cultura de la empresa y conocer a tu equipo
          </p>
        </div>
      </div>
    </motion.div>
  )
}

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="shimmer h-8 w-64 rounded-md" />
        <div className="shimmer h-4 w-40 rounded-md" />
        <div className="shimmer h-2 w-full rounded-full" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="shimmer glass-card rounded-xl h-28" />
          ))}
        </div>
        <div className="shimmer rounded-xl h-16" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────

export default function EmpleadoHomePage() {
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [datos, setDatos] = useState<DatosHome | null>(null)
  const [encuestaPendiente, setEncuestaPendiente] = useState<EncuestaPendiente | null>(null)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setHasError(false)
    try {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [usuarioRes, progresoRes, tareasRes] = await Promise.all([
        supabase
          .from('usuarios')
          .select('nombre, fecha_ingreso, empresa_id, preboarding_activo')
          .eq('id', user.id)
          .single(),
        supabase
          .from('progreso_modulos')
          .select('modulo, bloque, completado')
          .eq('usuario_id', user.id),
        supabase
          .from('tareas_onboarding')
          .select('titulo, completada')
          .eq('usuario_id', user.id)
          .eq('completada', false)
          .order('orden', { ascending: true })
          .limit(1),
      ])

      const usuario = usuarioRes.data
      const progresoRows = progresoRes.data ?? []

      // Bloques completados por módulo
      const progresoModulos: Record<string, number> = {}
      for (const r of progresoRows) {
        if (r.completado) {
          progresoModulos[r.modulo] = (progresoModulos[r.modulo] ?? 0) + 1
        }
      }

      // Total bloques de cultura de esta empresa
      let totalBloquesCultura = 5
      if (usuario?.empresa_id) {
        const { count } = await supabase
          .from('conocimiento')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id)
          .eq('modulo', 'cultura')
        totalBloquesCultura = count ?? 5
      }

      const proximaTarea = tareasRes.data?.[0]?.titulo ?? null

      // Detectar modo pre-boarding: bandera activa y fecha ingreso aún no llegó
      const enPreboarding =
        usuario?.preboarding_activo === true &&
        !!usuario?.fecha_ingreso &&
        new Date(usuario.fecha_ingreso) > new Date()

      setDatos({
        nombre: usuario?.nombre ?? '',
        fechaIngreso: usuario?.fecha_ingreso ?? null,
        preboarding: enPreboarding,
        progresoModulos,
        totalBloquesCultura,
        proximaTarea,
      })

      // Si el flag sigue activo en DB pero la fecha ya pasó, sincronizar en background
      if (
        usuario?.preboarding_activo === true &&
        !!usuario?.fecha_ingreso &&
        new Date(usuario.fecha_ingreso) <= new Date()
      ) {
        const supabaseCleanup = createClient()
        // Wrapeamos en Promise para poder usar .catch() — PromiseLike no lo tiene
        Promise.resolve(
          supabaseCleanup
            .from('usuarios')
            .update({ preboarding_activo: false })
            .eq('id', user.id)
        ).catch(() => {}) // fire-and-forget, no bloquea la UI
      }

      // Verificar encuestas de pulso solo si NO está en pre-boarding
      if (!enPreboarding && user) {
        const diasOnboarding = Math.max(
          1,
          Math.ceil((Date.now() - new Date(usuario?.fecha_ingreso ?? Date.now()).getTime()) / (1000 * 60 * 60 * 24)),
        )
        try {
          const res = await fetch('/api/empleado/encuesta-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuarioId: user.id, diasOnboarding }),
          })
          if (res.ok) {
            const json = await res.json() as { encuesta: EncuestaPendiente | null }
            if (json.encuesta) setEncuestaPendiente(json.encuesta)
          }
        } catch {
          // Silenciar — no bloquea el home
        }
      }
    } catch (err) {
      console.error('Error cargando home empleado:', err)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  if (loading) return <Skeleton />

  if (hasError) {
    return (
      <div className="min-h-dvh gradient-bg flex items-center justify-center p-6">
        <ErrorState mensaje="No se pudo cargar tu panel." onRetry={cargarDatos} />
      </div>
    )
  }

  if (!datos) return null

  const dias = diasDesdeIngreso(datos.fechaIngreso)
  const enPreboarding = datos.preboarding

  // Progreso por módulo (M1 siempre completo, M2 cultura, M3 rol, M4 asistente)
  const m1 = true
  const m2 = (datos.progresoModulos['cultura'] ?? 0) >= datos.totalBloquesCultura
  const m3 = (datos.progresoModulos['rol'] ?? 0) > 0
  const m4 = (datos.progresoModulos['asistente'] ?? 0) > 0
  const estadoModulos = [m1, m2, m3, m4]
  const completados = estadoModulos.filter(Boolean).length
  const progresoPct = Math.round((completados / 4) * 100)

  // Determinar si un módulo está desbloqueado (secuencial).
  // En pre-boarding, M3 y M4 siempre bloqueados independientemente del progreso.
  function isUnlocked(idx: number): boolean {
    if (enPreboarding && (idx === 2 || idx === 3)) return false
    if (idx === 0) return true
    return estadoModulos[idx - 1]
  }

  /** Tooltip de bloqueo por pre-boarding */
  function motivoBloqueo(idx: number): string | null {
    if (enPreboarding && (idx === 2 || idx === 3)) {
      return 'Disponible desde el día de tu ingreso'
    }
    return null
  }

  return (
    <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8">
      {/* Modal de encuesta de pulso */}
      {encuestaPendiente && (
        <EncuestaPulsoModal
          encuesta={encuestaPendiente}
          onClose={() => setEncuestaPendiente(null)}
          onCompletada={() => setEncuestaPendiente(null)}
        />
      )}

      <div className="max-w-2xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* ── Banner pre-boarding ── */}
          {enPreboarding && datos.fechaIngreso && (
            <BannerPreboarding fechaIngreso={datos.fechaIngreso} />
          )}

          {/* ── Saludo ── */}
          <motion.div variants={cardVariants}>
            <h1 className="text-2xl font-semibold text-white">
              {saludo()}, {datos.nombre.split(' ')[0]} 👋
            </h1>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-white/40">
              <CalendarDays className="w-3.5 h-3.5" />
              {enPreboarding
                ? <span>Pre-boarding activo</span>
                : <span>Día {dias} de onboarding</span>
              }
            </div>
          </motion.div>

          {/* ── Progreso global ── */}
          <motion.div variants={cardVariants} className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-white/50">Progreso general</span>
              <span className="text-xs font-mono text-white/40 tabular-nums">
                {completados}/4 módulos
              </span>
            </div>
            <ProgressBar value={progresoPct} animated />
            <p className="text-[11px] text-white/30 mt-2">
              {progresoPct === 100
                ? '¡Onboarding completo! 🎉'
                : progresoPct === 0
                ? 'Empezá por el Módulo 1 — Perfil'
                : `${progresoPct}% completado — seguí así`}
            </p>
          </motion.div>

          {/* ── Tarjetas de módulos ── */}
          <motion.div variants={cardVariants}>
            <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-3">
              Módulos
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {MODULOS.map((mod, idx) => {
                const completado = estadoModulos[idx]
                const desbloqueado = isUnlocked(idx)
                const tooltipPreboarding = motivoBloqueo(idx)

                const content = (
                  <div
                    title={tooltipPreboarding ?? undefined}
                    className={`glass-card rounded-xl p-4 flex flex-col gap-3 h-full
                      transition-all duration-200
                      ${desbloqueado
                        ? 'hover:border-white/[0.12] hover:bg-white/[0.04] cursor-pointer'
                        : 'opacity-50 cursor-not-allowed'
                      }`}
                  >
                    {/* Ícono + estado */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                          ${completado
                            ? 'bg-teal-500/15 text-teal-400'
                            : mod.color === 'teal'
                            ? 'bg-teal-500/10 text-teal-500/50'
                            : 'bg-indigo-600/15 text-indigo-400/60'
                          }`}
                      >
                        {mod.icon}
                      </div>
                      {!desbloqueado ? (
                        <Lock className="w-3.5 h-3.5 text-white/20 mt-0.5 flex-shrink-0" />
                      ) : completado ? (
                        <CheckCircle2 className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-white/20 mt-0.5 flex-shrink-0" />
                      )}
                    </div>

                    {/* Texto */}
                    <div>
                      <p className="text-sm font-medium text-white/80">{mod.label}</p>
                      <p className="text-[11px] text-white/35 mt-0.5 leading-snug">
                        {mod.descripcion}
                      </p>
                    </div>

                    {/* CTA o estado de bloqueo */}
                    {tooltipPreboarding ? (
                      <p className="text-[11px] text-white/25 mt-auto">{tooltipPreboarding}</p>
                    ) : desbloqueado && !completado ? (
                      <div className="flex items-center gap-1 text-[11px] text-indigo-400 mt-auto">
                        <span>Continuar</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    ) : completado ? (
                      <p className="text-[11px] text-teal-400/60 mt-auto">Completado</p>
                    ) : null}
                  </div>
                )

                return desbloqueado ? (
                  <Link key={mod.key} href={mod.href} className="block">
                    {content}
                  </Link>
                ) : (
                  <div key={mod.key}>{content}</div>
                )
              })}
            </div>
          </motion.div>

          {/* ── Próxima tarea ── */}
          {datos.proximaTarea && (
            <motion.div variants={cardVariants}>
              <Link href="/empleado/rol">
                <div className="glass-card rounded-xl p-4 flex items-center gap-3
                  hover:border-white/[0.12] transition-colors duration-150 cursor-pointer">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Circle className="w-4 h-4 text-amber-400/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/35 uppercase tracking-wider mb-0.5">
                      Próxima tarea
                    </p>
                    <p className="text-sm text-white/75 truncate">{datos.proximaTarea}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/25 flex-shrink-0" />
                </div>
              </Link>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
