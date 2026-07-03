'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, BookOpen, Wrench, Sparkles, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { ResetProgresoModal, type ModuloReset } from '@/components/admin/ResetProgresoModal'
import { cn } from '@/lib/utils'
import type { UserRole, PlanItem, PlanFase, PlanTipo } from '@/types'
import type {
  EmpleadoFull, FormData, ProgresoModulo, AlertaRow, ColaboradorRow,
  ProgresoModuloChart, TimelineEvento, PreguntaIA, TareaPendiente,
  AccesoRow, AccesoEditDraft, ChipDraft, TabKey,
} from '@/components/admin/empleado-detalle/types'
import { getInitials } from '@/components/admin/empleado-detalle/helpers'
import { useLanguage } from '@/components/LanguageProvider'
import { TabEdicion } from '@/components/admin/empleado-detalle/TabEdicion'
import { TabRol } from '@/components/admin/empleado-detalle/TabRol'
import { TabProgreso } from '@/components/admin/empleado-detalle/TabProgreso'
import { TabPlan } from '@/components/admin/empleado-detalle/TabPlan'

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
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
  const { t } = useLanguage()

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
  const [generandoResumen, setGenerandoResumen] = useState(false)
  const [resumen, setResumen] = useState('')
  const [resumenVisible, setResumenVisible] = useState(false)

  // Accesos y herramientas
  const [accesos, setAccesos] = useState<AccesoRow[]>([])
  const [empresaId, setEmpresaId] = useState<string>('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // Panel expandible — solo uno abierto a la vez
  const [expandedAccesoId, setExpandedAccesoId] = useState<string | null>(null)
  const [accesoEdits, setAccesoEdits] = useState<Record<string, AccesoEditDraft>>({})
  const [showPassAcceso, setShowPassAcceso] = useState<Record<string, boolean>>({})
  // Chip seleccionado localmente (antes de guardar en DB)
  const [chipDraft, setChipDraft] = useState<ChipDraft | null>(null)
  // Visibilidad de contraseñas en datos personales
  const [showPassCorp, setShowPassCorp] = useState(false)
  const [showPassBitlocker, setShowPassBitlocker] = useState(false)

  // Descripción del rol (listas dinámicas)
  const [rolResponsabilidades, setRolResponsabilidades] = useState<string[]>([])
  const [rolKpis, setRolKpis] = useState<string[]>([])
  const [rolHerramientas, setRolHerramientas] = useState<Array<{ nombre: string; uso: string }>>([])
  const [rolAutonomia, setRolAutonomia] = useState<string>('')

  // Plan 30-60-90
  const [planItems, setPlanItems] = useState<PlanItem[]>([])
  const [planFase, setPlanFase] = useState<PlanFase>('30')
  const [planForm, setPlanForm] = useState({ titulo: '', tipo: 'objetivo' as PlanTipo, fecha_target: '', descripcion: '' })
  const [planSaving, setPlanSaving] = useState(false)
  const [planToggling, setPlanToggling] = useState<string | null>(null)

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
      const [{ data: empData, error: empError }, passwordsRes] = await Promise.all([
        supabase
          .from('usuarios')
          .select(`id, nombre, email, puesto, area, fecha_ingreso,
            modalidad, manager_id, buddy_id, bio, rol, foto_url,
            contacto_it_nombre, contacto_it_email,
            contacto_rrhh_nombre, contacto_rrhh_email,
            preboarding_activo, fecha_acceso_preboarding,
            rol_responsabilidades, rol_kpis, rol_herramientas, rol_autonomia`)
          .eq('id', id)
          .single(),
        // Passwords se obtienen por endpoint separado — descifrado server-side
        fetch(`/api/admin/empleados/${id}/passwords`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null),
      ])

      if (empError || !empData) {
        toast.error(t('adminEmp.det.notFound'))
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

      const passwords = passwordsRes as { password_corporativo: string | null; password_bitlocker: string | null } | null
      setEmpleado({ ...empData, ...passwords } as EmpleadoFull)
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
        password_corporativo: passwords?.password_corporativo ?? '',
        password_bitlocker:   passwords?.password_bitlocker   ?? '',
      })
      setRolResponsabilidades((empData.rol_responsabilidades as string[] | null) ?? [])
      setRolKpis((empData.rol_kpis as string[] | null) ?? [])
      setRolHerramientas((empData.rol_herramientas as Array<{ nombre: string; uso: string }> | null) ?? [])
      setRolAutonomia((empData.rol_autonomia as string | null) ?? '')

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
        supabase.from('accesos_herramientas').select('id, herramienta, estado, url, notas, usuario_acceso, password_acceso')
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
        { modulo: 'rol', total: 1, completados: completadosPorModulo['rol'] ?? 0, pct: 0 },
        { modulo: 'asistente', total: 1, completados: convCount > 0 ? 1 : 0, pct: 0 },
      ].map(m => ({ ...m, pct: m.total > 0 ? Math.min(100, Math.round((m.completados / m.total) * 100)) : 0 })))

      setAlertas((alertaRes.data ?? []) as AlertaRow[])
      setColaboradores((colabRes.data ?? []) as ColaboradorRow[])
      // Accesos — tabla puede no existir aún si el SQL no fue ejecutado
      if (accesosRes.data) setAccesos(accesosRes.data as AccesoRow[])

      // Módulos para tab progreso (con chart)
      // Total siempre 5: los 5 bloques únicos de cultura (historia, mision, como_trabajamos, expectativas, hitos)
      const totalCultura = 5
      const compCultura = progresoRows.filter(p => p.modulo === 'cultura' && p.completado).length
      const compRol = progresoRows.filter(p => p.modulo === 'rol' && p.completado).length
      setProgresos([
        {
          modulo: 'cultura', label: t('adminEmp.det.cultureLabel'),
          icon: <BookOpen className="w-4 h-4" />,
          completados: compCultura, total: totalCultura,
          pct: totalCultura > 0 ? Math.round((compCultura / totalCultura) * 100) : 0,
        },
        {
          modulo: 'rol', label: t('adminEmp.det.roleLabel'),
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
        eventos.push({ id: 'ingreso', tipo: 'ingreso', descripcion: t('adminEmp.det.tlJoined'), fecha: empData.fecha_ingreso })
      }
      for (const p of progresoRows.filter(p => p.completado && p.completado_at)) {
        eventos.push({
          id: `bloque-${p.modulo}-${p.bloque}`,
          tipo: 'bloque',
          descripcion: `${t('adminEmp.det.tlCompleted')} "${p.bloque.replace(/_/g, ' ')}" ${t('adminEmp.det.tlIn')} ${p.modulo === 'cultura' ? t('adminEmp.mod.cultura') : t('adminEmp.det.rolShort')}`,
          fecha: p.completado_at as string,
        })
      }
      for (const tarea of (tareasCompRes.data ?? [])) {
        if (tarea.completada_at) {
          eventos.push({ id: `tarea-${tarea.id}`, tipo: 'tarea', descripcion: `${t('adminEmp.det.tlCompletedTask')}: ${tarea.titulo}`, fecha: tarea.completada_at })
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

      // Plan 30-60-90
      try {
        const { data: planData } = await supabase
          .from('plan_30_60_90')
          .select('*')
          .eq('usuario_id', id)
          .order('orden', { ascending: true })
        setPlanItems((planData ?? []) as PlanItem[])
      } catch { /* tabla puede no existir */ }

    } catch (err) {
      console.error('Error cargando detalle:', err)
      toast.error(t('adminEmp.det.loadError'))
    } finally {
      setLoading(false)
    }
  }, [id, router, t])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Guardar cambios ──
  async function handleSave() {
    if (!form || !empleado) return
    setSaving(true)
    try {
      const modalidadValida = form.modalidad && form.modalidad !== 'Sin definir' ? form.modalidad : undefined
      const res = await fetch(`/api/admin/empleados/${empleado.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:               form.nombre.trim() || null,
          puesto:               form.puesto.trim() || null,
          area:                 form.area.trim() || null,
          fecha_ingreso:        form.fecha_ingreso || null,
          modalidad_trabajo:    modalidadValida,
          manager_id:           form.manager_id || null,
          buddy_id:             form.buddy_id || null,
          bio:                  form.bio.trim() || null,
          rol:                  form.rol,
          contacto_it_nombre:   form.contacto_it_nombre.trim() || null,
          contacto_it_email:    form.contacto_it_email.trim() || null,
          contacto_rrhh_nombre: form.contacto_rrhh_nombre.trim() || null,
          contacto_rrhh_email:  form.contacto_rrhh_email.trim() || null,
          password_corporativo:  form.password_corporativo.trim() || null,
          password_bitlocker:    form.password_bitlocker.trim() || null,
          rol_autonomia:         rolAutonomia.trim() || null,
          rol_responsabilidades: rolResponsabilidades.filter(r => r.trim()).length > 0 ? rolResponsabilidades.filter(r => r.trim()) : null,
          rol_kpis:              rolKpis.filter(k => k.trim()).length > 0 ? rolKpis.filter(k => k.trim()) : null,
          rol_herramientas:      rolHerramientas.filter(h => h.nombre.trim()).length > 0 ? rolHerramientas.filter(h => h.nombre.trim()) : null,
        }),
      })
      const data = await res.json() as { usuario?: EmpleadoFull; error?: string }
      if (!res.ok) { toast.error(data.error ?? t('adminEmp.det.saveError')); return }
      setEmpleado(data.usuario!)
      toast.success(t('adminEmp.det.saved'))
    } catch {
      toast.error(t('adminCore.connectionError'))
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
        if (!res.ok) { toast.error(data.error ?? t('adminEmp.det.preOnError')); return }
        toast.success(t('adminEmp.det.preOnOk'))
      } else {
        const supabase = createClient()
        const { error } = await supabase.from('usuarios').update({ preboarding_activo: false }).eq('id', empleado.id)
        if (error) { toast.error(t('adminEmp.det.preOffError')); return }
        toast.success(t('adminEmp.det.preOffOk'))
      }
      setEmpleado(prev => prev
        ? { ...prev, preboarding_activo: nuevoEstado, fecha_acceso_preboarding: nuevoEstado ? new Date().toISOString() : prev.fecha_acceso_preboarding }
        : prev,
      )
    } catch {
      toast.error(t('adminCore.connectionError'))
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
      setReporte(t('adminEmp.det.reportError'))
    } finally {
      setGenerando(false)
    }
  }

  // ── Generar resumen semanal ──
  async function generarResumen() {
    if (!empleado || generandoResumen) return
    setGenerandoResumen(true)
    setResumen('')
    setResumenVisible(true)
    try {
      const res = await fetch(`/api/admin/resumen-semanal/${empleado.id}`, { method: 'POST' })
      if (!res.ok || !res.body) throw new Error('Error en la respuesta')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setResumen(prev => prev + decoder.decode(value, { stream: true }))
      }
    } catch {
      toast.error(t('adminEmp.det.summaryError'))
    } finally {
      setGenerandoResumen(false)
    }
  }

  // ── Abrir/cerrar panel de un acceso (solo uno a la vez) ──
  function toggleAcceso(accesoId: string) {
    if (expandedAccesoId === accesoId) { setExpandedAccesoId(null); return }
    const acceso = accesos.find(a => a.id === accesoId)
    if (!acceso) return
    setAccesoEdits(prev => ({
      ...prev,
      [accesoId]: {
        herramienta: acceso.herramienta,
        estado: acceso.estado,
        usuario_acceso: acceso.usuario_acceso ?? '',
        password_acceso: acceso.password_acceso ?? '',
        url: acceso.url ?? '',
        notas: acceso.notas ?? '',
      },
    }))
    setExpandedAccesoId(accesoId)
  }

  // ── Editar campo del borrador local ──
  function setAccesoField<K extends keyof AccesoEditDraft>(accesoId: string, campo: K, valor: AccesoEditDraft[K]) {
    setAccesoEdits(prev => ({ ...prev, [accesoId]: { ...prev[accesoId], [campo]: valor } }))
  }

  // ── Guardar acceso en DB ──
  async function guardarAcceso(accesoId: string) {
    const draft = accesoEdits[accesoId]
    if (!draft) return
    // Actualización optimista
    setAccesos(list => list.map(a => a.id === accesoId ? {
      ...a,
      herramienta: draft.herramienta,
      estado: draft.estado,
      usuario_acceso: draft.usuario_acceso.trim() || null,
      password_acceso: draft.password_acceso.trim() || null,
      url: draft.url.trim() || null,
      notas: draft.notas.trim() || null,
    } : a))
    const supabase = createClient()
    const { error } = await supabase
      .from('accesos_herramientas')
      .update({
        herramienta:    draft.herramienta.trim() || null,
        estado:         draft.estado,
        usuario_acceso: draft.usuario_acceso.trim() || null,
        password_acceso: draft.password_acceso.trim() || null,
        url:            draft.url.trim() || null,
        notas:          draft.notas.trim() || null,
      })
      .eq('id', accesoId)
    if (error) { toast.error(t('adminEmp.det.saveError')); cargarDatos(); return }
    toast.success(t('adminEmp.det.accessSaved'))
    setExpandedAccesoId(null)
  }

  // ── Agregar nuevo acceso vacío (botón "Agregar herramienta") ──
  async function agregarAcceso(nombreHerramienta = '') {
    if (!empresaId) { toast.error(t('adminEmp.det.noCompany')); return }
    const supabase = createClient()
    const { data, error } = await supabase
      .from('accesos_herramientas')
      .insert({ usuario_id: id, empresa_id: empresaId, herramienta: nombreHerramienta, estado: 'pendiente' })
      .select('id, herramienta, estado, url, notas, usuario_acceso, password_acceso')
      .single()
    if (error) {
      console.error('[agregarAcceso]', error)
      toast.error(`${t('adminEmp.det.addError')}: ${error.message}`)
      return
    }
    const newAcceso = data as AccesoRow
    setAccesos(prev => [...prev, newAcceso])
    setAccesoEdits(prev => ({
      ...prev,
      [newAcceso.id]: { herramienta: newAcceso.herramienta, estado: newAcceso.estado, usuario_acceso: '', password_acceso: '', url: '', notas: '' },
    }))
    setExpandedAccesoId(newAcceso.id)
  }

  // ── Guardar chip desde el panel local (insert o update según existencia) ──
  async function guardarChipDraft() {
    if (!chipDraft || !empresaId) return
    const supabase = createClient()

    const payload = {
      estado:          chipDraft.usuario.trim() || chipDraft.password.trim() ? 'activo' : 'pendiente',
      usuario_acceso:  chipDraft.usuario.trim()   || null,
      password_acceso: chipDraft.password.trim()  || null,
    }

    // Verificar si ya existe un acceso para esta herramienta y usuario
    const { data: existente } = await supabase
      .from('accesos_herramientas')
      .select('id')
      .eq('usuario_id', id)
      .eq('herramienta', chipDraft.nombre)
      .maybeSingle()

    let queryResult
    if (existente) {
      queryResult = await supabase
        .from('accesos_herramientas')
        .update(payload)
        .eq('id', existente.id)
        .select('id, herramienta, estado, url, notas, usuario_acceso, password_acceso')
        .single()
    } else {
      queryResult = await supabase
        .from('accesos_herramientas')
        .insert({ usuario_id: id, empresa_id: empresaId, herramienta: chipDraft.nombre, ...payload })
        .select('id, herramienta, estado, url, notas, usuario_acceso, password_acceso')
        .single()
    }

    const { data, error } = queryResult
    if (error) {
      console.error('[guardarChipDraft]', error)
      toast.error(`${t('adminEmp.det.cantSave')}: ${error.message}`)
      return
    }
    const saved = data as AccesoRow
    setAccesos(prev => {
      const existe = prev.find(a => a.id === saved.id)
      return existe ? prev.map(a => a.id === saved.id ? saved : a) : [...prev, saved]
    })
    setChipDraft(null)
    toast.success(`${chipDraft.nombre} ${t('adminEmp.det.configuredOk')}`)
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
    if (error) { toast.error(t('adminEmp.det.cantDelete')); cargarDatos() }
  }

  // ── Plan 30-60-90 handlers ──
  async function handleTogglePlanItem(item: PlanItem) {
    if (planToggling) return
    setPlanToggling(item.id)
    const nuevoEstado = !item.completado
    setPlanItems(prev => prev.map(p => p.id === item.id
      ? { ...p, completado: nuevoEstado, completado_at: nuevoEstado ? new Date().toISOString() : undefined }
      : p
    ))
    const supabase = createClient()
    const { error } = await supabase
      .from('plan_30_60_90')
      .update({ completado: nuevoEstado, completado_at: nuevoEstado ? new Date().toISOString() : null })
      .eq('id', item.id)
    if (error) {
      toast.error(t('adminEmp.det.cantUpdateItem'))
      setPlanItems(prev => prev.map(p => p.id === item.id ? item : p))
    }
    setPlanToggling(null)
  }

  async function handleDeletePlanItem(itemId: string) {
    setPlanItems(prev => prev.filter(p => p.id !== itemId))
    const supabase = createClient()
    const { error } = await supabase.from('plan_30_60_90').delete().eq('id', itemId)
    if (error) { toast.error(t('adminEmp.det.cantDelete')); cargarDatos() }
  }

  async function handleAddPlanItem() {
    if (!planForm.titulo.trim() || !empresaId) return
    setPlanSaving(true)
    const supabase = createClient()
    const payload = {
      empresa_id: empresaId,
      usuario_id: id,
      fase: planFase,
      tipo: planForm.tipo,
      titulo: planForm.titulo.trim(),
      descripcion: planForm.descripcion.trim() || null,
      fecha_target: planForm.fecha_target || null,
      orden: planItems.filter(p => p.fase === planFase).length,
    }
    const { data, error } = await supabase.from('plan_30_60_90').insert(payload).select().single()
    if (error) {
      toast.error(t('adminEmp.det.cantAddItem'))
    } else {
      setPlanItems(prev => [...prev, data as PlanItem])
      setPlanForm({ titulo: '', tipo: 'objetivo', fecha_target: '', descripcion: '' })
      toast.success(t('adminEmp.det.itemAdded'))
    }
    setPlanSaving(false)
  }

  // ── Loading ──
  if (loading || !form || !empleado) return <Skeleton />

  const initials = getInitials(empleado.nombre)

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/admin/empleados"
          className="flex items-center justify-center w-8 h-8 rounded-full text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-150 flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        {/* Avatar + nombre */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#0EA5E9]/25 border border-[#0EA5E9]/25
            flex items-center justify-center flex-shrink-0 overflow-hidden">
            {empleado.foto_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={empleado.foto_url} alt={empleado.nombre} className="w-full h-full object-cover" />
              : <span className="text-[#7DD3FC] text-xs font-semibold">{initials}</span>
            }
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-white truncate">{empleado.nombre}</h1>
            <p className="text-xs text-white/40">{empleado.email}</p>
          </div>
        </div>

        {/* Acción según tab */}
        {(tab === 'edicion' || tab === 'rol') && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gray-900 hover:bg-black transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ color: 'white' }}
          >
            <Lock className="w-3.5 h-3.5" />
            {t('adminEmp.acc.save')}
          </button>
        )}
        {tab === 'progreso' && (
          <div className="flex items-center gap-2">
            <button
              onClick={generarResumen}
              disabled={generandoResumen}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-[#8B5CF6] hover:bg-[#A78BFA] text-white transition-colors duration-150
                disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generandoResumen
                ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" />{t('adminEmp.det.generating')}</>
                : <><Sparkles className="w-3 h-3" />{t('adminEmp.prog.weeklySummary')}</>
              }
            </button>
            <button
              onClick={generarReporte}
              disabled={generando}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-[#0EA5E9] hover:bg-[#38BDF8] text-white transition-colors duration-150
                disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generando
                ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" />{t('adminEmp.det.generating')}</>
                : <><Sparkles className="w-3 h-3" />{t('adminEmp.det.generateReport')}</>
              }
            </button>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b border-white/[0.07] pb-0">
        {([
          { key: 'edicion' as TabKey, label: t('adminEmp.edit.profile'), icon: <Image src="/heero-icons2.svg" alt="" width={20} height={20} /> },
          { key: 'rol' as TabKey, label: t('adminEmp.mod.rol'), icon: <Image src="/heero-icons4.svg" alt="" width={20} height={20} /> },
          { key: 'plan' as TabKey, label: t('adminEmp.mod.asistente'), icon: <Image src="/heero-icons3.svg" alt="" width={20} height={20} /> },
          { key: 'progreso' as TabKey, label: t('adminEmp.det.tabProgress'), icon: <Image src="/heero-icons6.svg" alt="" width={20} height={20} /> },
        ]).map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors duration-150',
              tab === tb.key
                ? 'border-[#38BDF8] text-white'
                : 'border-transparent text-white/40 hover:text-white/70',
            )}
          >
            {tb.icon}
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── Contenido ── */}
      <AnimatePresence>
        {tab === 'edicion' && (
          <motion.div
            key="edicion"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <TabEdicion
              empleado={empleado}
              form={form}
              rolAdmin={rolAdmin}
              colaboradores={colaboradores}
              modulos={modulos}
              alertas={alertas}
              setField={setField}
              showPassCorp={showPassCorp}
              setShowPassCorp={setShowPassCorp}
              showPassBitlocker={showPassBitlocker}
              setShowPassBitlocker={setShowPassBitlocker}
              togglingPreboarding={togglingPreboarding}
              togglePreboarding={togglePreboarding}
              setResetModal={setResetModal}
              accesos={accesos}
              chipDraft={chipDraft}
              setChipDraft={setChipDraft}
              expandedAccesoId={expandedAccesoId}
              setExpandedAccesoId={setExpandedAccesoId}
              accesoEdits={accesoEdits}
              showPassAcceso={showPassAcceso}
              setShowPassAcceso={setShowPassAcceso}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
              toggleAcceso={toggleAcceso}
              setAccesoField={setAccesoField}
              guardarAcceso={guardarAcceso}
              guardarChipDraft={guardarChipDraft}
              agregarAcceso={agregarAcceso}
              eliminarAcceso={eliminarAcceso}
            />
          </motion.div>
        )}

        {tab === 'rol' && (
          <motion.div
            key="rol"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <TabRol
              rolAutonomia={rolAutonomia}
              setRolAutonomia={setRolAutonomia}
              rolResponsabilidades={rolResponsabilidades}
              setRolResponsabilidades={setRolResponsabilidades}
              rolKpis={rolKpis}
              setRolKpis={setRolKpis}
              rolHerramientas={rolHerramientas}
              setRolHerramientas={setRolHerramientas}
            />
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
            <TabProgreso
              progresos={progresos}
              tareasPendientes={tareasPendientes}
              timeline={timeline}
              preguntas={preguntas}
              resumen={resumen}
              resumenVisible={resumenVisible}
              setResumenVisible={setResumenVisible}
              generandoResumen={generandoResumen}
              reporte={reporte}
              reporteVisible={reporteVisible}
              setReporteVisible={setReporteVisible}
              generando={generando}
            />
          </motion.div>
        )}
      </AnimatePresence>

        {tab === 'plan' && (
          <motion.div
            key="plan"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <TabPlan
              planItems={planItems}
              planFase={planFase}
              setPlanFase={setPlanFase}
              planForm={planForm}
              setPlanForm={setPlanForm}
              planSaving={planSaving}
              planToggling={planToggling}
              handleTogglePlanItem={handleTogglePlanItem}
              handleDeletePlanItem={handleDeletePlanItem}
              handleAddPlanItem={handleAddPlanItem}
            />
          </motion.div>
        )}

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
