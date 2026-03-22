'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Building2, Users, TrendingUp, AlertCircle,
  ArrowRight, CheckCircle2, Clock, Zap,
  Globe, BarChart3, ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface KPI { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }
interface EmpresaRow {
  id: string; nombre: string; plan: string | null; activa: boolean | null
  empleados_count: number; onboarding_pct: number
}
interface ActividadRow { id: string; accion: string; created_at: string; empresa_nombre: string }

// ─────────────────────────────────────────────
// Animations
// ─────────────────────────────────────────────

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } }
const item      = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 24 } } }

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 60)   return `hace ${min}m`
  const h = Math.floor(min / 60)
  if (h < 24)     return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

function planBadge(plan: string | null) {
  const cfg: Record<string, string> = {
    free:       'bg-white/[0.06] text-white/40 border-white/[0.08]',
    pro:        'bg-[#0EA5E9]/10 text-[#7DD3FC] border-[#0EA5E9]/20',
    enterprise: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  }
  const p = plan ?? 'free'
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${cfg[p] ?? cfg.free}`}>
      {p}
    </span>
  )
}

// ─────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────

function KpiCard({ kpi }: { kpi: KPI }) {
  return (
    <motion.div variants={item} className={`rounded-2xl border p-5 ${kpi.color}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-medium text-white/40 uppercase tracking-widest mb-1">{kpi.label}</p>
          <p className="text-3xl font-bold text-white">{kpi.value}</p>
          {kpi.sub && <p className="text-xs text-white/35 mt-1">{kpi.sub}</p>}
        </div>
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/[0.08] flex items-center justify-center text-white/50">
          {kpi.icon}
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────

export default function SuperadminDashboard() {
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([])
  const [actividad, setActividad] = useState<ActividadRow[]>([])
  const [kpis, setKpis] = useState({ empresas: 0, empleados: 0, onboardingPct: 0, alertas: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      // Datos de empresas
      const { data: empresasData } = await supabase
        .from('empresas')
        .select('id, nombre, plan, activa')
        .order('created_at', { ascending: false })

      // Empleados por empresa
      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('empresa_id, rol')
        .eq('rol', 'empleado')

      // Progreso global
      const { data: progresoData } = await supabase
        .from('progreso_modulos')
        .select('completado')

      // Alertas sin resolver
      const { count: alertasCount } = await supabase
        .from('alertas_conocimiento')
        .select('*', { count: 'exact', head: true })
        .eq('resuelta', false)

      // Actividad reciente
      const { data: actividadData } = await supabase
        .from('actividad_log')
        .select('id, accion, created_at, empresa_id')
        .order('created_at', { ascending: false })
        .limit(10)

      const empresasList = (empresasData ?? []) as EmpresaRow[]
      const usuarios = usuariosData ?? []
      const progreso = progresoData ?? []

      // Calcular empleados por empresa
      const empleadosPorEmpresa: Record<string, number> = {}
      for (const u of usuarios) {
        if (u.empresa_id) {
          empleadosPorEmpresa[u.empresa_id] = (empleadosPorEmpresa[u.empresa_id] ?? 0) + 1
        }
      }

      const empresasEnriquecidas = empresasList.map(e => ({
        ...e,
        empleados_count: empleadosPorEmpresa[e.id] ?? 0,
        onboarding_pct: 0,
      }))

      const totalEmpleados = usuarios.length
      const totalCompletados = progreso.filter(p => p.completado).length
      const totalBloques = progreso.length
      const pct = totalBloques > 0 ? Math.round(totalCompletados / totalBloques * 100) : 0

      setEmpresas(empresasEnriquecidas.slice(0, 6))
      setKpis({
        empresas:      empresasList.length,
        empleados:     totalEmpleados,
        onboardingPct: pct,
        alertas:       alertasCount ?? 0,
      })

      // Actividad con nombre de empresa
      const actividadConNombre = (actividadData ?? []).map((a: { id: string; accion: string; created_at: string; empresa_id: string }) => ({
        id:             a.id,
        accion:         a.accion,
        created_at:     a.created_at,
        empresa_nombre: empresasList.find(e => e.id === a.empresa_id)?.nombre ?? '—',
      }))
      setActividad(actividadConNombre)
      setLoading(false)
    }
    load()
  }, [])

  const KPIS: KPI[] = [
    {
      label: 'Empresas',
      value: kpis.empresas,
      sub:   'activas en el sistema',
      icon: <Building2 className="w-5 h-5" />,
      color: 'border-violet-500/25 bg-violet-600/8',
    },
    {
      label: 'Empleados',
      value: kpis.empleados,
      sub:   'en toda la plataforma',
      icon: <Users className="w-5 h-5" />,
      color: 'border-[#0EA5E9]/20 bg-[#0EA5E9]/[0.08]',
    },
    {
      label: 'Onboarding global',
      value: `${kpis.onboardingPct}%`,
      sub:   'promedio de completado',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'border-teal-500/25 bg-teal-600/8',
    },
    {
      label: 'Alertas activas',
      value: kpis.alertas,
      sub:   'sin resolver',
      icon: <AlertCircle className="w-5 h-5" />,
      color: kpis.alertas > 0 ? 'border-amber-500/25 bg-amber-600/8' : 'border-white/[0.07] bg-white/[0.02]',
    },
  ]

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />)}
      </div>
      <div className="h-64 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
    </div>
  )

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <motion.div variants={item} className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-violet-400" />
            <span className="text-[11px] font-medium text-violet-400/70 uppercase tracking-widest">Vista global</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Dashboard del ecosistema</h1>
          <p className="text-sm text-white/40 mt-0.5">Supervisión completa de todas las empresas y empleados</p>
        </div>
        <Link
          href="/superadmin/empresas/nueva"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors shadow-[0_0_20px_rgba(139,92,246,0.3)]"
        >
          <Building2 className="w-3.5 h-3.5" />
          Nueva empresa
        </Link>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map(kpi => <KpiCard key={kpi.label} kpi={kpi} />)}
      </div>

      {/* Empresas recientes + Actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Empresas */}
        <motion.div variants={item} className="lg:col-span-2 rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-white/80">Empresas recientes</h2>
            </div>
            <Link href="/superadmin/empresas" className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {empresas.length === 0 && (
              <div className="py-10 text-center">
                <Building2 className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-sm text-white/30">No hay empresas registradas</p>
                <Link href="/superadmin/empresas/nueva" className="inline-flex items-center gap-1.5 mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  <Zap className="w-3 h-3" /> Crear la primera empresa
                </Link>
              </div>
            )}
            {empresas.map(empresa => (
              <Link
                key={empresa.id}
                href={`/superadmin/empresas/${empresa.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors group"
              >
                <div className="w-8 h-8 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/85 truncate group-hover:text-white transition-colors">{empresa.nombre}</p>
                  <p className="text-xs text-white/35 mt-0.5">{empresa.empleados_count} empleados</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {planBadge(empresa.plan)}
                  <span className={`w-2 h-2 rounded-full ${empresa.activa !== false ? 'bg-teal-400' : 'bg-white/20'}`} />
                  <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-violet-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Actividad */}
        <motion.div variants={item} className="rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
            <Clock className="w-4 h-4 text-white/40" />
            <h2 className="text-sm font-semibold text-white/80">Actividad reciente</h2>
          </div>
          <div className="p-4 space-y-1">
            {actividad.length === 0 && (
              <p className="text-sm text-white/25 py-6 text-center">Sin actividad registrada</p>
            )}
            {actividad.map(a => (
              <div key={a.id} className="flex items-start gap-2.5 py-2.5 border-b border-white/[0.04] last:border-0">
                <div className="w-6 h-6 rounded-full bg-violet-600/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/65 leading-snug">{a.accion}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{a.empresa_nombre} · {tiempoRelativo(a.created_at)}</p>
                </div>
              </div>
            ))}
            {actividad.length === 0 && (
              <div className="mt-2 p-3 rounded-xl border border-violet-500/15 bg-violet-600/5">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-xs font-medium text-violet-300">Sin logs aún</span>
                </div>
                <p className="text-[10px] text-white/30">La actividad se registrará automáticamente cuando los admins realicen acciones.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Panel de accesos rápidos */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/superadmin/empleados', label: 'Ver todos los empleados', sub: 'Cross-empresa', icon: Users, color: 'text-[#38BDF8]', bg: 'bg-[#0EA5E9]/10 border-[#0EA5E9]/15' },
          { href: '/superadmin/analitica', label: 'Analítica global',          sub: 'Métricas y gráficos', icon: BarChart3, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
          { href: '/superadmin/configuracion', label: 'Configuración',          sub: 'Planes y gestión', icon: ShieldCheck, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
        ].map(card => (
          <Link key={card.href} href={card.href}
            className="flex items-center gap-4 p-4 rounded-2xl border border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.04] transition-all group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${card.bg} ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{card.label}</p>
              <p className="text-xs text-white/35">{card.sub}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/60 ml-auto transition-colors" />
          </Link>
        ))}
      </motion.div>

    </motion.div>
  )
}
