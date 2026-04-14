'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, TrendingUp, AlertTriangle, UserPlus, Sparkles,
  Search, ChevronRight, ChevronUp, ChevronDown, Check,
  SlidersHorizontal, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getInitials, semaforoColor, diasDesde } from '@/lib/utils'
import type { AdminEmpleadoConProgreso } from '@/types'

// ─────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────

interface AlertaRow {
  id: string
  pregunta: string
  usuario_id: string
  created_at: string
  resuelta: boolean
  usuarios: { nombre: string }[] | null
}

interface ProgresoRow {
  usuario_id: string
  modulo: string
  bloque: string
  completado: boolean
}

type SortKey = 'nombre' | 'progreso' | 'dias' | 'area'
type SortDir = 'asc' | 'desc'
type FiltroEstado = 'todos' | 'riesgo' | 'progreso' | 'aldia'

const ITEMS_PER_PAGE = 20

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function calcularProgreso(userId: string, progresoRows: ProgresoRow[], totalBloques: number): number {
  const completados = progresoRows.filter(p => p.usuario_id === userId && p.completado).length
  return totalBloques > 0 ? Math.min(100, Math.round((completados / totalBloques) * 100)) : 0
}

function calcularPromedioModulo(
  progresoRows: ProgresoRow[], empleadoIds: string[], modulo: string, totalBloques: number
): number {
  if (empleadoIds.length === 0 || totalBloques === 0) return 0
  const suma = empleadoIds.reduce((acc, uid) => {
    const completados = progresoRows.filter(p => p.usuario_id === uid && p.modulo === modulo && p.completado).length
    return acc + Math.min(100, Math.round((completados / totalBloques) * 100))
  }, 0)
  return Math.round(suma / empleadoIds.length)
}

