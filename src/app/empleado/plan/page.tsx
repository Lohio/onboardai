'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Map, CheckCircle2, Circle, Calendar, Trophy, Target, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { ErrorState } from '@/components/shared/ErrorState'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { calcularFaseActual, calcularDiaOnboarding, calcularProgresoPlanGlobal } from '@/lib/progreso'
import type { PlanFase, PlanItem } from '@/types'

// ─── Configuración de fases ────────────────────────────────────────────────────

const FASES: PlanFase[] = ['30', '60', '90']

const FASE_CONFIG: Record<PlanFase, {
  rango: string
  sublabel: string
  descripcion: string
  colorBg: string
  colorText: string
  colorBorder: string
  dotColor: string
  ringStroke: string
}> = {
  '30': {
    rango: 'Días 1–30',
    sublabel: 'Aprender',
    descripcion: 'Conocé la empresa, las herramientas y a tu equipo',
    colorBg: 'bg-indigo-500/15',
    colorText: 'text-indigo-300',
    colorBorder: 'border-indigo-500/30',
    dotColor: 'bg-indigo-400',
    ringStroke: '#6366F1',
  },
  '60': {
    rango: 'Días 31–60',
    sublabel: 'Contribuir',
    descripcion: 'Empezá a aportar valor y a ganar autonomía en tu rol',
    colorBg: 'bg-teal-500/15',
    colorText: 'text-teal-300',
    colorBorder: 'border-teal-500/30',
    dotColor: 'bg-teal-400',
    ringStroke: '#0D9488',
  },
  '90': {
    rango: 'Días 61–90',
    sublabel: 'Liderar',
    descripcion: 'Tomá iniciativa, mostrá tu impacto y liderá con autonomía',
    colorBg: 'bg-amber-500/15',
    colorText: 'text-amber-300',
    colorBorder: 'border-amber-500/30',
    dotColor: 'bg-amber-400',
    ringStroke: '#F59E0B',
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(fechaStr?: string): string {
  if (!fechaStr) return ''
  return new Date(fechaStr).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonPlan() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
          <div className="shimmer rounded-md h-4 w-32 mb-3" />
          <div className="space-y-2">
            <div className="shimmer rounded-md h-3 w-full" />
            <div className="shimmer rounded-md h-3 w-4/5" />
            <div className="shimmer rounded-md h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── ObjetivoRow ───────────────────────────────────────────────────────────────

function ObjetivoRow({
  item,
  onToggle,
  toggling,
}: {
  item: PlanItem
  onToggle: () => void
  toggling: boolean
}) {
  return (
    <motion.button
      layout
      onClick={onToggle}
      disabled={toggling}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 border',
        item.completado
          ? 'bg-teal-500/[0.06] border-teal-500/20 hover:bg-teal-500/10'
          : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.12]',
        toggling && 'opacity-60 cursor-wait',
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {item.completado
          ? <CheckCircle2 className="w-4 h-4 text-teal-400" />
          : <Circle className="w-4 h-4 text-white/25" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium leading-snug',
          item.completado ? 'line-through text-white/40' : 'text-white/85',
        )}>
          {item.titulo}
        </p>
        {item.descripcion && (
          <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{item.descripcion}</p>
        )}
        {item.fecha_target && !item.completado && (
          <p className="text-[11px] text-white/30 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatFecha(item.fecha_target)}
          </p>
        )}
      </div>
    </motion.button>
  )
}

// ─── CheckinRow ────────────────────────────────────────────────────────────────

function CheckinRow({ item }: { item: PlanItem }) {
  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-xl border',
      item.completado
        ? 'bg-teal-500/[0.06] border-teal-500/20'
        : 'bg-white/[0.03] border-white/[0.07]',
    )}>
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
        item.completado ? 'bg-teal-500/20 text-teal-400' : 'bg-white/[0.06] text-white/40',
      )}>
        <Calendar className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium',
          item.completado ? 'text-white/50' : 'text-white/85',
        )}>
          {item.titulo}
        </p>
        {item.fecha_target && (
          <p className="text-xs text-white/35 mt-0.5">{formatFecha(item.fecha_target)}</p>
        )}
      </div>
      <Badge variant={item.completado ? 'success' : 'info'}>
        {item.completado ? 'Realizado' : 'Pendiente'}
      </Badge>
    </div>
  )
}

// ─── LogroRow ──────────────────────────────────────────────────────────────────

