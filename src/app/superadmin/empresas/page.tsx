'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Building2, Plus, Search, ArrowRight,
  Users, CheckCircle2, XCircle, Filter,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Empresa {
  id: string; nombre: string; plan: string | null
  activa: boolean | null; created_at: string | null
  empleados: number; admins: number
}

type FiltroActiva = 'todas' | 'activa' | 'inactiva'
type FiltroPlan   = 'todos' | 'free' | 'pro' | 'enterprise'

function planBadge(plan: string | null) {
  const cfg: Record<string, string> = {
    free:       'bg-white/[0.06] text-white/40 border-white/[0.08]',
    pro:        'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
    enterprise: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  }
  const p = plan ?? 'free'
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${cfg[p] ?? cfg.free}`}>
      {p}
    </span>
  )
}

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroActiva, setFiltroActiva] = useState<FiltroActiva>('todas')
  const [filtroPlan, setFiltroPlan] = useState<FiltroPlan>('todos')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: empresasData } = await supabase
        .from('empresas')
        .select('id, nombre, plan, activa, created_at')
        .order('created_at', { ascending: false })

      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('empresa_id, rol')

      type EmpresaDB = { id: string; nombre: string; plan: string | null; activa: boolean | null; created_at: string | null }
      const lista = (empresasData as EmpresaDB[] ?? []).map((e) => ({
        ...e,
        empleados: (usuariosData ?? []).filter((u: { empresa_id: string; rol: string }) => u.empresa_id === e.id && u.rol === 'empleado').length,
        admins:    (usuariosData ?? []).filter((u: { empresa_id: string; rol: string }) => u.empresa_id === e.id && ['admin', 'dev'].includes(u.rol)).length,
      }))
      setEmpresas(lista)
      setLoading(false)
    }
    load()
  }, [])

  const filtradas = empresas.filter(e => {
    if (busqueda && !e.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    if (filtroActiva === 'activa'   && e.activa === false) return false
    if (filtroActiva === 'inactiva' && e.activa !== false) return false
    if (filtroPlan !== 'todos' && (e.plan ?? 'free') !== filtroPlan) return false
    return true
  })

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Empresas</h1>
          <p className="text-sm text-white/40 mt-0.5">{empresas.length} empresas registradas en el sistema</p>
        </div>
        <Link
          href="/superadmin/empresas/nueva"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors shadow-[0_0_20px_rgba(139,92,246,0.3)]"
        >
          <Plus className="w-3.5 h-3.5" />
          Nueva empresa
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar empresa..."
            className="w-full h-9 pl-9 pr-3 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white/85 placeholder:text-white/25 outline-none focus:border-violet-500/50 transition-colors"
          />
        </div>

        {/* Filtro estado */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.07]">
          {(['todas', 'activa', 'inactiva'] as FiltroActiva[]).map(f => (
            <button key={f} onClick={() => setFiltroActiva(f)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', filtroActiva === f ? 'bg-violet-600/30 text-violet-300' : 'text-white/40 hover:text-white/70')}>
              {f === 'todas' ? 'Todas' : f === 'activa' ? 'Activas' : 'Inactivas'}
            </button>
          ))}
        </div>

        {/* Filtro plan */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.07]">
          <Filter className="w-3 h-3 text-white/25 ml-1" />
          {(['todos', 'free', 'pro', 'enterprise'] as FiltroPlan[]).map(f => (
            <button key={f} onClick={() => setFiltroPlan(f)}
              className={cn('px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all', filtroPlan === f ? 'bg-violet-600/30 text-violet-300' : 'text-white/40 hover:text-white/70')}>
              {f === 'todos' ? 'Todos' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_80px] gap-4 px-5 py-3 border-b border-white/[0.06]">
          {['Empresa', 'Plan', 'Empleados', 'Admins', 'Estado'].map(h => (
            <span key={h} className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">{h}</span>
          ))}
        </div>

        {loading && (
          <div className="divide-y divide-white/[0.04]">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_80px] gap-4 px-5 py-4 animate-pulse">
                <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-white/[0.04]" /><div className="h-3 w-36 rounded bg-white/[0.04]" /></div>
                {[...Array(4)].map((_, j) => <div key={j} className="h-4 w-16 rounded bg-white/[0.04]" />)}
              </div>
            ))}
          </div>
        )}

        {!loading && filtradas.length === 0 && (
          <div className="py-16 text-center">
            <Building2 className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">No se encontraron empresas</p>
            <Link href="/superadmin/empresas/nueva" className="inline-flex items-center gap-1.5 mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors">
              <Zap className="w-3 h-3" /> Crear empresa nueva
            </Link>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="divide-y divide-white/[0.04]"
        >
          {filtradas.map(empresa => (
            <Link
              key={empresa.id}
              href={`/superadmin/empresas/${empresa.id}`}
              className="grid grid-cols-[1fr_auto_auto_auto_80px] gap-4 px-5 py-4 items-center hover:bg-white/[0.02] transition-colors group"
            >
              {/* Nombre */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-violet-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/85 truncate group-hover:text-white transition-colors">{empresa.nombre}</p>
                  <p className="text-[10px] text-white/25 font-mono truncate">{empresa.id.slice(0, 8)}…</p>
                </div>
              </div>
              {/* Plan */}
              <div>{planBadge(empresa.plan)}</div>
              {/* Empleados */}
              <div className="flex items-center gap-1.5 text-sm text-white/60">
                <Users className="w-3.5 h-3.5 text-white/25" />
                {empresa.empleados}
              </div>
              {/* Admins */}
              <div className="text-sm text-white/60">{empresa.admins}</div>
              {/* Estado */}
              <div className="flex items-center gap-2">
                {empresa.activa !== false
                  ? <><CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /><span className="text-xs text-teal-400">Activa</span></>
                  : <><XCircle className="w-3.5 h-3.5 text-white/25" /><span className="text-xs text-white/30">Inactiva</span></>
                }
                <ArrowRight className="w-3.5 h-3.5 text-white/15 group-hover:text-violet-400 transition-colors ml-auto" />
              </div>
            </Link>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
