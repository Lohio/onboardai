'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Search, Building2, Filter,
  CheckCircle2, Circle, TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/utils'

interface EmpleadoRow {
  id: string; nombre: string; email: string
  puesto: string | null; area: string | null; fecha_ingreso: string | null
  empresa_id: string; empresa_nombre: string
  onboarding_pct: number
}

function formatFecha(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function EmpleadosGlobalPage() {
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas')
  const [empresas, setEmpresas] = useState<{ id: string; nombre: string }[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: empresasData }, { data: usuarios }, { data: progreso }] = await Promise.all([
        supabase.from('empresas').select('id, nombre').order('nombre'),
        supabase.from('usuarios').select('id, nombre, email, puesto, area, fecha_ingreso, empresa_id, rol').eq('rol', 'empleado').order('nombre'),
        supabase.from('progreso_modulos').select('usuario_id, completado'),
      ])

      const listaEmpresas = empresasData ?? []
      const listaUsuarios = usuarios ?? []
      const listaProgreso = progreso ?? []

      const empresaMap: Record<string, string> = {}
      for (const e of listaEmpresas) empresaMap[e.id] = e.nombre

      const progresoMap: Record<string, { total: number; ok: number }> = {}
      for (const p of listaProgreso) {
        if (!progresoMap[p.usuario_id]) progresoMap[p.usuario_id] = { total: 0, ok: 0 }
        progresoMap[p.usuario_id].total++
        if (p.completado) progresoMap[p.usuario_id].ok++
      }

      const rows: EmpleadoRow[] = listaUsuarios.map(u => {
        const prog = progresoMap[u.id]
        const pct  = prog ? Math.round(prog.ok / prog.total * 100) : 0
        return {
          id: u.id, nombre: u.nombre, email: u.email,
          puesto: u.puesto, area: u.area, fecha_ingreso: u.fecha_ingreso,
          empresa_id: u.empresa_id,
          empresa_nombre: empresaMap[u.empresa_id] ?? '—',
          onboarding_pct: pct,
        }
      })

      setEmpleados(rows)
      setEmpresas(listaEmpresas)
      setLoading(false)
    }
    load()
  }, [])

  const filtrados = empleados.filter(e => {
    if (filtroEmpresa !== 'todas' && e.empresa_id !== filtroEmpresa) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return e.nombre?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q) || e.empresa_nombre?.toLowerCase().includes(q)
    }
    return true
  })

  const completados = empleados.filter(e => e.onboarding_pct === 100).length
  const promedio    = empleados.length > 0 ? Math.round(empleados.reduce((acc, e) => acc + e.onboarding_pct, 0) / empleados.length) : 0

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Empleados</h1>
          <p className="text-sm text-white/40 mt-0.5">Todos los empleados de todas las empresas</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl border border-teal-500/20 bg-teal-600/8 px-4 py-2 text-center">
            <p className="text-xl font-bold text-white">{completados}</p>
            <p className="text-[10px] text-teal-400/70">Completaron 100%</p>
          </div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-600/8 px-4 py-2 text-center">
            <p className="text-xl font-bold text-white">{promedio}%</p>
            <p className="text-[10px] text-violet-400/70">Promedio global</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar empleado, email, empresa..."
            className="w-full h-9 pl-9 pr-3 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white/85 placeholder:text-white/25 outline-none focus:border-violet-500/50 transition-colors" />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-white/30" />
          <select value={filtroEmpresa} onChange={e => setFiltroEmpresa(e.target.value)}
            className="h-9 px-3 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white/70 outline-none focus:border-violet-500/50 transition-colors cursor-pointer">
            <option value="todas" className="bg-[#0a0614]">Todas las empresas</option>
            {empresas.map(e => <option key={e.id} value={e.id} className="bg-[#0a0614]">{e.nombre}</option>)}
          </select>
        </div>

        <span className="text-xs text-white/30 ml-auto">{filtrados.length} empleados</span>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="grid grid-cols-[1fr_180px_140px_160px_80px] gap-4 px-5 py-3 border-b border-white/[0.06]">
          {['Empleado', 'Empresa', 'Puesto', 'Ingreso', 'Onboarding'].map(h => (
            <span key={h} className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">{h}</span>
          ))}
        </div>

        {loading && (
          <div className="divide-y divide-white/[0.04]">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_180px_140px_160px_80px] gap-4 px-5 py-4 animate-pulse">
                <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-white/[0.04]" /><div className="space-y-1.5"><div className="h-2.5 w-28 rounded bg-white/[0.04]" /><div className="h-2 w-36 rounded bg-white/[0.04]" /></div></div>
                {[...Array(4)].map((_, j) => <div key={j} className="h-3 w-24 rounded bg-white/[0.04] self-center" />)}
              </div>
            ))}
          </div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="divide-y divide-white/[0.04]">
          {!loading && filtrados.length === 0 && (
            <div className="py-16 text-center">
              <Users className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/30">No se encontraron empleados</p>
            </div>
          )}
          {filtrados.map(e => (
            <div key={e.id} className="grid grid-cols-[1fr_180px_140px_160px_80px] gap-4 px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors">
              {/* Nombre */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-indigo-600/25 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-300 text-[11px] font-bold">{e.nombre?.slice(0, 2).toUpperCase() || 'E'}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white/85 truncate">{e.nombre}</p>
                  <p className="text-[11px] text-white/35 truncate">{e.email}</p>
                </div>
              </div>
              {/* Empresa */}
              <div className="flex items-center gap-1.5 min-w-0">
                <Building2 className="w-3.5 h-3.5 text-violet-400/60 flex-shrink-0" />
                <span className="text-xs text-white/55 truncate">{e.empresa_nombre}</span>
              </div>
              {/* Puesto */}
              <span className="text-xs text-white/40 truncate">{e.puesto || '—'}</span>
              {/* Ingreso */}
              <span className="text-xs text-white/35">{formatFecha(e.fecha_ingreso)}</span>
              {/* Onboarding */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <ProgressBar value={e.onboarding_pct} showPercentage={false} />
                </div>
                {e.onboarding_pct === 100
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                  : <Circle className={cn('w-3.5 h-3.5 flex-shrink-0', e.onboarding_pct > 0 ? 'text-indigo-400/60' : 'text-white/15')} />
                }
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Summary */}
      {!loading && empleados.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-white/25">
          <TrendingUp className="w-3.5 h-3.5" />
          {empleados.length} empleados en {empresas.length} empresas · Promedio de onboarding: {promedio}%
        </div>
      )}
    </div>
  )
}