function LogroRow({ item }: { item: PlanItem }) {
  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-xl border',
      item.completado
        ? 'bg-amber-500/[0.06] border-amber-500/20'
        : 'bg-white/[0.03] border-white/[0.07]',
    )}>
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
        item.completado ? 'bg-amber-500/20 text-amber-400' : 'bg-white/[0.06] text-white/30',
      )}>
        <Trophy className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium',
          item.completado ? 'text-white/85' : 'text-white/40',
        )}>
          {item.titulo}
        </p>
        {item.descripcion && (
          <p className="text-xs text-white/35 mt-0.5">{item.descripcion}</p>
        )}
      </div>
      {item.completado
        ? <Badge variant="success">Completado ✓</Badge>
        : <Badge variant="default">Pendiente</Badge>
      }
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function PlanPage() {
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [items, setItems] = useState<PlanItem[]>([])
  const [diasOnboarding, setDiasOnboarding] = useState(1)
  const [userId, setUserId] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [faseActiva, setFaseActiva] = useState<PlanFase>('30')

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
        .select('empresa_id, fecha_ingreso')
        .eq('id', user.id)
        .single()

      if (perfilError || !perfil) throw new Error(perfilError?.message ?? 'Perfil no encontrado')

      // Calcular días de onboarding y fase actual
      if (perfil.fecha_ingreso) {
        const dias = Math.min(90, calcularDiaOnboarding(perfil.fecha_ingreso))
        setDiasOnboarding(dias)
        setFaseActiva(calcularFaseActual(perfil.fecha_ingreso))
      }

      const { data: planData, error: planError } = await supabase
        .from('plan_items')
        .select('*')
        .eq('usuario_id', user.id)
        .order('orden', { ascending: true })

      if (planError) {
        console.warn('[Plan] plan_items:', planError.message)
      } else {
        setItems((planData ?? []) as PlanItem[])
      }
    } catch (err) {
      console.error('Error cargando plan:', err)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const handleToggle = async (item: PlanItem) => {
    if (toggling || item.tipo !== 'objetivo') return
    setToggling(item.id)

    // Optimistic update
    const nuevoEstado = !item.completado
    setItems(prev => prev.map(i =>
      i.id === item.id
        ? { ...i, completado: nuevoEstado, completado_at: nuevoEstado ? new Date().toISOString() : undefined }
        : i
    ))

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('plan_items')
        .update({
          completado: nuevoEstado,
          completado_at: nuevoEstado ? new Date().toISOString() : null,
        })
        .eq('id', item.id)

      if (error) throw error
      toast.success(nuevoEstado ? '¡Objetivo completado!' : 'Objetivo pendiente')
    } catch (err) {
      console.error('Error actualizando objetivo:', err)
      // Rollback
      setItems(prev => prev.map(i => i.id === item.id ? item : i))
      toast.error('No se pudo actualizar el objetivo')
    } finally {
      setToggling(null)
    }
  }

  const porcentaje = useMemo(() => calcularProgresoPlanGlobal(items), [items])

  const itemsFase = useMemo(() => items.filter(i => i.fase === faseActiva), [items, faseActiva])
  const objetivos = useMemo(() => itemsFase.filter(i => i.tipo === 'objetivo'), [itemsFase])
  const checkins = useMemo(() => itemsFase.filter(i => i.tipo === 'checkin'), [itemsFase])
  const logros = useMemo(() => itemsFase.filter(i => i.tipo === 'logro'), [itemsFase])

  const faseActual: PlanFase = diasOnboarding <= 30 ? '30' : diasOnboarding <= 60 ? '60' : '90'
  const cfg = FASE_CONFIG[faseActiva]
  const circumference = 2 * Math.PI * 26

  if (loading) {
    return (
      <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="shimmer rounded-md h-8 w-52 mb-2" />
          <div className="shimmer rounded-md h-4 w-36 mb-6" />
          <SkeletonPlan />
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="min-h-dvh gradient-bg flex items-center justify-center p-6">
        <ErrorState mensaje="No se pudo cargar el plan." onRetry={cargarDatos} />
      </div>
    )
  }

  return (
    <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8 pt-6">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
              <Map className="w-5 h-5 text-violet-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[11px] uppercase tracking-widest font-semibold text-violet-400/70">Mi Plan</p>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/[0.06] text-white/40 border border-white/[0.08]">
                  Día {diasOnboarding} de 90
                </span>
              </div>
              <h1 className="text-xl font-bold text-white leading-tight">Plan 30-60-90</h1>
              <p className="text-sm text-white/45 mt-0.5">Tu roadmap de los primeros 90 días</p>
            </div>
          </div>

          {/* Círculo de progreso */}
          <div className="flex-shrink-0 relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
              <motion.circle
                cx="32" cy="32" r="26"
                fill="none"
                stroke="#7C3AED"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${circumference}`}
                animate={{ strokeDashoffset: circumference * (1 - porcentaje / 100) }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-white">{Math.round(porcentaje)}%</span>
            </div>
          </div>
        </div>

        {/* ── Timeline de fases ── */}
        <div className="flex items-stretch gap-1">
          {FASES.map((fase, idx) => {
            const fcfg = FASE_CONFIG[fase]
            const activa = faseActiva === fase
            const esFaseActual = faseActual === fase
            const pasada = FASES.indexOf(fase) < FASES.indexOf(faseActual)

            return (
              <div key={fase} className="flex items-center flex-1 gap-1">
                <button
                  onClick={() => setFaseActiva(fase)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 px-2 py-3 rounded-xl transition-all duration-200 relative border',
                    activa
                      ? cn(fcfg.colorBg, fcfg.colorBorder)
                      : 'border-transparent hover:bg-white/[0.04]',
                  )}
                >
                  {/* Dot */}
                  <div className={cn(
                    'w-2 h-2 rounded-full transition-all duration-300',
                    esFaseActual
                      ? cn(fcfg.dotColor, 'scale-125 shadow-[0_0_8px_currentColor]')
                      : pasada
                      ? 'bg-teal-400/50'
                      : activa
                      ? fcfg.dotColor
                      : 'bg-white/15',
                  )} />
                  <span className={cn(
                    'text-[10px] font-mono font-bold leading-tight',
                    activa ? fcfg.colorText : 'text-white/30',
                  )}>
                    {fcfg.rango}
                  </span>
                  <span className={cn(
                    'text-[11px] font-semibold',
                    activa ? fcfg.colorText : 'text-white/30',
                  )}>
                    {fcfg.sublabel}
                  </span>
                  {esFaseActual && (
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-white/10 text-white/50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      actual
                    </span>
                  )}
                </button>
                {/* Conector entre fases */}
                {idx < FASES.length - 1 && (
                  <div className={cn(
                    'w-3 h-px flex-shrink-0 transition-colors duration-300',
                    pasada ? 'bg-teal-400/40' : 'bg-white/[0.08]',
                  )} />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Banner descripción de fase ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`banner-${faseActiva}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn('px-4 py-2.5 rounded-xl border text-sm', cfg.colorBg, cfg.colorBorder)}
          >
            <span className={cn('font-semibold', cfg.colorText)}>
              {cfg.rango} — {cfg.sublabel}:{' '}
            </span>
            <span className="text-white/55">{cfg.descripcion}</span>
          </motion.div>
        </AnimatePresence>

        {/* ── Contenido de la fase ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${faseActiva}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="space-y-4"
          >
            {/* OBJETIVOS */}
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <h2 className="text-xs font-bold text-white/70 uppercase tracking-wider">Objetivos</h2>
                {objetivos.length > 0 && (
                  <span className="ml-auto text-xs font-mono text-white/30">
                    {objetivos.filter(o => o.completado).length}/{objetivos.length}
                  </span>
                )}
              </div>
              {objetivos.length === 0 ? (
                <p className="text-sm text-white/30 italic text-center py-2">
                  Sin objetivos configurados para esta fase.
                </p>
              ) : (
                <div className="space-y-2">
                  {objetivos.map(obj => (
                    <ObjetivoRow
                      key={obj.id}
                      item={obj}
                      onToggle={() => handleToggle(obj)}
                      toggling={toggling === obj.id}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* CHECK-INS */}
            {checkins.length > 0 && (
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <h2 className="text-xs font-bold text-white/70 uppercase tracking-wider">Check-ins</h2>
                </div>
                <div className="space-y-2">
                  {checkins.map(ci => <CheckinRow key={ci.id} item={ci} />)}
                </div>
              </div>
            )}

            {/* LOGROS */}
            {logros.length > 0 && (
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <h2 className="text-xs font-bold text-white/70 uppercase tracking-wider">Logros</h2>
                </div>
                <div className="space-y-2">
                  {logros.map(logro => <LogroRow key={logro.id} item={logro} />)}
                </div>
              </div>
            )}

            {/* Empty state si la fase no tiene nada */}
            {objetivos.length === 0 && checkins.length === 0 && logros.length === 0 && (
              <div className="glass-card rounded-2xl p-10 text-center">
                <Map className="w-8 h-8 text-white/15 mx-auto mb-3" />
                <p className="text-sm text-white/35">Tu plan para esta fase aún no fue configurado.</p>
                <p className="text-xs text-white/20 mt-1">Hablá con tu manager o RRHH para definir tus objetivos.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  )
}
