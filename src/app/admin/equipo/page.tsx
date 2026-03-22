'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, X, Users, Eye, EyeOff, Check,
  Briefcase, MapPin, Calendar, User, Mail,
  Lock, Building2, MessageSquare, Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Portal } from '@/components/shared/Portal'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface EmpleadoRow {
  id: string
  nombre: string
  email: string
  puesto: string | null
  area: string | null
  fecha_ingreso: string | null
  modalidad_trabajo: string | null
  manager_id: string | null
  buddy_id: string | null
}

interface FormData {
  // Acceso
  email: string
  password: string
  // Datos personales
  nombre: string
  puesto: string
  area: string
  fecha_ingreso: string
  modalidad_trabajo: '' | 'presencial' | 'remoto' | 'hibrido'
  // Equipo
  manager_id: string
  buddy_id: string
  // Sobre el empleado
  sobre_mi: string
}

const FORM_INICIAL: FormData = {
  email: '',
  password: '',
  nombre: '',
  puesto: '',
  area: '',
  fecha_ingreso: new Date().toISOString().split('T')[0],
  modalidad_trabajo: '',
  manager_id: '',
  buddy_id: '',
  sobre_mi: '',
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getInitials(nombre: string) {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function formatFecha(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function generarPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ─────────────────────────────────────────────
// Card de empleado
// ─────────────────────────────────────────────

function EmpleadoCard({ emp }: { emp: EmpleadoRow }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className="glass-card rounded-xl p-4 flex items-start gap-3"
    >
      <div className="w-10 h-10 rounded-full bg-[#0EA5E9]/20 border border-[#0EA5E9]/20
        flex items-center justify-center flex-shrink-0">
        <span className="text-[#7DD3FC] text-sm font-semibold">{getInitials(emp.nombre)}</span>
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-white/85 truncate">{emp.nombre}</p>
        <p className="text-xs text-white/40 truncate">{emp.email}</p>
        <div className="flex flex-wrap gap-2 pt-0.5">
          {emp.puesto && (
            <span className="flex items-center gap-1 text-[11px] text-white/35">
              <Briefcase className="w-3 h-3" />{emp.puesto}
            </span>
          )}
          {emp.area && (
            <span className="flex items-center gap-1 text-[11px] text-white/35">
              <Building2 className="w-3 h-3" />{emp.area}
            </span>
          )}
          {emp.modalidad_trabajo && (
            <span className="flex items-center gap-1 text-[11px] text-white/35">
              <MapPin className="w-3 h-3" />{emp.modalidad_trabajo}
            </span>
          )}
          {emp.fecha_ingreso && (
            <span className="flex items-center gap-1 text-[11px] text-white/35">
              <Calendar className="w-3 h-3" />{formatFecha(emp.fecha_ingreso)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Campo de formulario reutilizable
// ─────────────────────────────────────────────

function Campo({
  label, required, children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-white/50">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = `w-full h-10 bg-white/[0.04] border border-white/[0.08] rounded-lg
  px-3 text-sm text-white/80 placeholder:text-white/20
  focus:outline-none focus:border-[#0EA5E9]/40 focus:bg-white/[0.06]
  transition-colors duration-150`

const selectCls = `w-full h-10 bg-white/[0.04] border border-white/[0.08] rounded-lg
  px-3 text-sm text-white/80
  focus:outline-none focus:border-[#0EA5E9]/40
  transition-colors duration-150 bg-[#111110]`

// ─────────────────────────────────────────────
// Drawer de alta de empleado
// ─────────────────────────────────────────────

function DrawerAlta({
  onClose,
  onCreado,
  empleadosExistentes,
}: {
  onClose: () => void
  onCreado: (emp: EmpleadoRow) => void
  empleadosExistentes: EmpleadoRow[]
}) {
  const [form, setForm] = useState<FormData>({
    ...FORM_INICIAL,
    password: generarPassword(),
  })
  const [showPassword, setShowPassword] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null)
  const [copiado, setCopiado] = useState(false)

  const set = (key: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.email.trim() || !form.password.trim()) return
    setEnviando(true)

    try {
      const res = await fetch('/api/admin/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          nombre: form.nombre,
          puesto: form.puesto || undefined,
          area: form.area || undefined,
          fecha_ingreso: form.fecha_ingreso || undefined,
          modalidad_trabajo: form.modalidad_trabajo || undefined,
          manager_id: form.manager_id || undefined,
          buddy_id: form.buddy_id || undefined,
          sobre_mi: form.sobre_mi || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Error al crear el empleado')
        return
      }

      onCreado(data.usuario)
      setCredenciales({ email: form.email, password: form.password })
    } catch {
      toast.error('Error de conexión')
    } finally {
      setEnviando(false)
    }
  }

  const copiarCredenciales = () => {
    if (!credenciales) return
    navigator.clipboard.writeText(
      `Email: ${credenciales.email}\nContraseña: ${credenciales.password}`
    )
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // ── Estado de éxito ──
  if (credenciales) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white/80">Empleado creado</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
          <div className="w-14 h-14 rounded-full bg-teal-500/15 border border-teal-500/20
            flex items-center justify-center">
            <Check className="w-7 h-7 text-teal-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white/80 mb-1">¡{form.nombre} fue dado de alta!</p>
            <p className="text-xs text-white/40">Compartí las credenciales con el empleado</p>
          </div>
          <div className="w-full glass-card rounded-xl p-4 space-y-3">
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Email</p>
              <p className="text-sm font-mono text-white/75">{credenciales.email}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Contraseña temporal</p>
              <p className="text-sm font-mono text-white/75">{credenciales.password}</p>
            </div>
            <button
              onClick={copiarCredenciales}
              className="w-full flex items-center justify-center gap-2 h-9 rounded-lg
                border border-white/[0.08] text-xs text-white/50
                hover:border-[#0EA5E9]/30 hover:text-[#38BDF8]
                transition-colors duration-150"
            >
              {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiado ? 'Copiado' : 'Copiar credenciales'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full h-10 rounded-lg bg-[#0EA5E9]/80 hover:bg-[#0EA5E9]
              text-sm text-white font-medium transition-colors duration-150"
          >
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  // ── Formulario ──
  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
        <h2 className="text-sm font-semibold text-white/80">Dar de alta empleado</h2>
        <button type="button" onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Campos */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

        {/* Acceso */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-[11px] font-medium text-white/35 uppercase tracking-widest">
            <Lock className="w-3.5 h-3.5" />Acceso
          </h3>
          <Campo label="Email" required>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="empleado@empresa.com"
                required
                className={inputCls + ' pl-9'}
              />
            </div>
          </Campo>
          <Campo label="Contraseña temporal" required>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                required
                className={inputCls + ' pl-9 pr-9'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </Campo>
        </section>

        {/* Datos personales */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-[11px] font-medium text-white/35 uppercase tracking-widest">
            <User className="w-3.5 h-3.5" />Datos personales
          </h3>
          <Campo label="Nombre completo" required>
            <input
              type="text"
              value={form.nombre}
              onChange={set('nombre')}
              placeholder="Juan García"
              required
              className={inputCls}
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Puesto">
              <input
                type="text"
                value={form.puesto}
                onChange={set('puesto')}
                placeholder="Desarrollador"
                className={inputCls}
              />
            </Campo>
            <Campo label="Área">
              <input
                type="text"
                value={form.area}
                onChange={set('area')}
                placeholder="Tecnología"
                className={inputCls}
              />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Fecha de ingreso">
              <input
                type="date"
                value={form.fecha_ingreso}
                onChange={set('fecha_ingreso')}
                className={inputCls + ' text-white/60'}
              />
            </Campo>
            <Campo label="Modalidad">
              <select value={form.modalidad_trabajo} onChange={set('modalidad_trabajo')} className={selectCls}>
                <option value="">— elegir —</option>
                <option value="presencial">Presencial</option>
                <option value="remoto">Remoto</option>
                <option value="hibrido">Híbrido</option>
              </select>
            </Campo>
          </div>
        </section>

        {/* Equipo */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-[11px] font-medium text-white/35 uppercase tracking-widest">
            <Users className="w-3.5 h-3.5" />Equipo
          </h3>
          <Campo label="Jefe / Manager">
            <select value={form.manager_id} onChange={set('manager_id')} className={selectCls}>
              <option value="">— sin asignar —</option>
              {empleadosExistentes.map(e => (
                <option key={e.id} value={e.id}>
                  {e.nombre}{e.puesto ? ` (${e.puesto})` : ''}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Buddy / Acompañante">
            <select value={form.buddy_id} onChange={set('buddy_id')} className={selectCls}>
              <option value="">— sin asignar —</option>
              {empleadosExistentes.map(e => (
                <option key={e.id} value={e.id}>
                  {e.nombre}{e.puesto ? ` (${e.puesto})` : ''}
                </option>
              ))}
            </select>
          </Campo>
        </section>

        {/* Sobre el empleado */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-[11px] font-medium text-white/35 uppercase tracking-widest">
            <MessageSquare className="w-3.5 h-3.5" />Sobre el empleado
          </h3>
          <Campo label="Descripción / Presentación">
            <textarea
              value={form.sobre_mi}
              onChange={set('sobre_mi')}
              placeholder="Breve descripción del empleado para que sus compañeros lo conozcan..."
              rows={3}
              className={`w-full bg-white/[0.04] border border-white/[0.08] rounded-lg
                px-3 py-2.5 text-sm text-white/80 placeholder:text-white/20
                focus:outline-none focus:border-[#0EA5E9]/40 focus:bg-white/[0.06]
                transition-colors duration-150 resize-none`}
            />
          </Campo>
        </section>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-white/[0.06] px-5 py-4 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 rounded-lg border border-white/[0.08] text-sm text-white/50
            hover:border-white/[0.15] hover:text-white/70 transition-colors duration-150"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={enviando || !form.nombre || !form.email || !form.password}
          className="flex-1 h-10 rounded-lg bg-[#0EA5E9]/90 hover:bg-[#0EA5E9]
            disabled:opacity-40 disabled:cursor-not-allowed
            text-sm text-white font-medium transition-colors duration-150
            flex items-center justify-center gap-2"
        >
          {enviando ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4" />
          )}
          {enviando ? 'Creando...' : 'Dar de alta'}
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="shimmer h-8 w-48 rounded-md" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="shimmer glass-card rounded-xl h-28" />)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function EquipoPage() {
  const [loading, setLoading] = useState(true)
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([])
  const [drawerAbierto, setDrawerAbierto] = useState(false)

  const cargarEmpleados = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: admin } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()

      if (!admin) return

      const { data } = await supabase
        .from('usuarios')
        .select('id, nombre, email, puesto, area, fecha_ingreso, modalidad_trabajo, manager_id, buddy_id')
        .eq('empresa_id', admin.empresa_id)
        .eq('rol', 'empleado')
        .order('created_at', { ascending: false })

      setEmpleados((data ?? []) as EmpleadoRow[])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarEmpleados()
  }, [cargarEmpleados])

  const handleEmpleadoCreado = (nuevo: EmpleadoRow) => {
    setEmpleados(prev => [nuevo, ...prev])
  }

  if (loading) return <Skeleton />

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-xl font-semibold text-white">Equipo</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {empleados.length === 0
              ? 'Sin empleados aún'
              : `${empleados.length} empleado${empleados.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setDrawerAbierto(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg
            bg-[#0EA5E9]/80 hover:bg-[#0EA5E9] text-sm text-white font-medium
            transition-colors duration-150"
        >
          <UserPlus className="w-4 h-4" />
          Dar de alta
        </button>
      </motion.div>

      {/* Lista */}
      {empleados.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card rounded-xl p-12 flex flex-col items-center gap-4"
        >
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="teamGrad" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0EA5E9" stopOpacity="0.4" />
                <stop offset="1" stopColor="#0D9488" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <circle cx="24" cy="18" r="8" stroke="url(#teamGrad)" strokeWidth="1.5" />
            <path d="M8 48c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="url(#teamGrad)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="42" cy="20" r="5" stroke="url(#teamGrad)" strokeWidth="1.5" strokeOpacity="0.5" />
            <path d="M46 48c0-6-3.5-10-8-12" stroke="url(#teamGrad)" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5" />
          </svg>
          <p className="text-sm text-white/35 text-center">
            Aún no hay empleados registrados.<br />
            Hacé click en <strong className="text-white/50">Dar de alta</strong> para comenzar.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {empleados.map(emp => (
              <EmpleadoCard key={emp.id} emp={emp} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Drawer */}
      <Portal>
      <AnimatePresence>
        {drawerAbierto && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/60 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerAbierto(false)}
            />

            {/* Panel derecho */}
            <motion.div
              className="fixed right-0 top-0 h-full w-full max-w-md z-50
                border-l border-white/[0.07] bg-[#111110]/98 backdrop-blur-xl"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <DrawerAlta
                onClose={() => setDrawerAbierto(false)}
                onCreado={handleEmpleadoCreado}
                empleadosExistentes={empleados}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </Portal>
    </div>
  )
}
