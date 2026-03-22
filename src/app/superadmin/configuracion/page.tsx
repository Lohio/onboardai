'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Building2, Plus, Users,
  ShieldCheck, Save, Zap, CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

interface PlanConfig { nombre: string; max_empleados: number; precio: string; features: string[] }

const PLANES_INFO: Record<string, PlanConfig> = {
  free:       { nombre: 'Free',       max_empleados: 10,   precio: 'Sin costo', features: ['Hasta 10 empleados', 'M1 y M2 habilitados', 'Soporte comunitario'] },
  pro:        { nombre: 'Pro',        max_empleados: 50,   precio: 'A definir',  features: ['Hasta 50 empleados', 'M1, M2 y M3 habilitados', 'Asistente IA básico', 'Soporte prioritario'] },
  enterprise: { nombre: 'Enterprise', max_empleados: 9999, precio: 'A convenir', features: ['Empleados ilimitados', 'Todos los módulos', 'IA avanzada', 'Soporte dedicado', 'API access'] },
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } }
const item      = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 24 } } }

function inputCls() {
  return 'w-full h-10 px-3 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white/85 placeholder:text-white/20 outline-none focus:border-violet-500/50 transition-colors'
}

export default function ConfiguracionPage() {
  const [stats, setStats] = useState({ empresas: 0, empleados: 0, admins: 0 })
  const [loading, setLoading] = useState(true)
  const [formAdmin, setFormAdmin] = useState({ nombre: '', email: '', password: '', empresa_id: '', rol: 'admin' })
  const [empresas, setEmpresas] = useState<{ id: string; nombre: string }[]>([])
  const [creandoAdmin, setCreandoAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: empresasData }, { data: usuarios }] = await Promise.all([
        supabase.from('empresas').select('id, nombre').order('nombre'),
        supabase.from('usuarios').select('rol'),
      ])
      const lista = usuarios ?? []
      setStats({
        empresas:  (empresasData ?? []).length,
        empleados: lista.filter(u => u.rol === 'empleado').length,
        admins:    lista.filter(u => ['admin', 'dev'].includes(u.rol)).length,
      })
      setEmpresas(empresasData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function crearAdmin() {
    if (!formAdmin.email.trim() || !formAdmin.password.trim() || !formAdmin.empresa_id) {
      toast.error('Email, contraseña y empresa son requeridos')
      return
    }
    setCreandoAdmin(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.admin.createUser({
        email: formAdmin.email.trim(),
        password: formAdmin.password.trim(),
        email_confirm: true,
      })
      if (error || !data.user) throw new Error(error?.message ?? 'Error al crear usuario')

      await supabase.from('usuarios').insert({
        id:         data.user.id,
        nombre:     formAdmin.nombre.trim() || formAdmin.email.trim(),
        email:      formAdmin.email.trim(),
        rol:        formAdmin.rol,
        empresa_id: formAdmin.empresa_id,
      })

      toast.success(`${formAdmin.rol === 'dev' ? 'SuperAdmin' : 'Admin'} creado exitosamente`)
      setFormAdmin({ nombre: '', email: '', password: '', empresa_id: '', rol: 'admin' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setCreandoAdmin(false)
    }
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-white">Configuración del sistema</h1>
        <p className="text-sm text-white/40 mt-0.5">Gestión de planes, usuarios y configuración global</p>
      </motion.div>

      {/* Stats rápidos */}
      <motion.div variants={item} className="grid grid-cols-3 gap-4">
        {[
          { label: 'Empresas', value: stats.empresas, icon: Building2, color: 'text-violet-400' },
          { label: 'Empleados', value: stats.empleados, icon: Users, color: 'text-[#38BDF8]' },
          { label: 'Admins / Dev', value: stats.admins, icon: ShieldCheck, color: 'text-teal-400' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-white/[0.07] p-4 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <s.icon className={`w-5 h-5 ${s.color} flex-shrink-0`} />
            <div>
              <p className="text-2xl font-bold text-white">{loading ? '—' : s.value}</p>
              <p className="text-xs text-white/35">{s.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Planes */}
        <motion.div variants={item} className="rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white/80">Planes disponibles</h2>
            </div>
            <Link href="/superadmin/empresas/nueva"
              className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
              <Plus className="w-3 h-3" /> Nueva empresa
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {Object.entries(PLANES_INFO).map(([key, plan]) => (
              <div key={key} className="rounded-xl border border-white/[0.06] p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${key === 'enterprise' ? 'text-amber-300' : key === 'pro' ? 'text-[#7DD3FC]' : 'text-white/60'}`}>
                    {plan.nombre}
                  </span>
                  <span className="text-xs text-white/30">{plan.precio}</span>
                </div>
                <ul className="space-y-1.5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-white/40">
                      <CheckCircle2 className="w-3 h-3 text-teal-500/60 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Crear admin */}
        <motion.div variants={item} className="rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
            <ShieldCheck className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white/80">Crear admin o superadmin</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/40 mb-1.5">Nombre completo</label>
              <input type="text" value={formAdmin.nombre} onChange={e => setFormAdmin(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del administrador" className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/40 mb-1.5">Email *</label>
              <input type="email" value={formAdmin.email} onChange={e => setFormAdmin(f => ({ ...f, email: e.target.value }))}
                placeholder="admin@empresa.com" className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/40 mb-1.5">Contraseña inicial *</label>
              <input type="password" value={formAdmin.password} onChange={e => setFormAdmin(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••" className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/40 mb-1.5">Empresa *</label>
              <select value={formAdmin.empresa_id} onChange={e => setFormAdmin(f => ({ ...f, empresa_id: e.target.value }))}
                className={inputCls() + ' cursor-pointer'}>
                <option value="" className="bg-[#0a0614]">Seleccionar empresa...</option>
                {empresas.map(e => <option key={e.id} value={e.id} className="bg-[#0a0614]">{e.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/40 mb-1.5">Rol</label>
              <div className="flex gap-2">
                {[['admin', 'Admin'], ['dev', 'SuperAdmin (dev)']].map(([val, label]) => (
                  <button key={val} onClick={() => setFormAdmin(f => ({ ...f, rol: val }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${formAdmin.rol === val ? 'bg-violet-600/25 border-violet-500/40 text-violet-300' : 'border-white/[0.08] text-white/40 hover:text-white/70'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={crearAdmin} disabled={creandoAdmin}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
              {creandoAdmin
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando...</>
                : <><Save className="w-4 h-4" />Crear usuario</>
              }
            </button>
          </div>
        </motion.div>
      </div>

      {/* SQL Setup */}
      <motion.div variants={item} className="rounded-2xl border border-violet-500/15 p-5" style={{ background: 'rgba(139,92,246,0.04)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-white/80">Setup inicial de Supabase</h2>
        </div>
        <p className="text-xs text-white/40 mb-3">Ejecutá este SQL en el Editor SQL de Supabase si no lo hiciste aún:</p>
        <pre className="text-[11px] text-violet-300/70 bg-black/30 rounded-xl p-4 overflow-x-auto leading-relaxed font-mono">{`-- Campos para tabla empresas
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS activa boolean DEFAULT true;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS max_empleados integer DEFAULT 10;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Tabla de actividad
CREATE TABLE IF NOT EXISTS actividad_log (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  accion     text NOT NULL,
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
);`}</pre>
      </motion.div>

    </motion.div>
  )
}
