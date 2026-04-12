'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, Search, Filter, Pencil, RotateCcw, Trash2,
  Calendar, Briefcase, MapPin, Users, AlertTriangle,
  ArrowLeft, Mail, Monitor, Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { getInitials, formatFecha, semaforoColor } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { EmpleadoModal } from '@/components/admin/EmpleadoModal'
import { ResetProgresoModal } from '@/components/admin/ResetProgresoModal'
import type { UserRole } from '@/types'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface EmpleadoConProgreso {
  id: string
  nombre: string
  email: string
  puesto: string | null
  area: string | null
  fecha_ingreso: string | null
  modalidad_trabajo: string | null
  rol: UserRole
  progreso: number
}

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

/** Cuántos empleados mostrar por carga */
const PAGE_SIZE = 50

const MODALIDAD_LABEL: Record<string, string> = {
  presencial: 'Presencial',
  remoto:     'Remoto',
  hibrido:    'Híbrido',
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Skeleton de la lista
// ─────────────────────────────────────────────

function SkeletonLista() {
  return (
    <div className="space-y-px">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-white/[0.06] flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-white/[0.06] rounded w-32" />
            <div className="h-2.5 bg-white/[0.04] rounded w-20" />
          </div>
          <div className="w-16 h-1.5 bg-white/[0.04] rounded-full" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/[0.06]" />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Fila compacta de la lista
// ─────────────────────────────────────────────

function FilaEmpleado({
  emp,
  seleccionado,
  onClick,
}: {
  emp: EmpleadoConProgreso
  seleccionado: boolean
  onClick: () => void
}) {
  const initials = getInitials(emp.nombre)

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left
        transition-colors duration-100 cursor-pointer
        border-l-2 group
        ${seleccionado
          ? 'bg-[#0EA5E9]/[0.10] border-l-[#0EA5E9]'
          : 'border-l-transparent hover:bg-white/[0.03]'
        }`}
    >
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full flex-shrink-0 bg-[#0EA5E9]/20 border border-[#0EA5E9]/20
        flex items-center justify-center">
        <span className="text-[#7DD3FC] text-[11px] font-semibold">{initials}</span>
      </div>

      {/* Nombre + área */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate transition-colors duration-100
          ${seleccionado ? 'text-white/90' : 'text-white/70 group-hover:text-white/85'}`}>
          {emp.nombre}
        </p>
        {emp.area && (
          <p className="text-[11px] text-white/30 truncate">{emp.area}</p>
        )}
      </div>

      {/* Barra mini de progreso */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-16 h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${semaforoColor(emp.progreso)}`}
            style={{ width: `${emp.progreso}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-white/30 w-7 text-right">
          {emp.progreso}%
        </span>
        {/* Dot semáforo */}
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${semaforoColor(emp.progreso)}`} />
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────
// Panel derecho — Empty state
// ─────────────────────────────────────────────

function EmptyDetalle() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06]
        flex items-center justify-center">
        <Users className="w-6 h-6 text-white/15" />
      </div>
      <div>
        <p className="text-sm font-medium text-white/35">Seleccioná un colaborador</p>
        <p className="text-xs text-white/20 mt-1">para ver su detalle aquí</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Panel derecho — Detalle del empleado
// ─────────────────────────────────────────────

interface DetalleEmpleadoProps {
  emp: EmpleadoConProgreso
  onEditar: () => void
  onResetear: () => void
  onEliminar: () => void
  eliminando: boolean
  confirmDelete: boolean
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

function DetalleEmpleado({
  emp,
  onEditar,
  onResetear,
  onEliminar,
  eliminando,
  confirmDelete,
  onConfirmDelete,
  onCancelDelete,
}: DetalleEmpleadoProps) {
  const initials = getInitials(emp.nombre)

  return (
    <motion.div
      key={emp.id}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="h-full flex flex-col overflow-y-auto"
    >
      <div className="p-6 space-y-6">
        {/* Avatar + datos principales */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full flex-shrink-0 bg-[#0EA5E9]/25 border border-[#0EA5E9]/25
            flex items-center justify-center">
            <span className="text-[#7DD3FC] text-lg font-semibold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white/90 truncate">{emp.nombre}</h2>
            {emp.puesto && (
              <p className="text-sm text-white/50 mt-0.5 truncate">{emp.puesto}</p>
            )}
            {emp.rol === 'admin' && (
              <div className="mt-1">
                <Badge variant="info">Admin</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Detalles */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm">
            <Mail className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
            <span className="text-white/55 truncate">{emp.email}</span>
          </div>
          {emp.area && (
            <div className="flex items-center gap-2.5 text-sm">
              <MapPin className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
              <span className="text-white/55">{emp.area}</span>
            </div>
          )}
          {emp.fecha_ingreso && (
            <div className="flex items-center gap-2.5 text-sm">
              <Calendar className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
              <span className="text-white/55">{formatFecha(emp.fecha_ingreso)}</span>
            </div>
          )}
          {emp.puesto && (
            <div className="flex items-center gap-2.5 text-sm">
              <Briefcase className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
              <span className="text-white/55">{emp.puesto}</span>
            </div>
          )}
          {emp.modalidad_trabajo && (
            <div className="flex items-center gap-2.5 text-sm">
              <Monitor className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
              <span className="text-white/55">
                {MODALIDAD_LABEL[emp.modalidad_trabajo] ?? emp.modalidad_trabajo}
              </span>
            </div>
          )}
        </div>

        {/* Progreso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Progreso de onboarding</span>
            <span className="font-mono text-white/60">{emp.progreso}%</span>
          </div>
          <ProgressBar value={emp.progreso} showPercentage={false} animated />
        </div>

        {/* Acciones */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <Link
            href={`/admin/empleados/${emp.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm w-auto
              bg-white/[0.04] border border-white/[0.08] text-white/65
              hover:text-white/90 hover:bg-white/[0.07] hover:border-white/[0.14]
              transition-colors duration-150"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </Link>

          <button
            onClick={onResetear}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm w-auto
              bg-white/[0.04] border border-white/[0.08] text-white/65
              hover:text-amber-400/80 hover:bg-amber-500/[0.08] hover:border-amber-500/20
              transition-colors duration-150"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Resetear progreso
          </button>

          {/* Eliminar con confirmación inline */}
          <AnimatePresence mode="wait">
            {confirmDelete ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="w-full rounded-lg bg-red-500/[0.08] border border-red-500/25 p-3 space-y-2.5"
              >
                <div className="flex items-center gap-2 text-sm text-red-400/90">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>¿Eliminar a <strong>{emp.nombre}</strong>?</span>
                </div>
                <p className="text-xs text-red-400/50">Esta acción no se puede deshacer.</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={onCancelDelete} className="flex-1">
                    Cancelar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={eliminando}
                    onClick={onEliminar}
                    className="flex-1"
                  >
                    Eliminar
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="delete-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={onConfirmDelete}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm w-auto
                  bg-white/[0.04] border border-white/[0.08] text-white/65
                  hover:text-red-400/80 hover:bg-red-500/[0.08] hover:border-red-500/20
                  transition-colors duration-150 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function EmpleadosPage() {
  const router = useRouter()

  const [loading, setLoading]           = useState(true)
  const [empleados, setEmpleados]       = useState<EmpleadoConProgreso[]>([])
  const [rolAdmin, setRolAdmin]         = useState<UserRole>('admin')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [resetTarget, setResetTarget]   = useState<{ id: string; nombre: string } | null>(null)

  // Panel derecho
  const [seleccionado, setSeleccionado] = useState<EmpleadoConProgreso | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [eliminando, setEliminando]       = useState(false)

  // Mobile: mostrar detalle a pantalla completa
  const [vistaDetalleMobile, setVistaDetalleMobile] = useState(false)

  // Filtros
  const [busqueda, setBusqueda]   = useState('')
  const [areaFiltro, setAreaFiltro] = useState('')

  // "Cargar más" (infinite-style)
  const [itemsVisibles, setItemsVisibles] = useState(PAGE_SIZE)

  // Ref al contenedor de la lista para scroll independiente
  const listaRef = useRef<HTMLDivElement>(null)

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

      const { data: rows } = await supabase
        .from('usuarios')
        .select('id, nombre, email, puesto, area, fecha_ingreso, modalidad_trabajo, rol')
        .eq('empresa_id', adminData.empresa_id)
        .eq('rol', 'empleado')
        .order('nombre')

      const empRows = rows ?? []
      const empIds = empRows.map(e => e.id)

      const { count: totalBloques } = await supabase
        .from('conocimiento')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', adminData.empresa_id)

      const { data: progresoRows } = await supabase
        .from('progreso_modulos')
        .select('usuario_id, completado')
        .in('usuario_id', empIds)
        .eq('completado', true)

      const completadosPorUsuario: Record<string, number> = {}
      for (const row of (progresoRows ?? [])) {
        completadosPorUsuario[row.usuario_id] = (completadosPorUsuario[row.usuario_id] ?? 0) + 1
      }

      const total = Math.max(totalBloques ?? 1, 1)

      const lista: EmpleadoConProgreso[] = empRows.map(e => ({
        ...e,
        progreso: Math.min(100, Math.round(((completadosPorUsuario[e.id] ?? 0) / total) * 100)),
      }))

      setEmpleados(lista)
    } catch (err) {
      console.error('Error cargando empleados:', err)
      toast.error('Error al cargar empleados')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Filtros en memoria (sin re-fetch) ──
  const areas = useMemo(() => {
    const set = new Set(empleados.map(e => e.area).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [empleados])

  const empleadosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    return empleados.filter(e => {
      const matchBusqueda = !q ||
        e.nombre.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
      const matchArea = !areaFiltro || e.area === areaFiltro
      return matchBusqueda && matchArea
    })
  }, [empleados, busqueda, areaFiltro])

  // Resetear items visibles al cambiar filtros
  useEffect(() => { setItemsVisibles(PAGE_SIZE) }, [busqueda, areaFiltro])

  const empleadosVisibles = useMemo(
    () => empleadosFiltrados.slice(0, itemsVisibles),
    [empleadosFiltrados, itemsVisibles]
  )

  const hayMas = empleadosFiltrados.length > itemsVisibles

  // ── Seleccionar empleado ──
  function handleSeleccionar(emp: EmpleadoConProgreso) {
    setSeleccionado(emp)
    setConfirmDelete(false)
    setVistaDetalleMobile(true)
  }

  // ── Crear empleado ──
  function handleCreado(nuevo: { id: string; nombre: string; email: string }) {
    setModalAbierto(false)
    cargarDatos()
    toast.success(`${nuevo.nombre} agregado al equipo`)
  }

  // ── Eliminar empleado ──
  async function handleEliminar() {
    if (!seleccionado) return
    setEliminando(true)
    try {
      const res = await fetch(`/api/admin/empleados/${seleccionado.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        toast.error(d.error ?? 'Error al eliminar')
        return
      }
      toast.success(`${seleccionado.nombre} eliminado`)
      setEmpleados(prev => prev.filter(e => e.id !== seleccionado.id))
      setSeleccionado(null)
      setVistaDetalleMobile(false)
      setConfirmDelete(false)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setEliminando(false)
    }
  }

  // ── Reset progreso ──
  function handleReset() {
    cargarDatos()
    setResetTarget(null)
    // Refrescar el empleado seleccionado con los nuevos datos
    if (seleccionado) {
      setSeleccionado(prev => prev ? { ...prev, progreso: 0 } : null)
    }
  }

  // ── Altura de la lista (viewport - header admin ~56px - page header ~80px) ──
  const LISTA_HEIGHT = 'calc(100dvh - 56px - 80px - 24px)'

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-white">Equipo</h1>
          <p className="text-sm text-white/40">{empleados.length} {empleados.length === 1 ? 'persona' : 'personas'}</p>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-[9px]
            text-sm font-semibold text-white
            bg-[#3B4FD8] hover:bg-[#4B5EE8]
            shadow-[0_0_20px_rgba(59,79,216,0.2)] hover:shadow-[0_0_28px_rgba(59,79,216,0.35)]
            transition-all duration-200"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Sumar al equipo</span>
        </button>
      </div>

      {/* ── Layout dos paneles ── */}
      <div className="flex gap-4 min-h-0 flex-1">

        {/* ════════════════════════════════════════
            PANEL IZQUIERDO — Lista
        ════════════════════════════════════════ */}
        <div
          className={`flex flex-col flex-shrink-0 glass-card rounded-xl overflow-hidden
            w-full md:w-[40%]
            ${vistaDetalleMobile && seleccionado ? 'hidden md:flex' : 'flex'}`}
        >
          {/* Filtros */}
          <div className="p-3 border-b border-white/[0.06] space-y-2 flex-shrink-0">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="w-full h-8 pl-8 pr-3 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08]
                  text-white/85 placeholder:text-white/20 outline-none
                  focus:border-[#0EA5E9]/60 focus:bg-white/[0.06] transition-colors duration-150"
              />
            </div>

            {/* Filtro área + contador */}
            <div className="flex items-center gap-2">
              {areas.length > 0 && (
                <div className="relative flex-1">
                  <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/25 pointer-events-none" />
                  <select
                    value={areaFiltro}
                    onChange={e => setAreaFiltro(e.target.value)}
                    className="w-full h-8 pl-7 pr-2 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08]
                      text-white/65 appearance-none outline-none
                      focus:border-[#0EA5E9]/60 transition-colors duration-150 cursor-pointer"
                  >
                    <option value="" className="bg-[#111110]">Todas las áreas</option>
                    {areas.map(a => (
                      <option key={a} value={a} className="bg-[#111110]">{a}</option>
                    ))}
                  </select>
                </div>
              )}
              <span className="text-[11px] text-white/30 whitespace-nowrap flex-shrink-0">
                {empleadosFiltrados.length} resultado{empleadosFiltrados.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Lista scrolleable */}
          <div
            ref={listaRef}
            className="flex-1 overflow-y-auto"
            style={{ maxHeight: LISTA_HEIGHT }}
          >
            {loading ? (
              <SkeletonLista />
            ) : empleadosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Users className="w-8 h-8 text-white/10" />
                <p className="text-xs text-white/25 text-center px-4">
                  {busqueda
                    ? `Sin resultados para "${busqueda}"`
                    : 'No hay colaboradores en esta empresa'}
                </p>
              </div>
            ) : (
              <div>
                {empleadosVisibles.map(emp => (
                  <FilaEmpleado
                    key={emp.id}
                    emp={emp}
                    seleccionado={seleccionado?.id === emp.id}
                    onClick={() => handleSeleccionar(emp)}
                  />
                ))}

                {/* Botón cargar más */}
                {hayMas && (
                  <div className="p-3 border-t border-white/[0.04]">
                    <button
                      onClick={() => setItemsVisibles(v => v + PAGE_SIZE)}
                      className="w-full py-2 text-xs text-white/35 hover:text-white/60
                        hover:bg-white/[0.03] rounded-lg transition-colors duration-150"
                    >
                      Cargar más ({empleadosFiltrados.length - itemsVisibles} restantes)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════
            PANEL DERECHO — Detalle
        ════════════════════════════════════════ */}
        <div
          className={`flex-1 min-w-0 glass-card rounded-xl overflow-hidden
            ${vistaDetalleMobile && seleccionado ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}
        >
          {/* Botón "Volver" en mobile */}
          {vistaDetalleMobile && seleccionado && (
            <div className="md:hidden px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
              <button
                onClick={() => {
                  setVistaDetalleMobile(false)
                  setSeleccionado(null)
                  setConfirmDelete(false)
                }}
                className="flex items-center gap-1.5 text-sm text-white/50
                  hover:text-white/80 transition-colors duration-150"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a la lista
              </button>
            </div>
          )}

          {seleccionado ? (
            <DetalleEmpleado
              emp={seleccionado}
              onEditar={() => router.push(`/admin/empleados/${seleccionado.id}`)}
              onResetear={() => setResetTarget({ id: seleccionado.id, nombre: seleccionado.nombre })}
              onEliminar={handleEliminar}
              eliminando={eliminando}
              confirmDelete={confirmDelete}
              onConfirmDelete={() => setConfirmDelete(true)}
              onCancelDelete={() => setConfirmDelete(false)}
            />
          ) : (
            <EmptyDetalle />
          )}
        </div>
      </div>

      {/* ── Dev badge ── */}
      {rolAdmin === 'dev' && (
        <div className="flex justify-end mt-3 flex-shrink-0">
          <span className="text-[10px] font-mono text-amber-400/40 border border-amber-500/10
            px-2 py-0.5 rounded">
            dev · acceso total
          </span>
        </div>
      )}

      {/* ── Modales ── */}
      {modalAbierto && (
        <EmpleadoModal
          onClose={() => setModalAbierto(false)}
          onCreated={handleCreado}
        />
      )}

      {resetTarget && (
        <ResetProgresoModal
          empleadoId={resetTarget.id}
          empleadoNombre={resetTarget.nombre}
          modulo="todos"
          onClose={() => setResetTarget(null)}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
