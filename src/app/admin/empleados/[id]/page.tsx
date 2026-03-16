'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Save, BookOpen, Wrench, MessageSquare,
  RotateCcw, CheckCircle2, Circle, Clock, AlertCircle,
  CalendarDays, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ResetProgresoModal, type ModuloReset } from '@/components/admin/ResetProgresoModal'
import type { UserRole } from '@/types'

// ─────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────

interface EmpleadoFull {
  id: string
  nombre: string
  email: string
  puesto: string | null
  area: string | null
  fecha_ingreso: string | null
  modalidad: string | null
  manager_id: string | null
  buddy_id: string | null
  bio: string | null
  rol: UserRole
  contacto_it_nombre: string | null
  contacto_it_email: string | null
  contacto_rrhh_nombre: string | null
  contacto_rrhh_email: string | null
  preboarding_activo: boolean
  fecha_acceso_preboarding: string | null
}

interface FormData {
  nombre: string
  puesto: string
  area: string
  fecha_ingreso: string
  modalidad: string
  manager_id: string
  buddy_id: string
  bio: string
  rol: UserRole
  contacto_it_nombre: string
  contacto_it_email: string
  contacto_rrhh_nombre: string
  contacto_rrhh_email: string
}

interface ProgresoModulo {
  modulo: string
  total: number
  completados: number
  pct: number
}

interface AlertaRow {
  id: string
  pregunta: string
  created_at: string
  resuelta: boolean
}

interface ColaboradorRow {
  id: string
  nombre: string
  email: string
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getInitials(nombre: string): string {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function formatFecha(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  return `hace ${d}d`
}

function inputCls(error?: boolean): string {
  return [
    'w-full h-9 px-3 rounded-lg text-sm bg-white/[0.04] border text-white/85',
    'placeholder:text-white/20 outline-none transition-colors duration-150',
    'focus:bg-white/[0.06] focus:border-indigo-500/60',
    error ? 'border-red-500/50' : 'border-white/[0.08]',
  ].join(' ')
}

const MODULOS_CONFIG = [
  {
    key: 'cultura' as const,
    label: 'M2 — Cultura',
    icon: <BookOpen className="w-3.5 h-3.5" />,
    color: 'text-indigo-400',
  },
  {
    key: 'rol' as const,
    label: 'M3 — Rol y herramientas',
    icon: <Wrench className="w-3.5 h-3.5" />,
    color: 'text-teal-400',
  },
  {
    key: 'asistente' as const,
    label: 'M4 — Asistente IA',
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    color: 'text-amber-400',
  },
]

// ─────────────────────────────────────────────
// Página de detalle
// ─────────────────────────────────────────────

export default function EmpleadoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingPreboarding, setTogglingPreboarding] = useState(false)
  const [empleado, setEmpleado] = useState<EmpleadoFull | null>(null)
  const [rolAdmin, setRolAdmin] = useState<UserRole>('admin')
  const [form, setForm] = useState<FormData | null>(null)
  const [modulos, setModulos] = useState<ProgresoModulo[]>([])
  const [alertas, setAlertas] = useState<AlertaRow[]>([])
  const [colaboradores, setColaboradores] = useState<ColaboradorRow[]>([])
  const [resetModal, setResetModal] = useState<ModuloReset | null>(null)

  // ── Carga inicial ──
  const cargarDatos = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      // Verificar que es admin o dev
      const { data: adminData } = await supabase
        .from('usuarios')
        .select('empresa_id, rol')
        .eq('id', user.id)
        .single()

      if (!adminData || !['admin', 'dev'].includes(adminData.rol)) {
        router.push('/auth/login')
        return
      }

      setRolAdmin(adminData.rol as UserRole)

      // Datos del empleado
      const { data: empData, error: empError } = await supabase
        .from('usuarios')
        .select(`id, nombre, email, puesto, area, fecha_ingreso,
          modalidad, manager_id, buddy_id, bio, rol,
          contacto_it_nombre, contacto_it_email,
          contacto_rrhh_nombre, contacto_rrhh_email,
          preboarding_activo, fecha_acceso_preboarding`)
        .eq('id', id)
        .single()

      if (empError || !empData) {
        toast.error('Empleado no encontrado')
        router.push('/admin/empleados')
        return
      }