function tiempoRelativo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutos = Math.floor(diffMs / 60000)
  if (minutos < 60) return `hace ${minutos}m`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas}h`
  return `hace ${Math.floor(horas / 24)}d`
}

function estadoLabel(progreso: number) {
  if (progreso < 30) return { label: 'En riesgo', color: 'text-red-400', dot: 'bg-red-400' }
  if (progreso < 70) return { label: 'En progreso', color: 'text-amber-400', dot: 'bg-amber-400' }
  return { label: 'Al día', color: 'text-teal-400', dot: 'bg-teal-400' }
}

// ─────────────────────────────────────────────
// MiniProgressBar
// ─────────────────────────────────────────────

function MiniBar({ value }: { value: number }) {
  const color = value >= 70 ? '#0D9488' : value >= 30 ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] font-mono tabular-nums text-white/40 flex-shrink-0 w-7 text-right">
        {value}%
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────
// MetricCard
// ─────────────────────────────────────────────

function MetricCard({ valor, label, icon, sufijo, accent }: {
  valor: number; label: string; icon: React.ReactNode
  sufijo?: string; accent?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]
        p-5 hover:bg-white/[0.05] transition-colors duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-white/35 group-hover:text-white/55 transition-colors">{icon}</span>
        {accent && <div className={`w-1.5 h-1.5 rounded-full ${accent} mt-1`} />}
      </div>
      <p className="text-3xl font-bold font-mono tabular-nums text-white/90">
        {valor}
        {sufijo && <span className="text-lg text-white/35 ml-0.5">{sufijo}</span>}
      </p>
      <p className="text-[11px] text-white/35 mt-1.5 font-medium">{label}</p>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// SortButton
// ─────────────────────────────────────────────

function SortBtn({ col, label, sort, onSort }: {
  col: SortKey; label: string
  sort: { key: SortKey; dir: SortDir }
  onSort: (k: SortKey) => void
}) {
  const active = sort.key === col
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider
        transition-colors duration-150 select-none
        ${active ? 'text-[#38BDF8]' : 'text-white/30 hover:text-white/60'}`}
    >
      {label}
      {active
        ? sort.dir === 'asc'
          ? <ChevronUp className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3" />
        : <div className="w-3 h-3" />
      }
    </button>
  )
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-24 rounded-xl bg-white/[0.04] animate-pulse border border-white/[0.04]" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-2">
          <div className="h-10 rounded-lg bg-white/[0.04] animate-pulse" />
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-64 rounded-xl bg-white/[0.04] animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function AdminDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [empleados, setEmpleados] = useState<AdminEmpleadoConProgreso[]>([])
  const [alertas, setAlertas] = useState<AlertaRow[]>([])
  const [chartData, setChartData] = useState<{ nombre: string; progreso: number }[]>([])

  // ── Controles de tabla ──
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [filtroArea, setFiltroArea] = useState<string>('todas')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'progreso', dir: 'asc' })
  const [pagina, setPagina] = useState(1)
  const [showAreaFilter, setShowAreaFilter] = useState(false)

  // ─────────────────────────────────────────────
  // Carga de datos
  // ─────────────────────────────────────────────

  const cargarDatos = useCallback(async (empId: string) => {
    try {
      const supabase = createClient()

      const { data: empleadosRaw } = await supabase
        .from('usuarios')
        .select('id, nombre, puesto, area, foto_url, fecha_ingreso')
        .eq('empresa_id', empId)
        .eq('rol', 'empleado')

      if (!empleadosRaw || empleadosRaw.length === 0) {
        setEmpleados([]); setAlertas([]); setChartData([]); return
      }

      const empleadoIds = empleadosRaw.map(e => e.id)

      const [progresoRes, alertasRes, culturaCountRes, rolCountRes] = await Promise.all([
        supabase.from('progreso_modulos').select('usuario_id, modulo, bloque, completado').in('usuario_id', empleadoIds),
        supabase.from('alertas_conocimiento')
          .select('id, pregunta, usuario_id, created_at, resuelta, usuarios(nombre)')
          .eq('empresa_id', empId).eq('resuelta', false).order('created_at', { ascending: false }).limit(8),
        supabase.from('conocimiento').select('*', { count: 'exact', head: true }).eq('empresa_id', empId).eq('modulo', 'cultura'),
        supabase.from('conocimiento').select('*', { count: 'exact', head: true }).eq('empresa_id', empId).eq('modulo', 'rol'),
      ])

      const progresoRows: ProgresoRow[] = (progresoRes.data ?? []) as ProgresoRow[]
      const totalBloquesCultura = culturaCountRes.count ?? 0
      const totalBloquesRol = Math.max(1, rolCountRes.count ?? 1)
      const totalBloques = totalBloquesCultura + totalBloquesRol

      const empleadosConProgreso: AdminEmpleadoConProgreso[] = empleadosRaw.map(e => ({
        id: e.id, nombre: e.nombre ?? '', puesto: e.puesto ?? undefined,
        area: e.area ?? undefined, foto_url: e.foto_url ?? undefined,
        fecha_ingreso: e.fecha_ingreso ?? undefined,
        progreso: calcularProgreso(e.id, progresoRows, totalBloques),
      }))

      setEmpleados(empleadosConProgreso)
      setAlertas((alertasRes.data ?? []) as AlertaRow[])

      const avgCultura = calcularPromedioModulo(progresoRows, empleadoIds, 'cultura', totalBloquesCultura)
      const avgRol = calcularPromedioModulo(progresoRows, empleadoIds, 'rol', totalBloquesRol)
      setChartData([
        { nombre: 'Cultura', progreso: avgCultura },
        { nombre: 'Rol', progreso: avgRol },
      ])
    } catch (err) {
      console.error('[Dashboard]', err)
    }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('usuarios').select('empresa_id').eq('id', user.id).single()
        if (!data?.empresa_id) return
        setEmpresaId(data.empresa_id)
        await cargarDatos(data.empresa_id)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [cargarDatos])

  useEffect(() => {
    if (!empresaId) return
    const supabase = createClient()
    const channel = supabase.channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'progreso_modulos' }, () => cargarDatos(empresaId))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertas_conocimiento', filter: `empresa_id=eq.${empresaId}` }, () => cargarDatos(empresaId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [empresaId, cargarDatos])

  // ─────────────────────────────────────────────
  // Filtrado + sort + paginación (memo)
  // ─────────────────────────────────────────────

  const areas = useMemo(() => {
    const set = new Set(empleados.map(e => e.area).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [empleados])

  const empleadosFiltrados = useMemo(() => {
    let list = [...empleados]

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      list = list.filter(e =>
        e.nombre.toLowerCase().includes(q) ||
        (e.puesto ?? '').toLowerCase().includes(q) ||
        (e.area ?? '').toLowerCase().includes(q)
      )
    }

    if (filtroEstado !== 'todos') {
      list = list.filter(e => {
        if (filtroEstado === 'riesgo') return e.progreso < 30
        if (filtroEstado === 'progreso') return e.progreso >= 30 && e.progreso < 70
        if (filtroEstado === 'aldia') return e.progreso >= 70
        return true
      })
    }

    if (filtroArea !== 'todas') {
      list = list.filter(e => e.area === filtroArea)
    }

    list.sort((a, b) => {
      let diff = 0
      if (sort.key === 'nombre') diff = a.nombre.localeCompare(b.nombre)
      else if (sort.key === 'progreso') diff = a.progreso - b.progreso
      else if (sort.key === 'dias') diff = (diasDesde(a.fecha_ingreso) ?? 0) - (diasDesde(b.fecha_ingreso) ?? 0)
      else if (sort.key === 'area') diff = (a.area ?? '').localeCompare(b.area ?? '')
      return sort.dir === 'asc' ? diff : -diff
    })

    return list
  }, [empleados, busqueda, filtroEstado, filtroArea, sort])

  const totalPaginas = Math.max(1, Math.ceil(empleadosFiltrados.length / ITEMS_PER_PAGE))
  const empleadosPagina = empleadosFiltrados.slice((pagina - 1) * ITEMS_PER_PAGE, pagina * ITEMS_PER_PAGE)

  // Reset página al cambiar filtros
  useEffect(() => { setPagina(1) }, [busqueda, filtroEstado, filtroArea, sort])

  const handleSort = (key: SortKey) => {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }))
  }

  // ── Métricas ──
  const empleadosActivos = empleados.length
  const promedioProgreso = empleados.length > 0
    ? Math.round(empleados.reduce((s, e) => s + e.progreso, 0) / empleados.length) : 0
  const alertasPendientes = alertas.length
  const onboardingsEsteMes = empleados.filter(e => {
    if (!e.fecha_ingreso) return false
    const d = new Date(e.fecha_ingreso), n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
  }).length

  // Conteos por estado
  const conteos = useMemo(() => ({
    todos: empleados.length,
    riesgo: empleados.filter(e => e.progreso < 30).length,
    progreso: empleados.filter(e => e.progreso >= 30 && e.progreso < 70).length,
    aldia: empleados.filter(e => e.progreso >= 70).length,
  }), [empleados])

  const resolverAlerta = async (id: string) => {
    const snapshot = alertas
    setAlertas(prev => prev.filter(a => a.id !== id))
    const supabase = createClient()
    const { error } = await supabase.from('alertas_conocimiento').update({ resuelta: true }).eq('id', id)
    if (error) { setAlertas(snapshot); toast.error('No se pudo resolver la alerta') }
    else toast.success('Alerta resuelta')
  }

  if (loading) return <Skeleton />

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 max-w-7xl mx-auto"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => router.push('/admin/empleados')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
            bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400
            shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 hover:scale-[1.02]
            transition-all duration-200 text-white"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Sumar al equipo
        </button>
      </div>

      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard valor={empleadosActivos} label="Empleados activos" icon={<Users className="w-4 h-4" />} />
        <MetricCard valor={promedioProgreso} label="Progreso promedio" icon={<TrendingUp className="w-4 h-4" />} sufijo="%" />
        <MetricCard valor={alertasPendientes} label="Alertas pendientes" icon={<AlertTriangle className="w-4 h-4" />} accent={alertasPendientes > 0 ? 'bg-amber-400' : undefined} />
        <MetricCard valor={onboardingsEsteMes} label="Nuevos este mes" icon={<UserPlus className="w-4 h-4" />} />
      </div>

      {/* ── Grid principal ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── Left: Tabla de empleados ── */}
        <div className="xl:col-span-2 space-y-3">

          {/* ── Controles ── */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Búsqueda */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, puesto o área..."
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08]
                  text-white/80 placeholder:text-white/25 focus:outline-none focus:border-[#0EA5E9]/40
                  focus:bg-white/[0.06] transition-all duration-150"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/70">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtro área */}
            {areas.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowAreaFilter(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-all duration-150
                    ${filtroArea !== 'todas'
                      ? 'bg-[#0EA5E9]/15 border-[#0EA5E9]/30 text-[#38BDF8]'
                      : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/[0.15]'
                    }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {filtroArea === 'todas' ? 'Área' : filtroArea}
                </button>
                {showAreaFilter && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-white/[0.08]
                    bg-[#0A1628] shadow-2xl z-20 py-1 overflow-hidden">
                    {['todas', ...areas].map(a => (
                      <button
                        key={a}
                        onClick={() => { setFiltroArea(a); setShowAreaFilter(false) }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors
                          ${filtroArea === a ? 'text-[#38BDF8] bg-[#0EA5E9]/10' : 'text-white/55 hover:text-white/90 hover:bg-white/[0.04]'}`}
                      >
                        {a === 'todas' ? 'Todas las áreas' : a}
                        {filtroArea === a && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Filtros de estado ── */}
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: 'todos', label: 'Todos', count: conteos.todos, color: '' },
              { key: 'riesgo', label: 'En riesgo', count: conteos.riesgo, color: 'text-red-400 bg-red-500/10 border-red-500/20 data-[active=true]:border-red-500/40' },
              { key: 'progreso', label: 'En progreso', count: conteos.progreso, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 data-[active=true]:border-amber-500/40' },
              { key: 'aldia', label: 'Al día', count: conteos.aldia, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20 data-[active=true]:border-teal-500/40' },
            ] as { key: FiltroEstado; label: string; count: number; color: string }[]).map(f => (
              <button
                key={f.key}
                data-active={filtroEstado === f.key}
                onClick={() => setFiltroEstado(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-all duration-150
                  ${filtroEstado === f.key
                    ? f.key === 'todos'
                      ? 'bg-white/[0.08] border-white/[0.15] text-white/90'
                      : f.color
                    : 'bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/[0.12]'
                  }`}
              >
                {f.label}
                <span className="font-mono tabular-nums opacity-70">{f.count}</span>
              </button>
            ))}
          </div>

          {/* ── Tabla ── */}
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 px-4 py-2.5
              bg-white/[0.03] border-b border-white/[0.06]">
              <div className="w-8" />
              <SortBtn col="nombre" label="Nombre / Área" sort={sort} onSort={handleSort} />
              <div className="w-28 hidden sm:block">
                <SortBtn col="progreso" label="Progreso" sort={sort} onSort={handleSort} />
              </div>
              <div className="w-16 hidden md:block">
                <SortBtn col="dias" label="Día" sort={sort} onSort={handleSort} />
              </div>
              <div className="w-5" />
            </div>

            {/* Filas */}
            {empleadosPagina.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-center">
                <Users className="w-8 h-8 text-white/15" />
                <p className="text-sm text-white/35">
                  {empleados.length === 0
                    ? 'No hay empleados registrados aún.'
                    : 'Sin resultados para esta búsqueda.'}
                </p>
                {empleados.length === 0 && (
                  <button
                    onClick={() => router.push('/admin/empleados')}
                    className="mt-1 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0EA5E9]/15 text-[#38BDF8] border border-[#0EA5E9]/25 hover:bg-[#0EA5E9]/25 transition-colors"
                  >
                    Agregar primer empleado
                  </button>
                )}
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {empleadosPagina.map((empleado, idx) => {
                  const dias = diasDesde(empleado.fecha_ingreso)
                  const initials = getInitials(empleado.nombre)
                  const est = estadoLabel(empleado.progreso)

                  return (
                    <motion.div
                      key={empleado.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: idx * 0.02 }}
                    >
                      <Link
                        href={`/admin/empleados/${empleado.id}`}
                        className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 items-center
                          px-4 py-3 hover:bg-white/[0.03] transition-colors duration-100 group
                          border-b border-white/[0.04] last:border-0"
                      >
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full flex-shrink-0 bg-[#0EA5E9]/15 border border-[#0EA5E9]/20
                          flex items-center justify-center overflow-hidden">
                          {empleado.foto_url ? (
                            <img src={empleado.foto_url} alt={empleado.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[#7DD3FC] text-[10px] font-bold">{initials}</span>
                          )}
                        </div>

                        {/* Nombre + área + semáforo */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white/80 truncate group-hover:text-white/95 transition-colors">
                              {empleado.nombre}
                            </span>
                            <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${est.dot}`} title={est.label} />
                          </div>
                          <span className="text-[11px] text-white/35 truncate">
                            {[empleado.puesto, empleado.area].filter(Boolean).join(' · ')}
                          </span>
                        </div>

                        {/* Progreso */}
                        <div className="w-28 hidden sm:block">
                          <MiniBar value={empleado.progreso} />
                        </div>

                        {/* Día */}
                        <div className="w-16 hidden md:block text-right">
                          {dias !== null ? (
                            <span className="text-[11px] font-mono text-white/35">Día {dias}</span>
                          ) : (
                            <span className="text-[11px] text-white/20">—</span>
                          )}
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 transition-colors" />
                      </Link>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </div>

          {/* ── Paginación ── */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-white/30">
                {(pagina - 1) * ITEMS_PER_PAGE + 1}–{Math.min(pagina * ITEMS_PER_PAGE, empleadosFiltrados.length)} de {empleadosFiltrados.length}
              </span>
              <div className="flex gap-1">
                {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPagina(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-all duration-150
                      ${p === pagina
                        ? 'bg-[#0EA5E9]/20 text-[#38BDF8] border border-[#0EA5E9]/30'
                        : 'text-white/35 hover:text-white/70 hover:bg-white/[0.04]'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Alertas + Chart ── */}
        <div className="flex flex-col gap-5">

          {/* Alertas */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Alertas pendientes</h2>
              {alertas.length > 0 && (
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">
                  {alertas.length}
                </span>
              )}
            </div>

            {alertas.length === 0 ? (
              <div className="py-6 flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-teal-400" />
                </div>
                <p className="text-xs text-white/30 text-center">Sin alertas pendientes</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                <AnimatePresence>
                  {alertas.map(alerta => (
                    <motion.div
                      key={alerta.id}
                      layout
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 group"
                    >
                      <p className="text-[11px] text-white/65 line-clamp-2 leading-snug mb-2">
                        {alerta.pregunta}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-white/30">
                          {alerta.usuarios?.[0]?.nombre ?? '—'} · {tiempoRelativo(alerta.created_at)}
                        </span>
                        <button
                          onClick={() => resolverAlerta(alerta.id)}
                          className="text-[10px] font-semibold text-teal-400 hover:text-teal-300 transition-colors"
                        >
                          Resolver
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {alertas.length > 0 && (
              <Link href="/admin/reportes" className="text-[11px] text-white/30 hover:text-white/60 transition-colors text-center">
                Ver todos los reportes →
              </Link>
            )}
          </div>

          {/* Progreso por módulo */}
          {chartData.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Progreso por módulo</h2>
              <div className="space-y-3">
                {chartData.map(({ nombre, progreso }) => (
                  <div key={nombre} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/55 font-medium">{nombre}</span>
                      <span className="text-white/35 font-mono">{progreso}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progreso}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: progreso >= 70 ? '#0D9488' : progreso >= 30 ? '#F59E0B' : '#EF4444' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Distribución de estado */}
              <div className="pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-2">
                {[
                  { label: 'Al día', count: conteos.aldia, color: 'text-teal-400' },
                  { label: 'En prog.', count: conteos.progreso, color: 'text-amber-400' },
                  { label: 'En riesgo', count: conteos.riesgo, color: 'text-red-400' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="text-center">
                    <p className={`text-lg font-bold font-mono ${color}`}>{count}</p>
                    <p className="text-[10px] text-white/30">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
