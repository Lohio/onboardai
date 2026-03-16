'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, Search, Filter, Pencil, RotateCcw, Trash2,
  Calendar, Briefcase, MapPin, Users, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
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
  progreso: number // 0-100
}

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getInitials(nombre: string): string {
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function formatFecha(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const MODALIDAD_LABEL: Record<string, string> = {
  presencial: 'Presencial',
  remoto: 'Remoto',
  hibrido: 'Híbrido',
}

// ─────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="glass-card rounded-xl p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-white/[0.06] flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-white/[0.06] rounded w-36" />
          <div className="h-2.5 bg-white/[0.04] rounded w-24" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-2.5 bg-white/[0.04] rounded w-full" />
        <div className="h-1.5 bg-white/[0.06] rounded-full" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full flex flex-col items-center justify-center py-20 text-center"
    >
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="mb-4 opacity-30">
        <defs>
          <linearGradient id="empListGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B4FD8" />
            <stop offset="1" stopColor="#0D9488" />
          </linearGradient>
        </defs>
        <circle cx="28" cy="26" r="10" stroke="url(#empListGrad)" strokeWidth="2" />
        <path d="M10 52c0-9.941 8.059-18 18-18s18 8.059 18 18" stroke="url(#empListGrad)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="46" cy="20" r="6" stroke="url(#empListGrad)" strokeWidth="1.5" />
        <path d="M54 44c0-6-3.582-11-8-11" stroke="url(#empListGrad)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="text-sm font-medium text-white/50">
        {query ? `Sin resultados para "${query}"` : 'Aún no hay empleados en esta empresa'}
      </p>
      {!query && (
        <p className="text-xs text-white/30 mt-1">
          Usá el botón "Nuevo empleado" para dar de alta el primero
        </p>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Confirm Delete inline
// ─────────────────────────────────────────────

interface ConfirmDeleteProps {
  nombre: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function ConfirmDelete({ nombre, onConfirm, onCancel, loading }: ConfirmDeleteProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="absolute inset-0 rounded-xl bg-[#0f1f3d]/95 backdrop-blur-sm
        border border-red-500/30 z-10 flex flex-col items-center justify-center gap-3 p-4"
    >
      <AlertTriangle className="w-5 h-5 text-red-400" />
      <p className="text-xs text-center text-white/70">
        ¿Eliminar a <span className="font-semibold text-white/90">{nombre}</span>?<br />
        <span className="text-white/40">Esta acción no se puede deshacer.</span>
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button variant="danger" size="sm" loading={loading} onClick={onConfirm}>Eliminar</Button>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Tarjeta de empleado
// ─────────────────────────────────────────────

interface EmpleadoCardProps {
  emp: EmpleadoConProgreso
  onRequestReset: (id: string, nombre: string) => void
  onDeleted: (id: string) => void
}

function EmpleadoCard({ emp, onRequestReset, onDeleted }: EmpleadoCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/empleados/${emp.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        toast.error(d.error ?? 'Error al eliminar')
        setConfirmDelete(false)
        return
      }
      toast.success(`${emp.nombre} eliminado`)
      onDeleted(emp.id)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <motion.div variants={cardVariants} className="relative">
      <div className="glass-card rounded-xl p-5 h-full flex flex-col gap-4">
        {/* Avatar + nombre */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600/25 border border-indigo-500/25
            flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-300 text-xs font-semibold">{getInitials(emp.nombre)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/85 truncate">{emp.nombre}</p>
            <p className="text-xs text-white/40 truncate mt-0.5">{emp.email}</p>
          </div>
          {emp.rol === 'admin' && (
            <Badge variant="info" className="flex-shrink-0">Admin</Badge>
          )}
        </div>

        {/* Detalles */}
        <div className="space-y-1.5 text-xs text-white/45 flex-1">
          {emp.puesto && (
            <div className="flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 flex-shrink-0 text-white/25" />
              <span className="truncate">{emp.puesto}</span>
            </div>
          )}
          {emp.area && (
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-white/25" />
              <span className="truncate">{emp.area}</span>
            </div>
          )}
          {emp.fecha_ingreso && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-white/25" />
              <span>{formatFecha(emp.fecha_ingreso)}</span>
            </div>
          )}
          {emp.modalidad_trabajo && (
            <div className="flex items-center gap-2">
              <span className="text-white/20">◆</span>
              <span>{MODALIDAD_LABEL[emp.modalidad_trabajo] ?? emp.modalidad_trabajo}</span>
            </div>
          )}
        </div>

        {/* Progreso */}
        <ProgressBar value={emp.progreso} label="Progreso onboarding" showPercentage />

        {/* Acciones */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-white/[0.05]">
          <Link
            href={`/admin/empleados/${emp.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs
              text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors duration-150"
          >
            <Pencil className="w-3 h-3" />
            Editar
          </Link>
          <button
            onClick={() => onRequestReset(emp.id, emp.nombre)}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs
              text-white/50 hover:text-amber-400/70 hover:bg-amber-500/[0.06] transition-colors duration-150"
          >
            <RotateCcw className="w-3 h-3" />
            Resetear
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs
              text-white/50 hover:text-red-400/80 hover:bg-red-500/[0.06] transition-colors duration-150"
          >
            <Trash2 className="w-3 h-3" />
            Eliminar
          </button>
        </div>
      </div>

      {/* Confirmación de eliminación superpuesta */}
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmDelete
            nombre={emp.nombre}
            onConfirm={handleDelete}
            onCancel={() => setConfirmDelete(false)}
            loading={deleting}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function EmpleadosPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [empleados, setEmpleados] = useState<EmpleadoConProgreso[]>([])
  const [rolAdmin, setRolAdmin] = useState<UserRole>('admin')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [resetTarget, setResetTarget] = useState<{ id: string; nombre: string } | null>(null)

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [areaFiltro, setAreaFiltro] = useState('')

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

      // Empleados de la empresa (excluye devs de la lista)
      const { data: rows } = await supabase
        .from('usuarios')
        .select('id, nombre, email, puesto, area, fecha_ingreso, modalidad_trabajo, rol')
        .eq('empresa_id', adminData.empresa_id)
        .neq('rol', 'dev')
        .order('nombre')

      const empRows = rows ?? []
      const empIds = empRows.map(e => e.id)

      // Total de bloques de conocimiento como denominador del progreso
      const { count: totalBloques } = await supabase
        .from('conocimiento')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', adminData.empresa_id)

      // Progreso de módulos por empleado
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

  // ── Filtros derivados ──
  const areas = useMemo(() => {
    const set = new Set(empleados.map(e => e.area).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [empleados])

  const empleadosFiltrados = useMemo(() => {
    return empleados.filter(e => {
      const matchBusqueda = !busqueda ||
        e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        e.email.toLowerCase().includes(busqueda.toLowerCase())
      const matchArea = !areaFiltro || e.area === areaFiltro
      return matchBusqueda && matchArea
    })
  }, [empleados, busqueda, areaFiltro])

  // ── Handlers ──
  function handleCreated(nuevo: { id: string; nombre: string; email: string }) {
    setModalAbierto(false)
    // Recargar para obtener datos completos
    cargarDatos()
    toast.success(`${nuevo.nombre} agregado al equipo`)
  }

  function handleDeleted(id: string) {
    setEmpleados(prev => prev.filter(e => e.id !== id))
  }

  function handleRequestReset(id: string, nombre: string) {
    setResetTarget({ id, nombre })
  }

  function handleReset() {
    // Recargar progreso tras el reset
    cargarDatos()
    setResetTarget(null)
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white/90">Empleados</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {loading ? '—' : `${empleados.length} ${empleados.length === 1 ? 'empleado' : 'empleados'}`}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setModalAbierto(true)}
          className="flex-shrink-0 mt-0.5"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Nuevo empleado
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full h-9 pl-9 pr-3 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08]
              text-white/85 placeholder:text-white/20 outline-none
              focus:border-indigo-500/60 focus:bg-white/[0.06] transition-colors duration-150"
          />
        </div>

        {/* Filtro por área */}
        {areas.length > 0 && (
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
            <select
              value={areaFiltro}
              onChange={e => setAreaFiltro(e.target.value)}
              className="h-9 pl-9 pr-8 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08]
                text-white/70 appearance-none outline-none
                focus:border-indigo-500/60 focus:bg-white/[0.06] transition-colors duration-150 cursor-pointer"
            >
              <option value="" className="bg-[#0f1f3d]">Todas las áreas</option>
              {areas.map(a => (
                <option key={a} value={a} className="bg-[#0f1f3d]">{a}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Grid de empleados */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : empleadosFiltrados.length === 0 ? (
        <EmptyState query={busqueda} />
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {empleadosFiltrados.map(emp => (
            <EmpleadoCard
              key={emp.id}
              emp={emp}
              onRequestReset={handleRequestReset}
              onDeleted={handleDeleted}
            />
          ))}
        </motion.div>
      )}

      {/* Contador de resultados filtrados */}
      {!loading && busqueda && empleadosFiltrados.length > 0 && (
        <p className="text-xs text-white/30 text-center">
          {empleadosFiltrados.length} resultado{empleadosFiltrados.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Modal nuevo empleado */}
      {modalAbierto && (
        <EmpleadoModal
          onClose={() => setModalAbierto(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Modal reset progreso */}
      {resetTarget && (
        <ResetProgresoModal
          empleadoId={resetTarget.id}
          empleadoNombre={resetTarget.nombre}
          modulo="todos"
          onClose={() => setResetTarget(null)}
          onReset={handleReset}
        />
      )}

      {/* Badge de acceso dev */}
      {rolAdmin === 'dev' && (
        <div className="flex justify-end">
          <Badge variant="warning">Modo dev — acceso total</Badge>
        </div>
      )}
    </div>
  )
}
