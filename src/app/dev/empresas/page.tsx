'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Building2, Users, Calendar,
  Pencil, Trash2, AlertTriangle, Check, ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

type Plan = 'free' | 'starter' | 'pro' | 'enterprise'

interface Empresa {
  id: string
  nombre: string
  slug: string | null
  plan: Plan | null
  created_at: string
  admins: AdminRow[]
  userCount: number
}

interface AdminRow {
  id: string
  nombre: string
  email: string
}

interface EmpresaForm {
  nombre: string
  slug: string
  plan: Plan
}

type DrawerMode = 'create' | 'edit'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const PLAN_VARIANTS: Record<Plan, 'default' | 'success' | 'warning' | 'info'> = {
  free: 'default',
  starter: 'info',
  pro: 'success',
  enterprise: 'warning',
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function inputCls(error?: boolean): string {
  return [
    'w-full h-9 px-3 rounded-lg text-sm bg-white/[0.04] border text-white/85',
    'placeholder:text-white/20 outline-none transition-colors duration-150',
    'focus:bg-white/[0.06] focus:border-amber-500/60',
    error ? 'border-red-500/50' : 'border-white/[0.08]',
  ].join(' ')
}

// ─────────────────────────────────────────────
// Drawer crear/editar empresa
// ─────────────────────────────────────────────

interface EmpresaDrawerProps {
  mode: DrawerMode
  initial?: EmpresaForm
  onClose: () => void
  onSaved: () => void
  empresaId?: string
}

function EmpresaDrawer({ mode, initial, onClose, onSaved, empresaId }: EmpresaDrawerProps) {
  const [form, setForm] = useState<EmpresaForm>(
    initial ?? { nombre: '', slug: '', plan: 'free' }
  )
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<EmpresaForm>>({})

  function set(key: keyof EmpresaForm, value: string) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      // Auto-slug desde nombre (solo en create)
      if (key === 'nombre' && mode === 'create') {
        next.slug = slugify(value)
      }
      return next
    })
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<EmpresaForm> = {}
    if (!form.nombre.trim()) errs.nombre = 'Requerido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setLoading(true)
    try {
      const supabase = createClient()
      const payload = {
        nombre: form.nombre.trim(),
        slug: form.slug.trim() || null,
        plan: form.plan,
      }

      if (mode === 'create') {
        const { error } = await supabase.from('empresas').insert(payload)
        if (error) { toast.error(error.message); return }
        toast.success('Empresa creada')
      } else {
        const { error } = await supabase
          .from('empresas')
          .update(payload)
          .eq('id', empresaId!)
        if (error) { toast.error(error.message); return }
        toast.success('Empresa actualizada')
      }

      onSaved()
      onClose()
    } catch {
      toast.error('Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/50 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.aside
        className="fixed right-0 top-0 h-full w-full max-w-sm z-50
          border-l border-white/[0.08] bg-[#0f1f3d]/95 backdrop-blur-xl
          flex flex-col shadow-[−24px_0_64px_rgba(0,0,0,0.4)]"
        initial={{ x: 400 }}
        animate={{ x: 0 }}
        exit={{ x: 400 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">
            {mode === 'create' ? 'Nueva empresa' : 'Editar empresa'}
          </h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulario */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              className={inputCls(!!errors.nombre)}
              placeholder="Empresa S.A."
              autoFocus
            />
            {errors.nombre && <p className="mt-1 text-[11px] text-red-400">{errors.nombre}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">
              Slug <span className="text-white/25">(URL-safe)</span>
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={e => set('slug', slugify(e.target.value))}
              className={inputCls()}
              placeholder="empresa-sa"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">Plan</label>
            <select
              value={form.plan}
              onChange={e => set('plan', e.target.value)}
              className={inputCls() + ' appearance-none cursor-pointer'}
            >
              <option value="free" className="bg-[#0f1f3d]">Free</option>
              <option value="starter" className="bg-[#0f1f3d]">Starter</option>
              <option value="pro" className="bg-[#0f1f3d]">Pro</option>
              <option value="enterprise" className="bg-[#0f1f3d]">Enterprise</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/[0.06]">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" loading={loading} onClick={handleSave}>
            <Check className="w-3.5 h-3.5" />
            {mode === 'create' ? 'Crear' : 'Guardar'}
          </Button>
        </div>
      </motion.aside>
    </>
  )
}

// ─────────────────────────────────────────────
// Card de empresa
// ─────────────────────────────────────────────

interface EmpresaCardProps {
  empresa: Empresa
  allUsers: { id: string; nombre: string; email: string; empresa_id: string }[]
  onEdit: (e: Empresa) => void
  onDeleted: (id: string) => void
  onReload: () => void
}

function EmpresaCard({ empresa, allUsers, onEdit, onDeleted, onReload }: EmpresaCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [assigningAdmin, setAssigningAdmin] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')

  // Usuarios sin admin de esta empresa (para asignar admin)
  const candidatos = allUsers.filter(
    u => u.empresa_id === empresa.id && !empresa.admins.some(a => a.id === u.id)
  )

  async function handleDelete() {
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('empresas').delete().eq('id', empresa.id)
      if (error) { toast.error(error.message); return }
      toast.success('Empresa eliminada')
      onDeleted(empresa.id)
    } catch {
      toast.error('Error inesperado')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  async function handleAsignarAdmin() {
    if (!selectedUserId) return
    const supabase = createClient()
    const { error } = await supabase
      .from('usuarios')
      .update({ rol: 'admin', empresa_id: empresa.id })
      .eq('id', selectedUserId)
    if (error) { toast.error(error.message); return }
    toast.success('Admin asignado')
    setAssigningAdmin(false)
    setSelectedUserId('')
    onReload()
  }

  return (
    <motion.div
      layout
      className="glass-card rounded-xl overflow-hidden"
    >
      {/* Fila principal */}
      <div className="p-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/20
          flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-amber-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-white/85">{empresa.nombre}</p>
            {empresa.plan && (
              <Badge variant={PLAN_VARIANTS[empresa.plan] ?? 'default'}>
                {empresa.plan}
              </Badge>
            )}
          </div>
          {empresa.slug && (
            <p className="text-xs text-white/30 mt-0.5 font-mono">{empresa.slug}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-white/35">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />{empresa.userCount} usuarios
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(empresa.created_at).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(p => !p)}
            className="p-1.5 text-white/30 hover:text-white/70 transition-colors rounded-md hover:bg-white/[0.04]"
            title="Ver admins"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onEdit(empresa)}
            className="p-1.5 text-white/30 hover:text-indigo-400 transition-colors rounded-md hover:bg-white/[0.04]"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 text-white/30 hover:text-red-400 transition-colors rounded-md hover:bg-red-500/[0.06]"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Panel expandido: admins */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-3 border-t border-white/[0.05] pt-3">
              <p className="text-xs font-medium text-white/35 uppercase tracking-wider">Admins</p>

              {empresa.admins.length === 0 ? (
                <p className="text-xs text-white/25">Sin admins asignados</p>
              ) : (
                <div className="space-y-1.5">
                  {empresa.admins.map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <div className="w-5 h-5 rounded-full bg-indigo-600/25 border border-indigo-500/25
                        flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-300 text-[9px] font-bold">
                          {a.nombre[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="text-white/65">{a.nombre}</span>
                      <span className="text-white/30">{a.email}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Asignar nuevo admin */}
              {!assigningAdmin ? (
                <button
                  onClick={() => setAssigningAdmin(true)}
                  className="text-xs text-amber-400/60 hover:text-amber-400 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Asignar admin
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedUserId}
                    onChange={e => setSelectedUserId(e.target.value)}
                    className="flex-1 h-8 px-2 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08]
                      text-white/70 appearance-none outline-none focus:border-amber-500/60"
                  >
                    <option value="" className="bg-[#0f1f3d]">Seleccionar usuario...</option>
                    {candidatos.map(u => (
                      <option key={u.id} value={u.id} className="bg-[#0f1f3d]">
                        {u.nombre} ({u.email})
                      </option>
                    ))}
                  </select>
                  <Button variant="primary" size="sm" onClick={handleAsignarAdmin}
                    className="h-8 text-xs">
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setAssigningAdmin(false)}
                    className="h-8 text-xs">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmar eliminación */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-xl bg-[#0f1f3d]/95 backdrop-blur-sm
              border border-red-500/30 flex flex-col items-center justify-center gap-3 p-4"
          >
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="text-xs text-center text-white/70">
              ¿Eliminar <span className="font-semibold text-white/90">{empresa.nombre}</span>?<br />
              <span className="text-white/40">Se eliminará la empresa pero no los usuarios.</span>
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
              <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>Eliminar</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function EmpresasPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [allUsers, setAllUsers] = useState<{ id: string; nombre: string; email: string; empresa_id: string }[]>([])
  const [drawer, setDrawer] = useState<{ mode: DrawerMode; empresa?: Empresa } | null>(null)

  const cargarDatos = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      // Verificar dev
      const { data: ud } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
      if (!ud || ud.rol !== 'dev') { router.push('/admin'); return }

      const [{ data: empData }, { data: usersData }] = await Promise.all([
        supabase.from('empresas').select('id, nombre, slug, plan, created_at').order('created_at', { ascending: false }),
        supabase.from('usuarios').select('id, nombre, email, rol, empresa_id').order('nombre'),
      ])

      const usrs = (usersData ?? []) as { id: string; nombre: string; email: string; rol: string; empresa_id: string }[]

      const lista: Empresa[] = (empData ?? []).map(e => {
        const empUsers = usrs.filter(u => u.empresa_id === e.id)
        return {
          ...e,
          plan: (e.plan as Plan) ?? null,
          admins: empUsers.filter(u => u.rol === 'admin').map(u => ({ id: u.id, nombre: u.nombre, email: u.email })),
          userCount: empUsers.length,
        }
      })

      setEmpresas(lista)
      setAllUsers(usrs.map(u => ({ id: u.id, nombre: u.nombre, email: u.email, empresa_id: u.empresa_id })))
    } catch (err) {
      console.error('Error cargando empresas:', err)
      toast.error('Error al cargar empresas')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Empresas</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {loading ? '—' : `${empresas.length} empresa${empresas.length !== 1 ? 's' : ''} registradas`}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setDrawer({ mode: 'create' })}>
          <Plus className="w-3.5 h-3.5" />
          Nueva empresa
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-white/[0.04] rounded-xl" />
          ))}
        </div>
      ) : empresas.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-8 h-8 text-white/15 mx-auto mb-3" />
          <p className="text-sm text-white/40">Sin empresas registradas</p>
        </div>
      ) : (
        <div className="space-y-4 relative">
          {empresas.map(emp => (
            <EmpresaCard
              key={emp.id}
              empresa={emp}
              allUsers={allUsers}
              onEdit={e => setDrawer({ mode: 'edit', empresa: e })}
              onDeleted={id => setEmpresas(prev => prev.filter(e => e.id !== id))}
              onReload={cargarDatos}
            />
          ))}
        </div>
      )}

      {/* Drawer */}
      <AnimatePresence>
        {drawer && (
          <EmpresaDrawer
            mode={drawer.mode}
            empresaId={drawer.empresa?.id}
            initial={drawer.empresa
              ? { nombre: drawer.empresa.nombre, slug: drawer.empresa.slug ?? '', plan: drawer.empresa.plan ?? 'free' }
              : undefined
            }
            onClose={() => setDrawer(null)}
            onSaved={cargarDatos}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
