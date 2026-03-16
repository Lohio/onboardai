'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Save, BookOpen, Wrench, MessageSquare,
  RotateCcw, CheckCircle2, Circle, Clock, AlertCircle,
  CalendarDays, Zap, Sparkles, CheckSquare, ChevronDown,
  Pencil, BarChart2, Plus, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ResetProgresoModal, type ModuloReset } from '@/components/admin/ResetProgresoModal'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'

// ─────────────────────────────────────────────
// Tipos
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
  foto_url: string | null
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

interface ProgresoModuloChart {
  modulo: string
  label: string
  icon: React.ReactNode
  completados: number
  total: number
  pct: number
}

interface TimelineEvento {
  id: string
  tipo: 'ingreso' | 'bloque' | 'tarea'
  descripcion: string
  fecha: string
}

interface PreguntaIA {
  id: string
  pregunta: string
  respuesta: string
  fecha: string
}

interface TareaPendiente {
  id: string
  titulo: string
  semana: number
}

interface AccesoRow {
  id: string
  herramienta: string
  estado: 'activo' | 'pendiente' | 'sin_acceso'
  url: string | null
  notas: string | null
}

type TabKey = 'edicion' | 'progreso'

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

function formatFechaCorta(d: string): string {
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

function inputCls(error?: boolean): string {
  return [
    'w-full h-9 px-3 rounded-lg text-sm bg-white/[0.04] border text-white/85',
    'placeholder:text-white/20 outline-none transition-colors duration-150',
    'focus:bg-white/[0.06] focus:border-indigo-500/60',
    error ? 'border-red-500/50' : 'border-white/[0.08]',
  ].join(' ')
}

function renderLinea(line: string, key: number): React.ReactNode {
  if (line.startsWith('## ')) {
    return <h3 key={key} className="text-sm font-semibold text-white/90 mt-5 mb-2 first:mt-0">{line.slice(3)}</h3>
  }
  if (line.startsWith('- ')) {
    return <li key={key} className="text-sm text-white/65 ml-4 list-disc">{line.slice(2)}</li>
  }
  if (line.trim() === '') return <br key={key} />
  return <p key={key} className="text-sm text-white/65 leading-relaxed">{line}</p>
}

const MODULOS_CONFIG = [
  { key: 'cultura' as const, label: 'M2 — Cultura', icon: <BookOpen className="w-3.5 h-3.5" />, color: 'text-indigo-400' },
  { key: 'rol' as const, label: 'M3 — Rol y herramientas', icon: <Wrench className="w-3.5 h-3.5" />, color: 'text-teal-400' },
  { key: 'asistente' as const, label: 'M4 — Asistente IA', icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-amber-400' },
]

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-48 bg-white/[0.06] rounded" />
      <div className="h-10 bg-white/[0.04] rounded-xl" />
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

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function EmpleadoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [tab, setTab] = useState<TabKey>('edicion')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingPreboarding, setTogglingPreboarding] = useState(false)

  // Edición
  const [empleado, setEmpleado] = useState<EmpleadoFull | null>(null)
  const [rolAdmin, setRolAdmin] = useState<UserRole>('admin')
  const [form, setForm] = useState<FormData | null>(null)
  const [modulos, setModulos] = useState<ProgresoModulo[]>([])
  const [alertas, setAlertas] = useState<AlertaRow[]>([])
  const [colaboradores, setColaboradores] = useState<ColaboradorRow[]>([])
  const [resetModal, setResetModal] = useState<ModuloReset | null>(null)

  // Progreso
  const [progresos, setProgresos] = useState<ProgresoModuloChart[]>([])
  const [timeline, setTimeline] = useState<TimelineEvento[]>([])
  const [preguntas, setPreguntas] = useState<PreguntaIA[]>([])
  const [tareasPendientes, setTareasPendientes] = useState<TareaPendiente[]>([])
  const [generando, setGenerando] = useState(false)
  const [reporte, setReporte] = useState('')
  const [reporteVisible, setReporteVisible] = useState(false)

  // Accesos y herramientas
  const [accesos, setAccesos] = useState<AccesoRow[]>([])
  const [empresaId, setEmpresaId] = useState<string>('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [focusNewId, setFocusNewId] = useState<string | null>(null)
  // Timers de debounce por fila (clave: `{id}_{campo}`)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ── Carga de datos ──
  const cargarDatos = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

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
      setEmpresaId(adminData.empresa_id)

      // ── Datos del empleado ──
      const { data: empData, error: empError } = await supabase
        .from('usuarios')
        .select(`id, nombre, email, puesto, area, fecha_ingreso,
          modalidad, manager_id, buddy_id, bio, rol, foto_url,
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

      if (adminData.rol !== 'dev') {
        const { data: check } = await supabase
          .from('usuarios').select('empresa_id').eq('id', id).single()
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

      // ── Queries en paralelo: edición + progreso ──
      const [
        conocimientoRes,
        progresoRes,
        convCountRes,
        alertaRes,
        colabRes,
        culturaCntRes,
        tareasCompRes,
        tareasPendRes,
        accesosRes,
      ] = await Promise.all([
        supabase.from('conocimiento').select('modulo').eq('empresa_id', adminData.empresa_id),
        supabase.from('progreso_modulos').select('modulo, bloque, completado, completado_at').eq('usuario_id', id),
        supabase.from('conversaciones_ia').select('*', { count: 'exact', head: true }).eq('usuario_id', id),
        supabase.from('alertas_conocimiento').select('id, pregunta, created_at, resuelta')
          .eq('empresa_id', adminData.empresa_id).eq('usuario_id', id)
          .order('created_at', { ascending: false }).limit(8),
        supabase.from('usuarios').select('id, nombre, email')
          .eq('empresa_id', adminData.empresa_id).neq('id', id).neq('rol', 'dev').order('nombre'),
        supabase.from('conocimiento').select('*', { count: 'exact', head: true })
          .eq('empresa_id', adminData.empresa_id).eq('modulo', 'cultura'),
        supabase.from('tareas_onboarding').select('id, titulo, semana, completada, completada_at')
          .eq('usuario_id', id).eq('completada', true).order('completada_at', { ascending: false }),
        supabase.from('tareas_onboarding').select('id, titulo, semana')
          .eq('usuario_id', id).eq('completada', false).order('semana').limit(10),
        supabase.from('accesos_herramientas').select('id, herramienta, estado, url, notas')
          .eq('usuario_id', id).order('herramienta'),
      ])

      const progresoRows = progresoRes.data ?? []
      const totalesPorModulo: Record<string, number> = {}
      for (const row of (conocimientoRes.data ?? [])) {
        totalesPorModulo[row.modulo] = (totalesPorModulo[row.modulo] ?? 0) + 1
      }
      const completadosPorModulo: Record<string, number> = {}
      for (const row of progresoRows.filter(r => r.completado)) {
        completadosPorModulo[row.modulo] = (completadosPorModulo[row.modulo] ?? 0) + 1
      }

      // Módulos para panel edición (barra lateral)
      const convCount = convCountRes.count ?? 0
      setModulos([
        { modulo: 'cultura', total: totalesPorModulo['cultura'] ?? 5, completados: completadosPorModulo['cultura'] ?? 0, pct: 0 },
        { modulo: 'rol', total: totalesPorModulo['rol'] ?? 1, completados: completadosPorModulo['rol'] ?? 0, pct: 0 },
        { modulo: 'asistente', total: 1, completados: convCount > 0 ? 1 : 0, pct: 0 },
      ].map(m => ({ ...m, pct: m.total > 0 ? Math.min(100, Math.round((m.completados / m.total) * 100)) : 0 })))

      setAlertas((alertaRes.data ?? []) as AlertaRow[])
      setColaboradores((colabRes.data ?? []) as ColaboradorRow[])
      // Accesos — tabla puede no existir aún si el SQL no fue ejecutado
      if (accesosRes.data) setAccesos(accesosRes.data as AccesoRow[])

      // Módulos para tab progreso (con chart)
      const totalCultura = culturaCntRes.count ?? 0
      const compCultura = progresoRows.filter(p => p.modulo === 'cultura' && p.completado).length
      const compRol = progresoRows.filter(p => p.modulo === 'rol' && p.completado).length
      setProgresos([
        {
          modulo: 'cultura', label: 'Cultura e Identidad',
          icon: <BookOpen className="w-4 h-4" />,
          completados: compCultura, total: totalCultura,
          pct: totalCultura > 0 ? Math.round((compCultura / totalCultura) * 100) : 0,
        },
        {
          modulo: 'rol', label: 'Rol y Herramientas',
          icon: <Wrench className="w-4 h-4" />,
          completados: compRol, total: 1,
          pct: compRol > 0 ? 100 : 0,
        },
      ])

      // Tareas pendientes (tab progreso)
      setTareasPendientes((tareasPendRes.data ?? []) as TareaPendiente[])

      // Timeline
      const eventos: TimelineEvento[] = []
      if (empData.fecha_ingreso) {
        eventos.push({ id: 'ingreso', tipo: 'ingreso', descripcion: 'Ingresó a la empresa', fecha: empData.fecha_ingreso })
      }
      for (const p of progresoRows.filter(p => p.completado && p.completado_at)) {
        eventos.push({
          id: `bloque-${p.modulo}-${p.bloque}`,
          tipo: 'bloque',
          descripcion: `Completó "${p.bloque.replace(/_/g, ' ')}" en ${p.modulo === 'cultura' ? 'Cultura' : 'Rol'}`,
          fecha: p.completado_at as string,
        })
      }
      for (const t of (tareasCompRes.data ?? [])) {
        if (t.completada_at) {
          eventos.push({ id: `tarea-${t.id}`, tipo: 'tarea', descripcion: `Completó tarea: ${t.titulo}`, fecha: t.completada_at })
        }
      }
      eventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      setTimeline(eventos.slice(0, 10))

      // Preguntas IA
      try {
        const { data: convs } = await supabase
          .from('conversaciones_ia').select('id')
          .eq('usuario_id', id).order('updated_at', { ascending: false }).limit(5)
        if (convs && convs.length > 0) {
          const { data: msgs } = await supabase
            .from('mensajes_ia').select('id, conversacion_id, role, contenido, created_at')
            .in('conversacion_id', convs.map(c => c.id)).order('created_at', { ascending: true })
          if (msgs) {
            const pares: PreguntaIA[] = []
            for (const conv of convs) {
              const convMsgs = msgs.filter(m => m.conversacion_id === conv.id)
              const userMsg = convMsgs.find(m => m.role === 'user')
              const assistantMsg = convMsgs.find(m => m.role === 'assistant')
              if (userMsg && assistantMsg) {
                pares.push({ id: userMsg.id, pregunta: userMsg.contenido, respuesta: assistantMsg.contenido, fecha: userMsg.created_at })
              }
            }
            setPreguntas(pares.slice(0, 5))
          }
        }
      } catch { /* tabla puede no existir */ }

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
      if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); return }
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

  // ── Toggle pre-boarding ──
  async function togglePreboarding() {
    if (!empleado || togglingPreboarding) return
    const nuevoEstado = !empleado.preboarding_activo
    setTogglingPreboarding(true)
    try {
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
        const { error } = await supabase.from('usuarios').update({ preboarding_activo: false }).eq('id', empleado.id)
        if (error) { toast.error('Error al desactivar pre-boarding'); return }
        toast.success('Pre-boarding desactivado')
      }
      setEmpleado(prev => prev
        ? { ...prev, preboarding_activo: nuevoEstado, fecha_acceso_preboarding: nuevoEstado ? new Date().toISOString() : prev.fecha_acceso_preboarding }
        : prev,
      )
    } catch {
      toast.error('Error de conexión')
    } finally {
      setTogglingPreboarding(false)
    }
  }

  // ── Generar reporte ──
  async function generarReporte() {
    setGenerando(true)
    setReporte('')
    setReporteVisible(true)
    try {
      const res = await fetch(`/api/admin/reporte/${id}`, { method: 'POST' })
      if (!res.ok || !res.body) throw new Error('Error en la respuesta')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setReporte(prev => prev + decoder.decode(value, { stream: true }))
      }
    } catch {
      setReporte('Error al generar el reporte. Intentá de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  // ── Clases de color para el select de estado de accesos ──
  function selectEstadoCls(estado: AccesoRow['estado']): string {
    if (estado === 'activo')    return 'text-teal-400 bg-teal-500/10 border-teal-500/20'
    if (estado === 'pendiente') return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    return 'text-red-400 bg-red-500/10 border-red-500/20'
  }

  // ── Agregar nuevo acceso ──
  async function agregarAcceso(nombreHerramienta = '') {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('accesos_herramientas')
      .insert({ usuario_id: id, empresa_id: empresaId, herramienta: nombreHerramienta, estado: 'pendiente' })
      .select('id, herramienta, estado, url, notas')
      .single()
    if (error) { toast.error('No se pudo agregar la herramienta'); return }
    setAccesos(prev => [...prev, data as AccesoRow])
    setFocusNewId((data as AccesoRow).id)
  }

  // ── Actualizar estado (optimistic) ──
  async function actualizarEstado(accesoId: string, nuevoEstado: AccesoRow['estado']) {
    const prev = accesos.find(a => a.id === accesoId)
    setAccesos(list => list.map(a => a.id === accesoId ? { ...a, estado: nuevoEstado } : a))
    const supabase = createClient()
    const { error } = await supabase
      .from('accesos_herramientas')
      .update({ estado: nuevoEstado })
      .eq('id', accesoId)
    if (error) {
      toast.error('No se pudo actualizar el estado')
      // Revertir al estado anterior
      if (prev) setAccesos(list => list.map(a => a.id === accesoId ? { ...a, estado: prev.estado } : a))
    }
  }

  // ── Actualizar campo con debounce de 800ms (herramienta o url) ──
  function actualizarCampoDebounced(accesoId: string, campo: 'herramienta' | 'url', valor: string) {
    setAccesos(list => list.map(a => a.id === accesoId ? { ...a, [campo]: valor || null } : a))
    const key = `${accesoId}_${campo}`
    clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(async () => {
      const supabase = createClient()
      await supabase
        .from('accesos_herramientas')
        .update({ [campo]: valor.trim() || null })
        .eq('id', accesoId)
    }, 800)
  }

  // ── Eliminar acceso ──
  async function eliminarAcceso(accesoId: string) {
    setAccesos(prev => prev.filter(a => a.id !== accesoId))
    setConfirmDeleteId(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('accesos_herramientas')
      .delete()
      .eq('id', accesoId)
    if (error) { toast.error('No se pudo eliminar'); cargarDatos() }
  }

  // ── Loading ──
  if (loading || !form || !empleado) return <Skeleton />

  const initials = getInitials(empleado.nombre)

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/admin/empleados"
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors duration-150 flex-shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Empleados
        </Link>

        {/* Avatar + nombre */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-600/25 border border-indigo-500/25
            flex items-center justify-center flex-shrink-0 overflow-hidden">
            {empleado.foto_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={empleado.foto_url} alt={empleado.nombre} className="w-full h-full object-cover" />
              : <span className="text-indigo-300 text-xs font-semibold">{initials}</span>
            }
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-white truncate">{empleado.nombre}</h1>
            <p className="text-xs text-white/40">{empleado.email}</p>
          </div>
        </div>

        {/* Acción según tab */}
        {tab === 'edicion' && (
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            <Save className="w-3.5 h-3.5" />
            Guardar cambios
          </Button>
        )}
        {tab === 'progreso' && (
          <button
            onClick={generarReporte}
            disabled={generando}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-indigo-600 hover:bg-indigo-500 text-white transition-colors duration-150
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {generando
              ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" />Generando...</>
              : <><Sparkles className="w-3 h-3" />Generar reporte</>
            }
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b border-white/[0.07] pb-0">
        {([
          { key: 'edicion' as TabKey, label: 'Edición', icon: <Pencil className="w-3.5 h-3.5" /> },
          { key: 'progreso' as TabKey, label: 'Progreso y reporte', icon: <BarChart2 className="w-3.5 h-3.5" /> },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors duration-150',
              tab === t.key
                ? 'border-indigo-400 text-white'
                : 'border-transparent text-white/40 hover:text-white/70',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenido ── */}
      <AnimatePresence mode="wait">
        {tab === 'edicion' && (
          <motion.div
            key="edicion"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* ── Formulario ── */}
              <div className="lg:col-span-3 glass-card rounded-xl p-6 space-y-5">
                <h2 className="text-sm font-semibold text-white/70">Datos personales</h2>

                <div>
                  <label className="block text-xs font-medium text-white/45 mb-1.5">Nombre completo</label>
                  <input type="text" value={form.nombre} onChange={e => setField('nombre', e.target.value)} className={inputCls()} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/45 mb-1.5">
                    Email <span className="text-white/25">(no editable)</span>
                  </label>
                  <input type="email" value={empleado.email} readOnly
                    className="w-full h-9 px-3 rounded-lg text-sm bg-white/[0.02] border border-white/[0.05] text-white/40 outline-none cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/45 mb-1.5">Puesto</label>
                    <input type="text" value={form.puesto} onChange={e => setField('puesto', e.target.value)} className={inputCls()} placeholder="Ej: Desarrollador" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/45 mb-1.5">Área</label>
                    <input type="text" value={form.area} onChange={e => setField('area', e.target.value)} className={inputCls()} placeholder="Ej: Producto" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/45 mb-1.5">Fecha de ingreso</label>
                    <input type="date" value={form.fecha_ingreso} onChange={e => setField('fecha_ingreso', e.target.value)} className={inputCls()} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/45 mb-1.5">Modalidad</label>
                    <select value={form.modalidad} onChange={e => setField('modalidad', e.target.value)} className={inputCls() + ' appearance-none cursor-pointer'}>
                      <option value="" className="bg-[#0f1f3d]">Sin definir</option>
                      <option value="presencial" className="bg-[#0f1f3d]">Presencial</option>
                      <option value="remoto" className="bg-[#0f1f3d]">Remoto</option>
                      <option value="hibrido" className="bg-[#0f1f3d]">Híbrido</option>
                    </select>
                  </div>
                </div>

                {/* Contactos clave */}
                <div className="pt-1">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-white/70 whitespace-nowrap">Contactos clave</h3>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-white/45 mb-1.5">Manager</label>
                      <select value={form.manager_id} onChange={e => setField('manager_id', e.target.value)} className={inputCls() + ' appearance-none cursor-pointer'}>
                        <option value="" className="bg-[#0f1f3d]">Sin asignar</option>
                        {colaboradores.map(c => (
                          <option key={c.id} value={c.id} className="bg-[#0f1f3d]">{c.nombre} — {c.email}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white/45 mb-1.5">Buddy</label>
                      <select value={form.buddy_id} onChange={e => setField('buddy_id', e.target.value)} className={inputCls() + ' appearance-none cursor-pointer'}>
                        <option value="" className="bg-[#0f1f3d]">Sin asignar</option>
                        {colaboradores.map(c => (
                          <option key={c.id} value={c.id} className="bg-[#0f1f3d]">{c.nombre} — {c.email}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs font-medium text-sky-400/80 mb-2.5 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400/70" />
                      Contacto IT
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-white/40 mb-1.5">Nombre</label>
                        <input type="text" value={form.contacto_it_nombre} onChange={e => setField('contacto_it_nombre', e.target.value)} className={inputCls()} placeholder="Nombre del contacto IT" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/40 mb-1.5">Email</label>
                        <input type="email" value={form.contacto_it_email} onChange={e => setField('contacto_it_email', e.target.value)} className={inputCls()} placeholder="it@empresa.com" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-amber-400/80 mb-2.5 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/70" />
                      Contacto RRHH
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-white/40 mb-1.5">Nombre</label>
                        <input type="text" value={form.contacto_rrhh_nombre} onChange={e => setField('contacto_rrhh_nombre', e.target.value)} className={inputCls()} placeholder="Nombre del contacto RRHH" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/40 mb-1.5">Email</label>
                        <input type="email" value={form.contacto_rrhh_email} onChange={e => setField('contacto_rrhh_email', e.target.value)} className={inputCls()} placeholder="rrhh@empresa.com" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Accesos y herramientas ── */}
                <div className="pt-1">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-white/70 whitespace-nowrap">Accesos y herramientas</h3>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>

                  {/* Lista de accesos */}
                  <div className="space-y-0 mb-3">
                    <AnimatePresence initial={false}>
                      {accesos.map(acceso => (
                        <motion.div
                          key={acceso.id}
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                          className="flex flex-wrap items-center gap-2 py-2 border-b border-white/[0.04] last:border-0"
                        >
                          {/* Nombre de la herramienta */}
                          <input
                            type="text"
                            value={acceso.herramienta}
                            autoFocus={acceso.id === focusNewId}
                            onFocus={() => setFocusNewId(null)}
                            onChange={e => actualizarCampoDebounced(acceso.id, 'herramienta', e.target.value)}
                            placeholder="Nombre de la herramienta"
                            className="flex-1 min-w-[120px] text-sm bg-transparent border-none outline-none text-white/80 placeholder:text-white/20 px-1 focus:bg-white/[0.04] focus:rounded focus:px-2 transition-all duration-150"
                          />

                          {/* Select de estado coloreado */}
                          <select
                            value={acceso.estado}
                            onChange={e => actualizarEstado(acceso.id, e.target.value as AccesoRow['estado'])}
                            className={cn(
                              'w-30 h-7 px-2 rounded-md text-xs border outline-none cursor-pointer appearance-none font-medium transition-colors duration-150',
                              selectEstadoCls(acceso.estado),
                            )}
                          >
                            <option value="activo"     className="bg-[#0f1f3d] text-teal-400">Activo</option>
                            <option value="pendiente"  className="bg-[#0f1f3d] text-amber-400">Pendiente</option>
                            <option value="sin_acceso" className="bg-[#0f1f3d] text-red-400">Sin acceso</option>
                          </select>

                          {/* URL — solo visible si estado es activo */}
                          {acceso.estado === 'activo' && (
                            <input
                              type="url"
                              value={acceso.url ?? ''}
                              onChange={e => actualizarCampoDebounced(acceso.id, 'url', e.target.value)}
                              placeholder="URL del acceso"
                              className="w-full sm:w-44 text-xs bg-transparent border-none outline-none text-white/40 placeholder:text-white/20 px-1 focus:bg-white/[0.04] focus:rounded focus:px-2 transition-all duration-150"
                            />
                          )}

                          {/* Confirmar eliminación inline */}
                          {confirmDeleteId === acceso.id ? (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <span className="text-xs text-white/40">¿Eliminar?</span>
                              <button
                                onClick={() => eliminarAcceso(acceso.id)}
                                className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors duration-150"
                              >
                                Sí
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs px-2 py-0.5 rounded bg-white/[0.04] text-white/40 hover:bg-white/[0.08] transition-colors duration-150"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(acceso.id)}
                              className="ml-auto text-white/20 hover:text-red-400 transition-colors duration-150 flex-shrink-0 p-1"
                              title="Eliminar herramienta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Chips de herramientas sugeridas (solo si lista vacía) */}
                  {accesos.length === 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {['Gmail', 'Slack', 'Notion', 'GitHub', 'Jira', 'Teams', 'Figma', 'Drive', 'Zoom', 'HubSpot'].map(nombre => (
                        <button
                          key={nombre}
                          onClick={() => agregarAcceso(nombre)}
                          className="px-2.5 py-1 rounded-md text-xs bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors duration-150"
                        >
                          {nombre}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Botón agregar */}
                  <Button variant="ghost" size="sm" onClick={() => agregarAcceso()}>
                    <Plus className="w-3.5 h-3.5" />
                    Agregar herramienta
                  </Button>
                </div>

                {/* Rol */}
                {['admin', 'dev'].includes(rolAdmin) && (
                  <div>
                    <label className="block text-xs font-medium text-white/45 mb-1.5">
                      Rol <Badge variant="info" className="ml-2">Solo admins</Badge>
                    </label>
                    <select value={form.rol} onChange={e => setField('rol', e.target.value)} className={inputCls() + ' appearance-none cursor-pointer'}>
                      <option value="empleado" className="bg-[#0f1f3d]">Empleado</option>
                      <option value="admin" className="bg-[#0f1f3d]">Admin</option>
                      {rolAdmin === 'dev' && <option value="dev" className="bg-[#0f1f3d]">Dev</option>}
                    </select>
                  </div>
                )}

                {/* Bio */}
                <div>
                  <label className="block text-xs font-medium text-white/45 mb-1.5">Sobre el empleado</label>
                  <textarea
                    value={form.bio} onChange={e => setField('bio', e.target.value)} rows={3}
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08]
                      text-white/85 placeholder:text-white/20 outline-none resize-none
                      focus:bg-white/[0.06] focus:border-indigo-500/60 transition-colors duration-150"
                    placeholder="Breve descripción del empleado..."
                  />
                </div>

                {empleado.fecha_ingreso && (
                  <p className="text-xs text-white/30">Ingresó el {formatFecha(empleado.fecha_ingreso)}</p>
                )}
              </div>

              {/* ── Panel derecho ── */}
              <div className="lg:col-span-2 space-y-5">

                {/* Pre-boarding */}
                {empleado.fecha_ingreso && new Date(empleado.fecha_ingreso) > new Date() && (
                  <div className="glass-card rounded-xl p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-indigo-400" />
                        <h2 className="text-sm font-semibold text-white/70">Pre-boarding</h2>
                      </div>
                      {empleado.preboarding_activo && <Badge variant="success">Activo</Badge>}
                    </div>
                    {empleado.preboarding_activo ? (
                      <div className="mb-3 space-y-1">
                        <p className="text-xs text-white/55">El empleado puede acceder a M1 y M2 antes de su ingreso oficial.</p>
                        {empleado.fecha_acceso_preboarding && (
                          <p className="text-[11px] text-white/30">Activado el {formatFecha(empleado.fecha_acceso_preboarding)}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-white/35 mb-3">
                        El empleado no tiene acceso aún. Activá el pre-boarding para que explore la cultura antes de su ingreso.
                      </p>
                    )}
                    <Button variant={empleado.preboarding_activo ? 'ghost' : 'primary'} size="sm"
                      loading={togglingPreboarding} onClick={togglePreboarding} className="w-full">
                      <Zap className="w-3.5 h-3.5" />
                      {empleado.preboarding_activo ? 'Desactivar pre-boarding' : 'Activar pre-boarding'}
                    </Button>
                  </div>
                )}

                {/* Progreso por módulo */}
                <div className="glass-card rounded-xl p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-white/70">Progreso por módulo</h2>

                  <div className="flex items-center justify-between py-2 border-b border-white/[0.05]">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                      <span className="text-xs text-white/60">M1 — Perfil</span>
                    </div>
                    <Badge variant="success">Completado</Badge>
                  </div>

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
                          <button onClick={() => setResetModal(mod.key)}
                            className="flex items-center gap-1 text-[10px] text-white/25 hover:text-amber-400/70 transition-colors duration-150"
                            title={`Resetear ${mod.label}`}>
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
                        {idx < MODULOS_CONFIG.length - 1 && <div className="border-b border-white/[0.04] pt-1" />}
                      </div>
                    )
                  })}

                  <Button variant="ghost" size="sm" onClick={() => setResetModal('todos')}
                    className="w-full text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/[0.08] mt-1">
                    <RotateCcw className="w-3 h-3" />
                    Resetear todo el progreso
                  </Button>

                  {/* Mini resumen de accesos */}
                  {accesos.length > 0 && (
                    <p className="text-[11px] text-white/30 text-center pt-1">
                      Accesos:{' '}
                      <span className="text-teal-400/70">
                        {accesos.filter(a => a.estado === 'activo').length} activos
                      </span>
                      {' · '}
                      <span className="text-amber-400/70">
                        {accesos.filter(a => a.estado === 'pendiente').length} pendientes
                      </span>
                    </p>
                  )}
                </div>

                {/* Alertas */}
                <div className="glass-card rounded-xl p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-white/70">Alertas del empleado</h2>
                  {alertas.length === 0 ? (
                    <p className="text-xs text-white/30 py-4 text-center">Sin alertas registradas</p>
                  ) : (
                    <div className="space-y-2">
                      {alertas.map(alerta => (
                        <div key={alerta.id} className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                          {alerta.resuelta
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-teal-500/70 flex-shrink-0 mt-0.5" />
                            : <AlertCircle className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0 mt-0.5" />
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/65 line-clamp-2">{alerta.pregunta}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="w-2.5 h-2.5 text-white/20" />
                              <span className="text-[10px] text-white/30">{tiempoRelativo(alerta.created_at)}</span>
                              {alerta.resuelta && <Badge variant="success" className="text-[10px] py-0">Resuelta</Badge>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'progreso' && (
          <motion.div
            key="progreso"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="space-y-4"
          >
            {/* Fila: Progreso módulos + Tareas pendientes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass-card rounded-xl p-5">
                <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">
                  Progreso por módulo
                </h2>
                <div className="space-y-5">
                  {progresos.map(p => (
                    <div key={p.modulo}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-white/30">{p.icon}</span>
                        <span className="text-sm text-white/75">{p.label}</span>
                        <span className="ml-auto text-xs font-mono text-white/45">{p.completados}/{p.total} bloques</span>
                      </div>
                      <ProgressBar value={p.pct} animated />
                    </div>
                  ))}
                  {progresos.length === 0 && (
                    <p className="text-sm text-white/30 text-center py-4">Sin datos de progreso</p>
                  )}
                </div>
              </div>

              <div className="glass-card rounded-xl p-5">
                <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">
                  Tareas pendientes
                </h2>
                {tareasPendientes.length === 0 ? (
                  <div className="py-6 flex flex-col items-center gap-2">
                    <CheckSquare className="w-6 h-6 text-teal-500/30" />
                    <p className="text-xs text-white/30">Todas las tareas completadas</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tareasPendientes.map(t => (
                      <div key={t.id} className="flex items-start gap-2.5 py-2 border-b border-white/[0.04] last:border-0">
                        <div className="w-4 h-4 mt-0.5 rounded border border-white/20 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/70 leading-snug">{t.titulo}</p>
                          <p className="text-[11px] text-white/30 mt-0.5">Semana {t.semana}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Fila: Timeline + Preguntas IA */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass-card rounded-xl p-5">
                <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Actividad reciente
                </h2>
                {timeline.length === 0 ? (
                  <p className="text-sm text-white/30 text-center py-4">Sin actividad registrada</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.06]" />
                    {timeline.map((evento, idx) => (
                      <div key={evento.id} className="flex items-start gap-3 pb-3 last:pb-0">
                        <div className="flex-shrink-0 mt-0.5 relative z-10 bg-[#0f1f3d]">
                          {evento.tipo === 'ingreso' && <Circle className="w-3.5 h-3.5 text-indigo-400" />}
                          {evento.tipo === 'bloque' && <BookOpen className="w-3.5 h-3.5 text-teal-400" />}
                          {evento.tipo === 'tarea' && <CheckSquare className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/65 leading-snug">{evento.descripcion}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">
                            {idx === 0 ? tiempoRelativo(evento.fecha) : formatFechaCorta(evento.fecha)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-card rounded-xl p-5">
                <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Últimas preguntas al asistente
                </h2>
                {preguntas.length === 0 ? (
                  <div className="py-6 flex flex-col items-center gap-2">
                    <MessageSquare className="w-6 h-6 text-white/10" />
                    <p className="text-xs text-white/30 text-center">Sin preguntas registradas aún</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {preguntas.map(p => (
                      <div key={p.id} className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3">
                        <p className="text-xs font-medium text-white/80 leading-snug line-clamp-2">{p.pregunta}</p>
                        <p className="text-[11px] text-white/40 mt-1.5 leading-snug line-clamp-3">{p.respuesta}</p>
                        <p className="text-[10px] text-white/25 mt-1.5">{tiempoRelativo(p.fecha)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reporte ejecutivo */}
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
                <div>
                  <h2 className="text-sm font-medium text-white/80">Reporte ejecutivo</h2>
                  <p className="text-xs text-white/35 mt-0.5">Resumen del onboarding generado por IA con recomendaciones</p>
                </div>
              </div>

              <AnimatePresence>
                {reporteVisible && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-white/[0.06]">
                      {reporte ? (
                        <div className="space-y-1">
                          {reporte.split('\n').map((line, i) => renderLinea(line, i))}
                          {generando && <span className="inline-block w-1 h-4 bg-indigo-400 animate-pulse ml-0.5" />}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-white/40 text-sm">
                          <div className="w-4 h-4 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin-fast" />
                          Iniciando generación...
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {reporteVisible && reporte && !generando && (
                <button
                  onClick={() => setReporteVisible(false)}
                  className="mt-3 flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors duration-150"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  Ocultar reporte
                </button>
              )}

              {!reporteVisible && (
                <p className="text-xs text-white/30 mt-2">
                  Hacé clic en "Generar reporte" para obtener un análisis completo del onboarding.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
