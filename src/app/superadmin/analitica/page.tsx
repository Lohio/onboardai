'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3, TrendingUp, Building2, Users,
  BookOpen, Wrench, MessageSquare, CheckCircle2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { ProgressBar } from '@/components/ui/ProgressBar'

interface EmpresaStats {
  id: string; nombre: string; empleados: number
  m2: number; m3: number; m4: number; promedio: number
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } }
const item      = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 24 } } }

export default function AnaliticaPage() {
  const [stats, setStats] = useState<EmpresaStats[]>([])
  const [loading, setLoading] = useState(true)
  const [globalStats, setGlobalStats] = useState({ empleados: 0, empresas: 0, m2Pct: 0, m3Pct: 0, m4Pct: 0 })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: empresas }, { data: usuarios }, { data: progreso }] = await Promise.all([
        supabase.from('empresas').select('id, nombre').order('nombre'),
        supabase.from('usuarios').select('id, empresa_id, rol').eq('rol', 'empleado'),
        supabase.from('progreso_modulos').select('usuario_id, modulo, completado'),
      ])

      const listaEmpresas = empresas ?? []
      const listaUsuarios = usuarios ?? []
      const listaProgreso = progreso ?? []

      const empleadosPorEmpresa: Record<string, string[]> = {}
      for (const u of listaUsuarios) {
        if (!empleadosPorEmpresa[u.empresa_id]) empleadosPorEmpresa[u.empresa_id] = []
        empleadosPorEmpresa[u.empresa_id].push(u.id)
      }

      function pctModulo(empleadosIds: string[], modulo: string): number {
        const bloques = listaProgreso.filter(p => empleadosIds.includes(p.usuario_id) && p.modulo === modulo)
        if (!bloques.length) return 0
        return Math.round(bloques.filter(b => b.completado).length / bloques.length * 100)
      }

      const statsLista: EmpresaStats[] = listaEmpresas.map(e => {
        const ids  = empleadosPorEmpresa[e.id] ?? []
        const m2 = pctModulo(ids, 'cultura')
        const m3 = pctModulo(ids, 'rol')
        const m4 = pctModulo(ids, 'asistente')
        const promedio = ids.length > 0 ? Math.round((m2 + m3 + m4) / 3) : 0
        return { id: e.id, nombre: e.nombre, empleados: ids.length, m2, m3, m4, promedio }
      })

      const totalEmpleados = listaUsuarios.length
      const m2Pct = statsLista.length ? Math.round(statsLista.reduce((a, e) => a + e.m2, 0) / statsLista.length) : 0
      const m3Pct = statsLista.length ? Math.round(statsLista.reduce((a, e) => a + e.m3, 0) / statsLista.length) : 0
      const m4Pct = statsLista.length ? Math.round(statsLista.reduce((a, e) => a + e.m4, 0) / statsLista.length) : 0

      setStats(statsLista)
      setGlobalStats({ empleados: totalEmpleados, empresas: listaEmpresas.length, m2Pct, m3Pct, m4Pct })
      setLoading(false)
    }
    load()
  }, [])

  const modulos = [
    { key: 'm2', label: 'M2 — Cultura',  icon: BookOpen,      color: 'text-[#38BDF8]', bar: '#6366f1', pct: globalStats.m2Pct },
    { key: 'm3', label: 'M3 — Rol',      icon: Wrench,        color: 'text-teal-400',   bar: '#14b8a6', pct: globalStats.m3Pct },
    { key: 'm4', label: 'M4 — Asistente',icon: MessageSquare, color: 'text-amber-400',  bar: '#f59e0b', pct: globalStats.m4Pct },
  ]

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-white">Analítica global</h1>
        <p className="text-sm text-white/40 mt-0.5">Métricas de onboarding de todo el ecosistema</p>
      </motion.div>

      {/* Global KPIs de módulos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {modulos.map(mod => (
          <motion.div key={mod.key} variants={item}
            className="rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center gap-2 mb-4">
              <mod.icon className={`w-4 h-4 ${mod.color}`} />
              <span className={`text-xs font-semibold ${mod.color}`}>{mod.label}</span>
            </div>
            <p className="text-4xl font-bold text-white mb-2">{loading ? '—' : `${mod.pct}%`}</p>
            <ProgressBar value={loading ? 0 : mod.pct} showPercentage={false} animated />
            <p className="text-xs text-white/30 mt-2">Promedio global en todas las empresas</p>
          </motion.div>
        ))}
      </div>

      {/* Resumen global */}
      <motion.div variants={item} className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-violet-500/20 bg-violet-600/8 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{loading ? '—' : globalStats.empresas}</p>
            <p className="text-xs text-violet-400/70">Empresas activas</p>
          </div>
        </div>
        <div className="rounded-2xl border border-[#0EA5E9]/15 bg-[#0EA5E9]/[0.08] p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#0EA5E9]/12 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-[#38BDF8]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{loading ? '—' : globalStats.empleados}</p>
            <p className="text-xs text-[#38BDF8]/70">Empleados en onboarding</p>
          </div>
        </div>
      </motion.div>

      {/* Tabla de empresas con progreso */}
      <motion.div variants={item} className="rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
          <TrendingUp className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-white/80">Progreso por empresa</h2>
        </div>

        {/* Header tabla */}
        <div className="grid grid-cols-[1fr_80px_120px_120px_120px_100px] gap-4 px-5 py-3 border-b border-white/[0.04]">
          {['Empresa', 'Empl.', 'M2 Cultura', 'M3 Rol', 'M4 Asist.', 'Promedio'].map(h => (
            <span key={h} className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">{h}</span>
          ))}
        </div>

        {loading && (
          <div className="divide-y divide-white/[0.04]">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_120px_120px_120px_100px] gap-4 px-5 py-4 animate-pulse">
                <div className="h-3 w-36 rounded bg-white/[0.04]" />
                {[...Array(5)].map((_, j) => <div key={j} className="h-5 rounded-full bg-white/[0.04]" />)}
              </div>
            ))}
          </div>
        )}

        <div className="divide-y divide-white/[0.04]">
          {!loading && stats.length === 0 && (
            <div className="py-12 text-center">
              <BarChart3 className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/30">Sin datos de progreso aún</p>
            </div>
          )}
          {stats.map(e => (
            <div key={e.id} className="grid grid-cols-[1fr_80px_120px_120px_120px_100px] gap-4 px-5 py-4 items-center hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-violet-600/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <span className="text-sm font-medium text-white/80 truncate">{e.nombre}</span>
              </div>
              <span className="text-sm text-white/50 flex items-center gap-1.5"><Users className="w-3 h-3 text-white/20" />{e.empleados}</span>
              {/* M2, M3, M4 */}
              {([e.m2, e.m3, e.m4] as number[]).map((pct, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1"><ProgressBar value={pct} showPercentage={false} /></div>
                  <span className="text-xs text-white/40 w-8 text-right">{pct}%</span>
                </div>
              ))}
              {/* Promedio */}
              <div className="flex items-center gap-2">
                {e.promedio === 100
                  ? <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
                  : <span className={`text-sm font-semibold ${e.promedio >= 70 ? 'text-teal-400' : e.promedio >= 40 ? 'text-amber-400' : 'text-white/50'}`}>{e.promedio}%</span>
                }
              </div>
            </div>
          ))}
        </div>
      </motion.div>

    </motion.div>
  )
}