      // Verificar que pertenece a la misma empresa (excepto dev)
      if (adminData.rol !== 'dev') {
        const { data: check } = await supabase
          .from('usuarios')
          .select('empresa_id')
          .eq('id', id)
          .single()
        if (check?.empresa_id !== adminData.empresa_id) {
          router.push('/admin/empleados')
          return
        }
      }

      setEmpleado(empData as EmpleadoFull)
      setForm({
        nombre: empData.nombre ?? '',
        puesto: empData.puesto ?? '',
        area: empData.area ?? '',
        fecha_ingreso: empData.fecha_ingreso ?? '',
        modalidad: empData.modalidad ?? '',
        manager_id: empData.manager_id ?? '',
        buddy_id: empData.buddy_id ?? '',
        bio: empData.bio ?? '',
        rol: (empData.rol ?? 'empleado') as UserRole,
        contacto_it_nombre: empData.contacto_it_nombre ?? '',
        contacto_it_email: empData.contacto_it_email ?? '',
        contacto_rrhh_nombre: empData.contacto_rrhh_nombre ?? '',
        contacto_rrhh_email: empData.contacto_rrhh_email ?? '',
      })

      // Progreso de módulos: bloques totales por módulo desde conocimiento
      const { data: conocimientoRows } = await supabase
        .from('conocimiento')
        .select('modulo')
        .eq('empresa_id', adminData.empresa_id)

      const totalesPorModulo: Record<string, number> = {}
      for (const row of (conocimientoRows ?? [])) {
        totalesPorModulo[row.modulo] = (totalesPorModulo[row.modulo] ?? 0) + 1
      }

      const { data: progresoRows } = await supabase
        .from('progreso_modulos')
        .select('modulo, completado')
        .eq('usuario_id', id)
        .eq('completado', true)

      const completadosPorModulo: Record<string, number> = {}
      for (const row of (progresoRows ?? [])) {
        completadosPorModulo[row.modulo] = (completadosPorModulo[row.modulo] ?? 0) + 1
      }

      // M4: contar conversaciones
      const { count: convCount } = await supabase
        .from('conversaciones_ia')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', id)

      const modulosCalc: ProgresoModulo[] = [
        {
          modulo: 'cultura',
          total: totalesPorModulo['cultura'] ?? 5,
          completados: completadosPorModulo['cultura'] ?? 0,
          pct: 0,
        },
        {
          modulo: 'rol',
          total: totalesPorModulo['rol'] ?? 1,
          completados: completadosPorModulo['rol'] ?? 0,
          pct: 0,
        },
        {
          modulo: 'asistente',
          total: 1,
          completados: (convCount ?? 0) > 0 ? 1 : 0,
          pct: 0,
        },
      ].map(m => ({
        ...m,
        pct: m.total > 0 ? Math.min(100, Math.round((m.completados / m.total) * 100)) : 0,
      }))

      setModulos(modulosCalc)

      // Alertas del empleado (últimas 8)
      const { data: alertaRows } = await supabase
        .from('alertas_conocimiento')
        .select('id, pregunta, created_at, resuelta')
        .eq('empresa_id', adminData.empresa_id)
        .eq('usuario_id', id)
        .order('created_at', { ascending: false })
        .limit(8)

      setAlertas((alertaRows ?? []) as AlertaRow[])

      // Colaboradores para selects de manager/buddy (con email para mostrar "Nombre — email")
      const { data: colabRows } = await supabase
        .from('usuarios')
        .select('id, nombre, email')
        .eq('empresa_id', adminData.empresa_id)
        .neq('id', id)
        .neq('rol', 'dev')
        .order('nombre')

