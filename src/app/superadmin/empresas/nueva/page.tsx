'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Building2, ArrowLeft, Save, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'

export default function NuevaEmpresaPage() {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    nombre:         '',
    plan:           'free',
    max_empleados:  10,
    adminNombre:    '',
    adminEmail:     '',
    adminPassword:  '',
  })

  function inputCls() {
    return 'w-full h-10 px-3 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-white/85 placeholder:text-white/20 outline-none focus:border-violet-500/50 transition-colors'
  }

  async function handleCreate() {
    if (!form.nombre.trim()) { toast.error('El nombre de la empresa es requerido'); return }
    setGuardando(true)
    try {
      const supabase = createClient()

      // 1. Crear empresa
      const { data: empresa, error: empError } = await supabase
        .from('empresas')
        .insert({ nombre: form.nombre.trim(), plan: form.plan, max_empleados: form.max_empleados, activa: true })
        .select('id')
        .single()

      if (empError || !empresa) throw new Error(empError?.message ?? 'Error al crear empresa')

      // 2. Si se ingresaron datos del admin, crear usuario
      if (form.adminEmail.trim() && form.adminPassword.trim()) {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email:    form.adminEmail.trim(),
          password: form.adminPassword.trim(),
          email_confirm: true,
        })
        if (authError) throw new Error(authError.message)

        if (authData.user) {
          await supabase.from('usuarios').insert({
            id:         authData.user.id,
            nombre:     form.adminNombre.trim() || form.adminEmail.trim(),
            email:      form.adminEmail.trim(),
            rol:        'admin',
            empresa_id: empresa.id,
          })
        }
      }

      toast.success('Empresa creada exitosamente')
      router.push(`/superadmin/empresas/${empresa.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/superadmin/empresas" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Empresas
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Nueva empresa</h1>
            <p className="text-sm text-white/40">Se agregará al ecosistema de Heero</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] p-6 space-y-6" style={{ background: 'rgba(255,255,255,0.02)' }}>

          {/* Datos empresa */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest">Información de la empresa</h3>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Nombre de la empresa *</label>
              <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Acme Corporation" className={inputCls()} autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Plan</label>
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                  className={inputCls() + ' appearance-none cursor-pointer'}>
                  <option value="free" className="bg-[#0a0614]">Free</option>
                  <option value="pro" className="bg-[#0a0614]">Pro</option>
                  <option value="enterprise" className="bg-[#0a0614]">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Máx. empleados</label>
                <input type="number" value={form.max_empleados} onChange={e => setForm(f => ({ ...f, max_empleados: parseInt(e.target.value) || 10 }))}
                  min={1} max={9999} className={inputCls()} />
              </div>
            </div>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Admin inicial */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest">Admin inicial</h3>
              <span className="text-[10px] text-white/25">(opcional)</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Nombre completo</label>
              <input type="text" value={form.adminNombre} onChange={e => setForm(f => ({ ...f, adminNombre: e.target.value }))}
                placeholder="Nombre del administrador" className={inputCls()} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Email</label>
                <input type="email" value={form.adminEmail} onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                  placeholder="admin@empresa.com" className={inputCls()} />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">Contraseña inicial</label>
                <input type="password" value={form.adminPassword} onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                  placeholder="••••••••" className={inputCls()} />
              </div>
            </div>
            <p className="text-[11px] text-white/25">Si dejás el email vacío, la empresa se crea sin admin. Podés agregar admins después.</p>
          </div>

          {/* CTA */}
          <button
            onClick={handleCreate}
            disabled={guardando || !form.nombre.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-[0_0_24px_rgba(139,92,246,0.35)]"
          >
            {guardando ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando empresa...</>
            ) : (
              <><Zap className="w-4 h-4" />Crear empresa</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
