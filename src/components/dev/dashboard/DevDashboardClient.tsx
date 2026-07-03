'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Building2, Users, MessageSquare, Layers,
  RefreshCw, TrendingUp, Bot,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useLanguage } from '@/components/LanguageProvider'
import { Badge } from '@/components/ui/Badge'
import { ErrorState } from '@/components/shared/ErrorState'
import { cargarDashboardDev } from '@/lib/dashboardDev'
import type { DatosDashboardDev, ErrorLog } from '@/lib/dashboardDev'

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24, delay: i * 0.07 },
  }),
}

// ─────────────────────────────────────────────
// Tooltip personalizado
// ─────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0F1F3D] border border-white/10 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
      <p className="text-white/50 mb-0.5">{label}</p>
      <p className="font-semibold tabular-nums">{payload[0].value}</p>
    </div>
  )
}

// ─────────────────────────────────────────────
// Metric card
// ─────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
  sub,
  index,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  sub?: string
  index: number
}) {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="show"
      className="glass-card rounded-xl p-5 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-white/45">{label}</p>
        <span className="text-amber-400/70">{icon}</span>
      </div>
      <p className="text-2xl font-semibold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-white/30">{sub}</p>}
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Dashboard (client)
// ─────────────────────────────────────────────

export function DevDashboardClient({
  datosIniciales,
  errorInicial,
}: {
  datosIniciales: DatosDashboardDev
  errorInicial: boolean
}) {
  const { t } = useLanguage()
  const [metricas, setMetricas] = useState(datosIniciales.metricas)
  const [errores, setErrores] = useState<ErrorLog[]>(datosIniciales.errores)
  const [error, setError] = useState(errorInicial)
  const [refrescando, setRefrescando] = useState(false)
  const [ultimoRefresh, setUltimoRefresh] = useState<Date>(new Date())

  const refrescar = useCallback(async () => {
    setRefrescando(true)
    try {
      const supabase = createClient()
      const datos = await cargarDashboardDev(supabase)
      setMetricas(datos.metricas)
      setErrores(datos.errores)
      setError(false)
      setUltimoRefresh(new Date())
    } catch (err) {
      console.error('Error cargando métricas dev:', err)
      setError(true)
    } finally {
      setRefrescando(false)
    }
  }, [])

  if (error) {
    return <ErrorState onRetry={refrescar} />
  }

  const m = metricas
  const ROL_COLORS: Record<string, string> = {
    empleado: 'bg-[#0EA5E9]',
    admin: 'bg-teal-500',
    dev: 'bg-amber-500',
  }

  // Datos para el BarChart de planes
  const PLAN_COLORS: Record<string, string> = {
    free: 'rgba(255,255,255,0.20)',
    starter: '#0EA5E9',
    pro: '#0D9488',
    enterprise: '#F59E0B',
  }
  const planesOrden = ['free', 'starter', 'pro', 'enterprise']
  const planesData = planesOrden
    .filter(p => (m.empresasPorPlan[p] ?? 0) > 0)
    .map(p => ({ plan: p.charAt(0).toUpperCase() + p.slice(1), empresas: m.empresasPorPlan[p] ?? 0, key: p }))

  // Si no hay datos de planes, mostrar todos en cero
  const planesDataFinal = planesData.length > 0
    ? planesData
    : planesOrden.map(p => ({ plan: p.charAt(0).toUpperCase() + p.slice(1), empresas: 0, key: p }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">{t('dev.dashTitulo')}</h1>
          <p className="text-xs text-white/30 mt-0.5">
            {t('dev.actualizado')} {ultimoRefresh.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={refrescar}
          disabled={refrescando}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-amber-400
            transition-colors duration-150 p-2 rounded-lg hover:bg-amber-500/[0.08]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refrescando ? 'animate-spin' : ''}`} />
          {t('dev.refrescar')}
        </button>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          index={0}
          label={t('dev.empresas')}
          value={m.totalEmpresas}
          icon={<Building2 className="w-4 h-4" />}
          sub={t('dev.empresasSub')}
        />
        <MetricCard
          index={1}
          label={t('dev.usuariosTotales')}
          value={m.totalUsuarios}
          icon={<Users className="w-4 h-4" />}
          sub={`${m.usuariosPorRol['empleado'] ?? 0} emp · ${m.usuariosPorRol['admin'] ?? 0} admin · ${m.usuariosPorRol['dev'] ?? 0} dev`}
        />
        <MetricCard
          index={2}
          label={t('dev.respuestasIA24h')}
          value={m.mensajesIA24h}
          icon={<Bot className="w-4 h-4" />}
          sub={t('dev.respuestasIA24hSub')}
        />
        <MetricCard
          index={3}
          label={t('dev.conversacionesIA')}
          value={m.conversacionesTotales}
          icon={<MessageSquare className="w-4 h-4" />}
          sub={t('dev.totalHistorico')}
        />
      </div>

      {/* Dos columnas: usuarios por rol + errores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Distribución por rol */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.28 }}
          className="glass-card rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400/70" />
            <h2 className="text-sm font-semibold text-white/70">{t('dev.usuariosPorRol')}</h2>
          </div>

          {m.totalUsuarios === 0 ? (
            <p className="text-xs text-white/30 py-4 text-center">{t('dev.sinUsuarios')}</p>
          ) : (
            <div className="space-y-3">
              {(['empleado', 'admin', 'dev'] as const).map(rol => {
                const count = m.usuariosPorRol[rol] ?? 0
                const pct = m.totalUsuarios > 0 ? Math.round((count / m.totalUsuarios) * 100) : 0
                return (
                  <div key={rol} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${ROL_COLORS[rol]}`} />
                        <span className="text-white/60 capitalize">{rol}</span>
                      </div>
                      <span className="text-white/40 tabular-nums">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${ROL_COLORS[rol]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* Errores recientes */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.35 }}
          className="glass-card rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-amber-400/70" />
            <h2 className="text-sm font-semibold text-white/70">{t('dev.erroresRecientes')}</h2>
            <Badge variant="warning" className="ml-auto">error_logs</Badge>
          </div>

          {errores.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-white/30">{t('dev.sinErrores')}</p>
              <p className="text-[11px] text-white/20 mt-1">
                {t('dev.tablaErrores')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {errores.map(err => (
                <div
                  key={err.id}
                  className="px-3 py-2 rounded-lg bg-red-500/[0.06] border border-red-500/[0.12]"
                >
                  <p className="text-xs text-red-300/80 line-clamp-2">{err.mensaje}</p>
                  <p className="text-[10px] text-white/25 mt-1">
                    {new Date(err.created_at).toLocaleString('es-AR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Charts section ─────────────────────────── */}

      {/* Chart 1: Actividad IA — AreaChart full width */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.42 }}
        className="glass-card rounded-xl p-5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-teal-400/70" />
          <h2 className="text-sm font-semibold text-white/70">{t('dev.actividadIA')}</h2>
          <span className="ml-auto text-[10px] text-white/25 tabular-nums">
            {t('dev.respuestasAsistente')}
          </span>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={m.mensajesPorDia} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0D9488" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#0D9488" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="dia"
              tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="mensajes"
              stroke="#0D9488"
              strokeWidth={2}
              fill="url(#tealGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#0D9488', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Charts 2 & 3: Planes + Roles side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Chart 2: Distribución por plan — BarChart vertical */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.49 }}
          className="glass-card rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-teal-400/70" />
            <h2 className="text-sm font-semibold text-white/70">{t('dev.distribucionPlan')}</h2>
          </div>

          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={planesDataFinal}
              layout="vertical"
              margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="plan"
                tick={{ fill: 'rgba(255,255,255,0.40)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={68}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="empresas" radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: 'right', fill: 'rgba(255,255,255,0.30)', fontSize: 11 }}>
                {planesDataFinal.map((entry) => (
                  <Cell key={entry.key} fill={PLAN_COLORS[entry.key] ?? 'rgba(255,255,255,0.15)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Chart 3: Rol stat cards — mantiene las barras existentes mejoradas */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.56 }}
          className="glass-card rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-teal-400/70" />
            <h2 className="text-sm font-semibold text-white/70">{t('dev.usuariosPorRol')}</h2>
            <span className="ml-auto text-[10px] text-white/25 tabular-nums">
              {m.totalUsuarios} {t('dev.total')}
            </span>
          </div>

          {m.totalUsuarios === 0 ? (
            <p className="text-xs text-white/30 py-4 text-center">{t('dev.sinUsuarios')}</p>
          ) : (
            <div className="space-y-3">
              {(
                [
                  { rol: 'empleado', label: t('dev.empleados'), color: '#0EA5E9' },
                  { rol: 'admin', label: t('dev.admins'), color: '#0D9488' },
                  { rol: 'dev', label: t('dev.devs'), color: '#F59E0B' },
                ] as const
              ).map(({ rol, label, color }) => {
                const count = m.usuariosPorRol[rol] ?? 0
                const pct = m.totalUsuarios > 0 ? Math.round((count / m.totalUsuarios) * 100) : 0
                return (
                  <div key={rol} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-white/60">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/70 font-semibold tabular-nums">{count}</span>
                        <span className="text-white/30 tabular-nums w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.6 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
