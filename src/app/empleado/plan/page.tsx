'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Map, CheckCircle2, Circle, Calendar, Trophy, Target, Clock,
} from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { ErrorState } from '@/components/shared/ErrorState'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { calcularFaseActual, calcularDiaOnboarding, calcularProgresoPlanGlobal } from '@/lib/progreso'
import { FASES_CONFIG } from '@/lib/plan'
import type { PlanFase, PlanItem } from '@/types'

// ─── Configuración de fases ────────────────────────────────────────────────────

const FASES: PlanFase[] = ['30', '60', '90']

// Colores claro por fase
const FASES_LIGHT: Record<string, {
  iconBg: string; iconText: string; border: string; dot: string; bgBanner: string
}> = {
  '30': { iconBg: 'bg-teal-50',   iconText: 'text-teal-600',   border: 'border-teal-200',   dot: 'bg-teal-500',   bgBanner: 'bg-teal-50 border-teal-200' },
  '60': { iconBg: 'bg-amber-50',  iconText: 'text-amber-600',  border: 'border-amber-200',  dot: 'bg-amber-500',  bgBanner: 'bg-amber-50 border-amber-200' },
  '90': { iconBg: 'bg-indigo-50', iconText: 'text-indigo-600', border: 'border-indigo-200', dot: 'bg-indigo-500', bgBanner: 'bg-indigo-50 border-indigo-200' },
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
        <div key={i} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 animate-pulse">
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
          ? 'bg-teal-50 border-teal-200 hover:bg-teal-100'
          : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300',
        toggling && 'opacity-60 cursor-wait',
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {item.completado
          ? <CheckCircle2 className="w-4 h-4 text-teal-500" />
          : <Circle className="w-4 h-4 text-gray-300" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium leading-snug',
          item.completado ? 'line-through text-gray-400' : 'text-gray-800',
        )}>
          {item.titulo}
        </p>
        {item.descripcion && (
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.descripcion}</p>
        )}
        {item.fecha_target && !item.completado && (
          <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
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
        ? 'bg-teal-50 border-teal-200'
        : 'bg-white border-gray-200',
    )}>
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
        item.completado ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-400',
      )}>
        <Calendar className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium',
          item.completado ? 'text-gray-400' : 'text-gray-800',
        )}>
          {item.titulo}
        </p>
        {item.fecha_target && (
          <p className="text-xs text-gray-400 mt-0.5">{formatFecha(item.fecha_target)}</p>
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
        ? 'bg-amber-50 border-amber-200'
        : 'bg-white border-gray-200',
    )}>
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
        item.completado ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-300',
      )}>
        <Trophy className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium',
          item.completado ? 'text-gray-800' : 'text-gray-400',
        )}>
          {item.titulo}
        </p>
        {item.descripcion && (
          <p className="text-xs text-gray-500 mt-0.5">{item.descripcion}</p>
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

      if (perfil.fecha_ingreso) {
        const dias = Math.min(90, calcularDiaOnboarding(perfil.fecha_ingreso))
        setDiasOnboarding(dias)
        setFaseActiva(calcularFaseActual(perfil.fecha_ingreso))
      }

      const { data: planData, error: planError } = await supabase
        .from('plan_30_60_90')
        .select('*')
        .eq('usuario_id', user.id)
        .order('orden', { ascending: true })

      if (planError) {
        console.warn('[Plan] plan_30_60_90:', planError.message)
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

    setItems(prev => prev.map(i =>
      i.id === item.id
        ? { ...i, completado: !i.completado, completado_at: !i.completado ? new Date().toISOString() : undefined }
        : i
    ))

    const supabase = createClient()
    const { error } = await supabase
      .from('plan_30_60_90')
      .update({
        completado: !item.completado,
        completado_at: !item.completado ? new Date().toISOString() : null,
      })
      .eq('id', item.id)

    if (error) {
      setItems(prev => prev.map(i => i.id === item.id ? item : i))
      toast.error('Error al actualizar')
    }

    setToggling(null)
  }

  const porcentaje = useMemo(() => calcularProgresoPlanGlobal(items), [items])

  const itemsFase = useMemo(() => items.filter(i => i.fase === faseActiva), [items, faseActiva])
  const objetivos = useMemo(() => itemsFase.filter(i => i.tipo === 'objetivo'), [itemsFase])
  const checkins = useMemo(() => itemsFase.filter(i => i.tipo === 'checkin'), [itemsFase])
  const logros = useMemo(() => itemsFase.filter(i => i.tipo === 'logro'), [itemsFase])

  const faseActual: PlanFase = diasOnboarding <= 30 ? '30' : diasOnboarding <= 60 ? '60' : '90'
  const cfg = FASES_CONFIG[faseActiva]
  const light = FASES_LIGHT[faseActiva]

  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="shimmer rounded-md h-8 w-52 mb-2" />
          <div className="shimmer rounded-md h-4 w-36 mb-6" />
          <SkeletonPlan />
        </div>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-6">
        <ErrorState mensaje="No se pudo cargar el plan." onRetry={cargarDatos} />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8 pt-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* ── Page header ── */}
        <div className="flex items-center gap-4">
          <Image src="/heero-icons3.svg" alt="" width={45} height={45} />
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">Módulo 4</p>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-gray-100 text-gray-500 border border-gray-200">
                Día {diasOnboarding} de 90
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">CopilBot</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tu roadmap de los primeros 90 días</p>
          </div>
        </div>

        {/* Card de progreso */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">
              Mi progreso global
            </span>
            <span className="text-xs text-gray-500 font-mono">
              {items.filter(i => i.completado && i.tipo === 'objetivo').length} / {items.filter(i => i.tipo === 'objetivo').length} objetivos
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
              <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                <motion.circle
                  cx="28" cy="28" r="22" fill="none"
                  stroke="url(#planProgressGrad)" strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={138.2}
                  animate={{ strokeDashoffset: 138.2 - (138.2 * porcentaje / 100) }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                />
                <defs>
                  <linearGradient id="planProgressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B4FD8" />
                    <stop offset="100%" stopColor="#0D9488" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-gray-900 leading-none">{Math.round(porcentaje)}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Progreso del plan</p>
              <p className="text-xs text-gray-500">Completá los objetivos para avanzar</p>
            </div>
          </div>
        </div>

        {/* ── Timeline de fases ── */}
        <div className="flex items-stretch gap-1">
          {FASES.map((fase, idx) => {
            const fcfg = FASES_CONFIG[fase]
            const flight = FASES_LIGHT[fase]
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
                      ? cn(flight.iconBg, flight.border)
                      : 'border-gray-200 bg-white hover:bg-gray-50',
                  )}
                >
                  {/* Dot */}
                  <div className={cn(
                    'w-2 h-2 rounded-full transition-all duration-300',
                    esFaseActual
                      ? cn(flight.dot, 'scale-125')
                      : pasada
                      ? 'bg-teal-400'
                      : activa
                      ? flight.dot
                      : 'bg-gray-300',
                  )} />
                  <span className={cn(
                    'text-[10px] font-mono font-bold leading-tight',
                    activa ? flight.iconText : 'text-gray-400',
                  )}>
                    {fcfg.label}
                  </span>
                  <span className={cn(
                    'text-[11px] font-semibold',
                    activa ? flight.iconText : 'text-gray-400',
                  )}>
                    {fcfg.titulo}
                  </span>
                  {esFaseActual && (
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      actual
                    </span>
                  )}
                </button>
                {idx < FASES.length - 1 && (
                  <div className={cn(
                    'w-3 h-px flex-shrink-0 transition-colors duration-300',
                    pasada ? 'bg-teal-400' : 'bg-gray-200',
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
            className={cn('px-4 py-2.5 rounded-xl border text-sm', light.bgBanner)}
          >
            <span className={cn('font-semibold', light.iconText)}>
              {cfg.label} — {cfg.titulo}:{' '}
            </span>
            <span className="text-gray-600">{cfg.descripcion}</span>
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
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Objetivos</h2>
                {objetivos.length > 0 && (
                  <span className="ml-auto text-xs font-mono text-gray-400">
                    {objetivos.filter(o => o.completado).length}/{objetivos.length}
                  </span>
                )}
              </div>
              {objetivos.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-2">
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
              <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-sky-500 flex-shrink-0" />
                  <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Check-ins</h2>
                </div>
                <div className="space-y-2">
                  {checkins.map(ci => <CheckinRow key={ci.id} item={ci} />)}
                </div>
              </div>
            )}

            {/* LOGROS */}
            {logros.length > 0 && (
              <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Logros</h2>
                </div>
                <div className="space-y-2">
                  {logros.map(logro => <LogroRow key={logro.id} item={logro} />)}
                </div>
              </div>
            )}

            {/* Empty state */}
            {objetivos.length === 0 && checkins.length === 0 && logros.length === 0 && (
              <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-10 text-center">
                <Map className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Tu plan para esta fase aún no fue configurado.</p>
                <p className="text-xs text-gray-300 mt-1">Hablá con tu manager o RRHH para definir tus objetivos.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  )
}