      setColaboradores((colabRows ?? []) as ColaboradorRow[])
    } catch (err) {
      console.error('Error cargando detalle:', err)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Guardar cambios ──
  async function handleSave() {
    if (!form || !empleado) return

    // Doble check de permisos en cliente
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sin sesión'); return }

    const { data: adminCheck } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!adminCheck || !['admin', 'dev'].includes(adminCheck.rol)) {
      toast.error('Sin permisos')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/empleados/${empleado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:               form.nombre.trim() || null,
          puesto:               form.puesto.trim() || null,
          area:                 form.area.trim() || null,
          fecha_ingreso:        form.fecha_ingreso || null,
          modalidad:            form.modalidad || null,
          manager_id:           form.manager_id || null,
          buddy_id:             form.buddy_id || null,
          bio:                  form.bio.trim() || null,
          rol:                  form.rol,
          contacto_it_nombre:   form.contacto_it_nombre.trim() || null,
          contacto_it_email:    form.contacto_it_email.trim() || null,
          contacto_rrhh_nombre: form.contacto_rrhh_nombre.trim() || null,
          contacto_rrhh_email:  form.contacto_rrhh_email.trim() || null,
        }),
      })

      const data = await res.json() as { usuario?: EmpleadoFull; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Error al guardar')
        return
      }

      setEmpleado(data.usuario!)
      toast.success('Cambios guardados')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  function setField(key: keyof FormData, value: string) {
    setForm(prev => prev ? { ...prev, [key]: value } : prev)
  }

  // ── Toggle pre-boarding ──────────────────────
  async function togglePreboarding() {
    if (!empleado || togglingPreboarding) return

    const nuevoEstado = !empleado.preboarding_activo
    setTogglingPreboarding(true)
    try {
      // Activa via API (que también envía el email de bienvenida)
      // Desactiva directamente vía Supabase
      if (nuevoEstado) {
        const res = await fetch('/api/admin/preboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuarioId: empleado.id }),
        })
        const data = await res.json() as { error?: string }
        if (!res.ok) { toast.error(data.error ?? 'Error al activar pre-boarding'); return }
        toast.success('Pre-boarding activado — email enviado al empleado')
      } else {
        const supabase = createClient()
        const { error } = await supabase
          .from('usuarios')
          .update({ preboarding_activo: false })
          .eq('id', empleado.id)
        if (error) { toast.error('Error al desactivar pre-boarding'); return }
        toast.success('Pre-boarding desactivado')
      }

      // Actualizar estado local
      setEmpleado(prev => prev
        ? {
            ...prev,
            preboarding_activo: nuevoEstado,
            fecha_acceso_preboarding: nuevoEstado
              ? new Date().toISOString()
              : prev.fecha_acceso_preboarding,
          }
        : prev,
      )
    } catch {
      toast.error('Error de conexión')
    } finally {
      setTogglingPreboarding(false)
    }
  }

  // ── Loading ──
  if (loading || !form || !empleado) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-white/[0.06] rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 bg-white/[0.04] rounded-lg" />
            ))}
          </div>
          <div className="lg:col-span-2 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-white/[0.04] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link
          href="/admin/empleados"
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70
            transition-colors duration-150"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Empleados
        </Link>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-600/25 border border-indigo-500/25
            flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-300 text-xs font-semibold">
              {getInitials(empleado.nombre)}
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-white truncate">{empleado.nombre}</h1>
            <p className="text-xs text-white/40">{empleado.email}</p>
          </div>
        </div>
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
          <Save className="w-3.5 h-3.5" />
          Guardar cambios
        </Button>
      </div>

      {/* Contenido: 3+2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Formulario (izquierda) ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          className="lg:col-span-3 glass-card rounded-xl p-6 space-y-5"
        >
          <h2 className="text-sm font-semibold text-white/70">Datos personales</h2>

          {/* Nombre */}
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">Nombre completo</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setField('nombre', e.target.value)}
              className={inputCls()}
            />
          </div>

          {/* Email (solo lectura) */}
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">
              Email <span className="text-white/25">(no editable)</span>
            </label>
            <input
              type="email"
              value={empleado.email}
              readOnly
              className="w-full h-9 px-3 rounded-lg text-sm bg-white/[0.02] border border-white/[0.05]
                text-white/40 outline-none cursor-not-allowed"
            />
          </div>

          {/* Puesto + Área */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/45 mb-1.5">Puesto</label>
              <input
                type="text"
                value={form.puesto}
                onChange={e => setField('puesto', e.target.value)}
                className={inputCls()}
                placeholder="Ej: Desarrollador"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/45 mb-1.5">Área</label>
              <input
                type="text"
                value={form.area}
                onChange={e => setField('area', e.target.value)}
                className={inputCls()}
                placeholder="Ej: Producto"
              />
            </div>
          </div>

          {/* Fecha ingreso + Modalidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-white/45 mb-1.5">Fecha de ingreso</label>
              <input
                type="date"
                value={form.fecha_ingreso}
                onChange={e => setField('fecha_ingreso', e.target.value)}
                className={inputCls()}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/45 mb-1.5">Modalidad</label>
              <select
                value={form.modalidad}
                onChange={e => setField('modalidad', e.target.value)}
                className={inputCls() + ' appearance-none cursor-pointer'}
              >
                <option value="" className="bg-[#0f1f3d]">Sin definir</option>
                <option value="presencial" className="bg-[#0f1f3d]">Presencial</option>
                <option value="remoto" className="bg-[#0f1f3d]">Remoto</option>
                <option value="hibrido" className="bg-[#0f1f3d]">Híbrido</option>
              </select>
            </div>
          </div>

          {/* ── Separador sección: Contactos clave ── */}
          <div className="pt-1">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-sm font-semibold text-white/70 whitespace-nowrap">Contactos clave</h3>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Manager + Buddy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-white/45 mb-1.5">Manager</label>
                <select
                  value={form.manager_id}
                  onChange={e => setField('manager_id', e.target.value)}
                  className={inputCls() + ' appearance-none cursor-pointer'}
                >
                  <option value="" className="bg-[#0f1f3d]">Sin asignar</option>
                  {colaboradores.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#0f1f3d]">
                      {c.nombre} — {c.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/45 mb-1.5">Buddy</label>
                <select
                  value={form.buddy_id}
                  onChange={e => setField('buddy_id', e.target.value)}
                  className={inputCls() + ' appearance-none cursor-pointer'}
                >
                  <option value="" className="bg-[#0f1f3d]">Sin asignar</option>
                  {colaboradores.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#0f1f3d]">
                      {c.nombre} — {c.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Contacto IT */}
            <div className="mb-4">
              <p className="text-xs font-medium text-sky-400/80 mb-2.5 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400/70" />
                Contacto IT
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1.5">Nombre</label>
                  <input
                    type="text"
                    value={form.contacto_it_nombre}
                    onChange={e => setField('contacto_it_nombre', e.target.value)}
                    className={inputCls()}
                    placeholder="Nombre del contacto IT"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.contacto_it_email}
                    onChange={e => setField('contacto_it_email', e.target.value)}
                    className={inputCls()}
                    placeholder="it@empresa.com"
                  />
                </div>
              </div>
            </div>

            {/* Contacto RRHH */}
            <div>
              <p className="text-xs font-medium text-amber-400/80 mb-2.5 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/70" />
                Contacto RRHH
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1.5">Nombre</label>
                  <input
                    type="text"
                    value={form.contacto_rrhh_nombre}
                    onChange={e => setField('contacto_rrhh_nombre', e.target.value)}
                    className={inputCls()}
                    placeholder="Nombre del contacto RRHH"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.contacto_rrhh_email}
                    onChange={e => setField('contacto_rrhh_email', e.target.value)}
                    className={inputCls()}
                    placeholder="rrhh@empresa.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rol (solo admin/dev) */}
          {['admin', 'dev'].includes(rolAdmin) && (
            <div>
              <label className="block text-xs font-medium text-white/45 mb-1.5">
                Rol
                <Badge variant="info" className="ml-2">Solo admins</Badge>
              </label>
              <select
                value={form.rol}
                onChange={e => setField('rol', e.target.value)}
                className={inputCls() + ' appearance-none cursor-pointer'}
              >
                <option value="empleado" className="bg-[#0f1f3d]">Empleado</option>
                <option value="admin" className="bg-[#0f1f3d]">Admin</option>
                {rolAdmin === 'dev' && (
                  <option value="dev" className="bg-[#0f1f3d]">Dev</option>
                )}
              </select>
            </div>
          )}

          {/* Bio */}
          <div>
            <label className="block text-xs font-medium text-white/45 mb-1.5">Sobre el empleado</label>
            <textarea
              value={form.bio}
              onChange={e => setField('bio', e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08]
                text-white/85 placeholder:text-white/20 outline-none resize-none
                focus:bg-white/[0.06] focus:border-indigo-500/60 transition-colors duration-150"
              placeholder="Breve descripción del empleado..."
            />
          </div>

          {/* Fecha ingreso display */}
          {empleado.fecha_ingreso && (
            <p className="text-xs text-white/30">
              Ingresó el {formatFecha(empleado.fecha_ingreso)}
            </p>
          )}
        </motion.div>

        {/* ── Panel derecho ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Pre-boarding — visible solo cuando fecha_ingreso > hoy */}
          {empleado.fecha_ingreso && new Date(empleado.fecha_ingreso) > new Date() && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="glass-card rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-semibold text-white/70">Pre-boarding</h2>
                </div>
                {empleado.preboarding_activo && (
                  <Badge variant="success">Activo</Badge>
                )}
              </div>

              {empleado.preboarding_activo ? (
                <div className="mb-3 space-y-1">
                  <p className="text-xs text-white/55">
                    El empleado puede acceder a M1 y M2 antes de su ingreso oficial.
                  </p>
                  {empleado.fecha_acceso_preboarding && (
                    <p className="text-[11px] text-white/30">
                      Activado el {formatFecha(empleado.fecha_acceso_preboarding)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-white/35 mb-3">
                  El empleado no tiene acceso aún. Activá el pre-boarding para que explore la cultura antes de su ingreso.
                </p>
              )}

              <Button
                variant={empleado.preboarding_activo ? 'ghost' : 'primary'}
                size="sm"
                loading={togglingPreboarding}
                onClick={togglePreboarding}
                className="w-full"
              >
                <Zap className="w-3.5 h-3.5" />
                {empleado.preboarding_activo ? 'Desactivar pre-boarding' : 'Activar pre-boarding'}
              </Button>
            </motion.div>
          )}

          {/* Progreso por módulo */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.05 }}
            className="glass-card rounded-xl p-5 space-y-4"
          >
            <h2 className="text-sm font-semibold text-white/70">Progreso por módulo</h2>

            {/* M1 siempre completado */}
            <div className="flex items-center justify-between py-2 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                <span className="text-xs text-white/60">M1 — Perfil</span>
              </div>
              <Badge variant="success">Completado</Badge>
            </div>

            {/* M2, M3, M4 */}
            {MODULOS_CONFIG.map((mod, idx) => {
              const data = modulos.find(m => m.modulo === mod.key)
              const pct = data?.pct ?? 0
              const completados = data?.completados ?? 0
              const total = data?.total ?? 1

              return (
                <div key={mod.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {pct >= 100
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                        : pct > 0
                          ? <Circle className="w-3.5 h-3.5 text-indigo-400" />
                          : <Circle className="w-3.5 h-3.5 text-white/20" />
                      }
                      <span className={`text-xs ${mod.color}`}>{mod.label}</span>
                    </div>
                    <button
                      onClick={() => setResetModal(mod.key)}
                      className="flex items-center gap-1 text-[10px] text-white/25
                        hover:text-amber-400/70 transition-colors duration-150"
                      title={`Resetear ${mod.label}`}
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      Reset
                    </button>
                  </div>

                  <ProgressBar value={pct} showPercentage={false} />

                  <p className="text-[11px] text-white/30">
                    {mod.key === 'asistente'
                      ? completados > 0 ? 'Tiene conversaciones' : 'Sin conversaciones'
                      : `${completados} / ${total} bloques`}
                  </p>

                  {idx < MODULOS_CONFIG.length - 1 && (
                    <div className="border-b border-white/[0.04] pt-1" />
                  )}
                </div>
              )
            })}

            {/* Reset todo */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResetModal('todos')}
              className="w-full text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/[0.08] mt-1"
            >
              <RotateCcw className="w-3 h-3" />
              Resetear todo el progreso
            </Button>
          </motion.div>

          {/* Alertas del empleado */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.1 }}
            className="glass-card rounded-xl p-5 space-y-3"
          >
            <h2 className="text-sm font-semibold text-white/70">Alertas del empleado</h2>

            {alertas.length === 0 ? (
              <p className="text-xs text-white/30 py-4 text-center">Sin alertas registradas</p>
            ) : (
              <div className="space-y-2">
                {alertas.map(alerta => (
                  <div
                    key={alerta.id}
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]"
                  >
                    {alerta.resuelta
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-500/70 flex-shrink-0 mt-0.5" />
                      : <AlertCircle className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0 mt-0.5" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/65 line-clamp-2">{alerta.pregunta}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-2.5 h-2.5 text-white/20" />
                        <span className="text-[10px] text-white/30">
                          {tiempoRelativo(alerta.created_at)}
                        </span>
                        {alerta.resuelta && (
                          <Badge variant="success" className="text-[10px] py-0">Resuelta</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Modal de reset */}
      {resetModal && (
        <ResetProgresoModal
          empleadoId={empleado.id}
          empleadoNombre={empleado.nombre}
          modulo={resetModal}
          onClose={() => setResetModal(null)}
          onReset={() => { setResetModal(null); cargarDatos() }}
        />
      )}
    </div>
  )
}
