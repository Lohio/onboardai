'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Building2, ArrowLeft, Users, ShieldCheck,
  CheckCircle2, XCircle, Edit3, Save, X,
  BarChart3, Zap, Circle, BookOpen, Wrench,
  MessageSquare, RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/utils'

interface EmpresaDetalle {
  id: string; nombre: string; plan: string | null
  activa: boolean | null; created_at: string | null
  logo_url: string | null; max_empleados: number | null
}
interface UsuarioRow {
  id: string; nombre: string; email: string; rol: string
  puesto: string | null; area: string | null; fecha_ingreso: string | null
}
interface ProgresoRow { modulo: string; completado: boolean }

const PLAN_OPTIONS = ['free', 'pro', 'enterprise']

function planBadge(plan: string | null) {
  const cfg: Record<string, string> = {
    free:       'bg-white/[0.06] text-white/40 border-white/[0.08]',
    pro:        'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
    enterprise: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  }
  const p = plan ?? 'free'
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${cfg[p] ?? cfg.free}`}>
      {p}
    </span>
  )
}

function calcPct(progreso: ProgresoRow[]): number {
  if (!progreso.length) return 0
  return Math.round(progreso.filter(p => p.completado).length / progreso.length * 100)
}

export default function EmpresaDetallePage() {
  const { id } = useParams<{ id: string }>()
  const [empresa, setEmpresa] = useState<EmpresaDetalle | null>(null)
  const [empleados, setEmpleados] = useState<UsuarioRow[]>([])
  const [admins, setAdmins]       = useState<UsuarioRow[]>([])
  const [progreso, setProgreso]   = useState<Record<string, ProgresoRow[]>>({})
  const [loading, setLoading]     = useState(true)
  const [editando, setEditando]   = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ nombre: '', plan: 'free', max_empleados: 10 })

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const [{ data: emp }, { data: usuarios }, { data: prog }] = await Promise.all([
      supabase.from('empresas').select('id,nombre,plan,activa,created_at,logo_url,max_empleados').eq('id', id).single(),
      supabase.from('usuarios').select('id,nombre,email,rol,puesto,area,fecha_ingreso').eq('empresa_id', id),
      supabase.from('progreso_modulos').select('usuario_id,modulo,completado').in(
        'usuario_id',
        (await supabase.from('usuarios').select('id').eq('empresa_id', id).eq('rol', 'empleado')).data?.map(u => u.id) ?? []
      ),
    ])
    if (!emp) return
    setEmpresa(emp as EmpresaDetalle)
    setForm({ nombre: emp.nombre ?? '', plan: emp.plan ?? 'free', max_empleados: emp.max_empleados ?? 10 })
    setEmpleados((usuarios ?? []).filter(u => u.rol === 'empleado') as UsuarioRow[])
    setAdmins((usuarios ?? []).filter(u => ['admin', 'dev'].includes(u.rol)) as UsuarioRow[])
    const progresoMap: Record<string, ProgresoRow[]> = {}
    for (const p of prog ?? []) {
      if (!progresoMap[p.usuario_id]) progresoMap[p.usuario_id] = []
      progresoMap[p.usuario_id].push(p)
    }
    setProgreso(progresoMap)
    setLoading(false)
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  async function guardarEmpresa() {
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase.from('empresas').update({
      nombre: form.nombre.trim(),
      plan:   form.plan,
      max_empleados: form.max_empleados,
    }).eq('id', id)
    if (error) { toast.error('Error al guardar'); setGuardando(false); return }
    toast.success('Empresa actualizada')
    setEmpresa(prev => prev ? { ...prev, nombre: form.nombre, plan: form.plan, max_empleados: form.max_empleados } : prev)
    setEditando(false)
    setGuardando(false)
  }

  async function toggleActiva() {
    if (!empresa) return
    const nuevoEstado = empresa.activa === false
    const supabase = createClient()
    await supabase.from('empresas').update({ activa: nuevoEstado }).eq('id', id)
    setEmpresa(prev => prev ? { ...prev, activa: nuevoEstado } : prev)
    toast.success(nuevoEstado ? 'Empresa activada' : 'Empresa suspendida')
  }

  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-5 animate-pulse">
      <div className="h-36 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="h-64 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
        <div className="h-64 rounded-2xl bg-white/[0.04] border border-white/[0.06]" />
      </div>
    </div>
  )

  if (!empresa) return (
    <div className="text-center py-20">
      <Building2 className="w-10 h-10 text-white/10 mx-auto mb-3" />
      <p className="text-white/40">Empresa no encontrada</p>
      <Link href="/superadmin/empresas" className="text-violet-400 text-sm mt-2 inline-block hover:text-violet-300">← Volver</Link>
    </div>
  )

  const modulosConfig = [
    { key: 'cultura',   label: 'M2 — Cultura',    icon: BookOpen,       color: 'text-indigo-400' },
    { key: 'rol',       label: 'M3 — Rol',         icon: Wrench,         color: 'text-teal-400'   },
    { key: 'asistente', label: 'M4 — Asistente',   icon: MessageSquare,  color: 'text-amber-400'  },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Nav volver */}
      <Link href="/superadmin/empresas" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Empresas
      </Link>

      {/* Header empresa */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: 'rgba(139,92,246,0.2)', background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(10,6,20,0.6) 100%)' }}
      >
        <div className="p-6 flex flex-wrap items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-7 h-7 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            {editando ? (
              <input
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="text-xl font-bold bg-transparent border-b border-violet-500/40 text-white outline-none pb-1 w-full max-w-sm"
              />
            ) : (
              <h1 className="text-xl font-bold text-white">{empresa.nombre}</h1>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {editando ? (
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                  className="text-xs bg-white/[0.06] border border-white/[0.10] text-white/80 rounded-lg px-2 py-1 outline-none">
                  {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : planBadge(empresa.plan)}
              <span className={cn('flex items-center gap-1 text-xs font-medium', empresa.activa !== false ? 'text-teal-400' : 'text-white/30')}>
                {empresa.activa !== false ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {empresa.activa !== false ? 'Activa' : 'Inactiva'}
              </span>
              <span className="text-xs text-white/25 font-mono">{id.slice(0, 12)}…</span>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {editando ? (
              <>
                <button onClick={() => setEditando(false)} className="p-2 rounded-xl text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
                  <X className="w-4 h-4" />
                </button>
                <button onClick={guardarEmpresa} disabled={guardando}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-500 transition-colors disabled:opacity-60">
                  <Save className="w-3.5 h-3.5" />
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditando(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white/50 hover:text-white/80 hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium transition-all">
                  <Edit3 className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={toggleActiva}
                  className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all',
                    empresa.activa !== false
                      ? 'text-red-400 border-red-500/25 hover:bg-red-500/10'
                      : 'text-teal-400 border-teal-500/25 hover:bg-teal-500/10'
                  )}>
                  <Zap className="w-3.5 h-3.5" />
                  {empresa.activa !== false ? 'Suspender' : 'Activar'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-3 border-t border-white/[0.06] divide-x divide-white/[0.06]">
          {[
            { label: 'Empleados',   value: empleados.length, icon: Users },
            { label: 'Admins',      value: admins.length,    icon: ShieldCheck },
            { label: 'Onboarding',  value: `${empleados.length > 0 ? Math.round(Object.values(progreso).reduce((acc, p) => acc + calcPct(p), 0) / empleados.length) : 0}%`, icon: BarChart3 },
          ].map(m => (
            <div key={m.label} className="px-5 py-4 flex items-center gap-3">
              <m.icon className="w-4 h-4 text-white/30 flex-shrink-0" />
              <div>
                <p className="text-xl font-bold text-white">{m.value}</p>
                <p className="text-xs text-white/35">{m.label}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Admins */}
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
            <ShieldCheck className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white/80">Administradores</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {admins.length === 0 && <p className="text-sm text-white/30 py-6 text-center">Sin admins registrados</p>}
            {admins.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
                  <span className="text-violet-300 text-[11px] font-bold">{a.nombre?.slice(0, 2).toUpperCase() || 'A'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/80 truncate">{a.nombre}</p>
                  <p className="text-xs text-white/35 truncate">{a.email}</p>
                </div>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold border',
                  a.rol === 'dev' ? 'bg-pink-500/15 text-pink-300 border-pink-500/25' : 'bg-violet-500/15 text-violet-300 border-violet-500/25')}>
                  {a.rol}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Empleados con progreso */}
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
            <Users className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white/80">Empleados</h2>
            <span className="ml-auto text-xs text-white/30">{empleados.length}/{empresa.max_empleados ?? '∞'}</span>
          </div>
          <div className="divide-y divide-white/[0.04] max-h-72 overflow-y-auto">
            {empleados.length === 0 && <p className="text-sm text-white/30 py-6 text-center">Sin empleados aún</p>}
            {empleados.map(e => {
              const pct = calcPct(progreso[e.id] ?? [])
              return (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
                    <span className="text-indigo-300 text-[11px] font-bold">{e.nombre?.slice(0, 2).toUpperCase() || 'E'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">{e.nombre}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 max-w-24">
                        <ProgressBar value={pct} showPercentage={false} />
                      </div>
                      <span className="text-[10px] text-white/35">{pct}%</span>
                    </div>
                  </div>
                  {pct === 100
                    ? <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
                    : <Circle className="w-4 h-4 text-white/15 flex-shrink-0" />
                  }
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Progreso por módulo */}
      {empleados.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-teal-400" />
            <h2 className="text-sm font-semibold text-white/80">Progreso por módulo</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {modulosConfig.map(mod => {
              const totalBloques   = Object.values(progreso).flatMap(p => p.filter(x => x.modulo === mod.key)).length
              const completados = Object.values(progreso).flatMap(p => p.filter(x => x.modulo === mod.key && x.completado)).length
              const pct = totalBloques > 0 ? Math.round(completados / totalBloques * 100) : 0
              return (
                <div key={mod.key} className="rounded-xl border border-white/[0.06] p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <mod.icon className={`w-4 h-4 ${mod.color}`} />
                    <span className={`text-xs font-medium ${mod.color}`}>{mod.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-white mb-1">{pct}%</p>
                  <ProgressBar value={pct} showPercentage={false} animated />
                  <p className="text-xs text-white/30 mt-2">{completados}/{totalBloques} bloques</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Link a admin de esta empresa */}
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-violet-500/15" style={{ background: 'rgba(139,92,246,0.05)' }}>
        <RotateCcw className="w-4 h-4 text-violet-400 flex-shrink-0" />
        <p className="text-xs text-white/50 flex-1">Para editar el contenido de onboarding de esta empresa, usá el panel admin.</p>
        <Link href="/admin" className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors">
          Ir al admin →
        </Link>
      </div>

    </div>
  )
}
