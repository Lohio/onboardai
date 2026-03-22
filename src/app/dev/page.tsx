'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Building2, Users, MessageSquare, Layers,
  RefreshCw, TrendingUp, Bot,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import type { UserRole } from '@/types'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface Metricas {
  totalEmpresas: number
  totalUsuarios: number
  usuariosPorRol: Record<string, number>
  mensajesIA24h: number
  conversacionesTotales: number
}

interface ErrorLog {
  id: string
  mensaje: string
  created_at: string
}

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
// Dashboard
// ─────────────────────────────────────────────

export default function DevDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [errores, setErrores] = useState<ErrorLog[]>([])
  const [ultimoRefresh, setUltimoRefresh] = useState<Date>(new Date())

  const cargarMetricas = useCallback(async () => {
    try {
      const supabase = createClient()

      // Verificar rol dev
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()

      if (!userData || userData.rol !== 'dev') {
        router.push(userData?.rol === 'admin' ? '/admin' : '/empleado/perfil')
        return
      }

      // ── Queries paralelas ──────────────────────────────────

      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const [
        { count: totalEmpresas },
        { data: rolData },
        { count: mensajesIA24h },
        { count: conversacionesTotales },
      ] = await Promise.all([
        supabase.from('empresas').select('*', { count: 'exact', head: true }),
        supabase.from('usuarios').select('rol'),
        supabase
          .from('mensajes_ia')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', hace24h)
          .eq('rol', 'assistant'),
        supabase.from('conversaciones_ia').select('*', { count: 'exact', head: true }),
      ])

      // Calcular usuarios por rol
      const porRol: Record<string, number> = {}
      for (const u of (rolData ?? [])) {
        const r = u.rol as UserRole
        porRol[r] = (porRol[r] ?? 0) + 1
      }

      setMetricas({
        totalEmpresas: totalEmpresas ?? 0,
        totalUsuarios: (rolData ?? []).length,
        usuariosPorRol: porRol,
        mensajesIA24h: mensajesIA24h ?? 0,
        conversacionesTotales: conversacionesTotales ?? 0,
      })

      // Errores recientes (tabla puede no existir)
      try {
        const { data: errorData } = await supabase
          .from('error_logs')
          .select('id, mensaje, created_at')
          .order('created_at', { ascending: false })
          .limit(5)
        setErrores((errorData ?? []) as ErrorLog[])
      } catch {
        // tabla error_logs no existe — se omite silenciosamente
      }

      setUltimoRefresh(new Date())
    } catch (err) {
      console.error('Error cargando métricas dev:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { cargarMetricas() }, [cargarMetricas])

  // ─────────────────────────────────────────────
  // Skeleton
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-40 bg-white/[0.06] rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-white/[0.04] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const m = metricas!
  const ROL_COLORS: Record<string, string> = {
    empleado: 'bg-[#0EA5E9]',
    admin: 'bg-teal-500',
    dev: 'bg-amber-500',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Dev Dashboard</h1>
          <p className="text-xs text-white/30 mt-0.5">
            Actualizado {ultimoRefresh.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); cargarMetricas() }}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-amber-400
            transition-colors duration-150 p-2 rounded-lg hover:bg-amber-500/[0.08]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refrescar
        </button>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          index={0}
          label="Empresas"
          value={m.totalEmpresas}
          icon={<Building2 className="w-4 h-4" />}
          sub="Registradas en el sistema"
        />
        <MetricCard
          index={1}
          label="Usuarios totales"
          value={m.totalUsuarios}
          icon={<Users className="w-4 h-4" />}
          sub={`${m.usuariosPorRol['empleado'] ?? 0} emp · ${m.usuariosPorRol['admin'] ?? 0} admin · ${m.usuariosPorRol['dev'] ?? 0} dev`}
        />
        <MetricCard
          index={2}
          label="Respuestas IA (24h)"
          value={m.mensajesIA24h}
          icon={<Bot className="w-4 h-4" />}
          sub="Mensajes del asistente"
        />
        <MetricCard
          index={3}
          label="Conversaciones IA"
          value={m.conversacionesTotales}
          icon={<MessageSquare className="w-4 h-4" />}
          sub="Total histórico"
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
            <h2 className="text-sm font-semibold text-white/70">Usuarios por rol</h2>
          </div>

          {m.totalUsuarios === 0 ? (
            <p className="text-xs text-white/30 py-4 text-center">Sin usuarios registrados</p>
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
            <h2 className="text-sm font-semibold text-white/70">Errores recientes</h2>
            <Badge variant="warning" className="ml-auto">error_logs</Badge>
          </div>

          {errores.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-white/30">Sin errores registrados</p>
              <p className="text-[11px] text-white/20 mt-1">
                Tabla error_logs no encontrada o vacía
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
    </div>
  )
}
