'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Users, TrendingUp, AlertTriangle, UserPlus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getInitials, formatFecha, semaforoColor, diasDesde } from '@/lib/utils'
import { ProgressBar } from '@/components/ui/ProgressBar'
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

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
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
// Helpers locales
// ─────────────────────────────────────────────

function tiempoRelativo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutos = Math.floor(diffMs / 60000)
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas}h`
  return `hace ${Math.floor(horas / 24)}d`
}

function calcularProgreso(
  userId: string,
  progresoRows: ProgresoRow[],
  totalBloques: number
): number {
  const completados = progresoRows.filter(
    p => p.usuario_id === userId && p.completado
  ).length
  return totalBloques > 0 ? Math.min(100, Math.round((completados / totalBloques) * 100)) : 0
}

function calcularPromedioModulo(
  progresoRows: ProgresoRow[],
  empleadoIds: string[],
  modulo: string,
  totalBloques: number
): number {
  if (empleadoIds.length === 0 || totalBloques === 0) return 0
  const suma = empleadoIds.reduce((acc, uid) => {
    const completados = progresoRows.filter(
      p => p.usuario_id === uid && p.modulo === modulo && p.completado
    ).length
    return acc + Math.min(100, Math.round((completados / totalBloques) * 100))
  }, 0)
  return Math.round(suma / empleadoIds.length)
}

// ─────────────────────────────────────────────
// Skeletons
// ─────────────────────────────────────────────

function MetricSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="shimmer bg-white border border-gray-200 rounded-xl h-24" />
      ))}
    </div>
  )
}

function EmpleadosSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="shimmer bg-white border border-gray-200 rounded-xl h-28" />
      ))}
    </div>
  )
}

function AlertasSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="shimmer rounded-lg h-14" />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// EmpleadoCard
// ─────────────────────────────────────────────

function EmpleadoCard({ empleado }: { empleado: AdminEmpleadoConProgreso }) {
  const dias = diasDesde(empleado.fecha_ingreso)
  const initials = getInitials(empleado.nombre)

  return (
    <motion.div variants={cardVariants}>
      <Link
        href={`/admin/empleados/${empleado.id}`}
        className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 flex flex-col gap-3 block
          hover:shadow-md hover:border-gray-300 transition-all duration-200 group"
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-11 h-11 rounded-full flex-shrink-0 bg-[#0EA5E9]/20 border border-[#0EA5E9]/20 flex items-center justify-center overflow-hidden">
            {empleado.foto_url ? (
              <img src={empleado.foto_url} alt={empleado.nombre} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[#7DD3FC] text-sm font-semibold">{initials}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate flex-1 transition-colors duration-150">
                {empleado.nombre}
              </p>
              {/* Semáforo */}
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${semaforoColor(empleado.progreso)}`}
                title={
                  empleado.progreso < 30
                    ? `Requiere atención — Progreso: ${empleado.progreso}%`
                    : empleado.progreso < 70
                    ? `En progreso — ${empleado.progreso}%`
                    : `Al día — ${empleado.progreso}%`
                }
                aria-label={
                  empleado.progreso < 30
                    ? 'Requiere atención'
                    : empleado.progreso < 70
                    ? 'En progreso'
                    : 'Al día'
                }
              />
            </div>

            {empleado.puesto && (
              <p className="text-xs text-gray-500 truncate">{empleado.puesto}</p>
            )}
            {empleado.area && (
              <p className="text-[11px] text-gray-400 truncate">{empleado.area}</p>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        <ProgressBar value={empleado.progreso} animated />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            Ingresó {formatFecha(empleado.fecha_ingreso)}
          </span>
          {dias !== null && (
            <span className="text-[11px] font-mono text-gray-500">
              Día {dias}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// MetricCard
// ─────────────────────────────────────────────

function MetricCard({
  valor,
  label,
  icon,
  sufijo,
}: {
  valor: number
  label: string
  icon: React.ReactNode
  sufijo?: string
}) {
  return (
    <motion.div
      variants={cardVariants}
      className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-gray-400">{icon}</span>
      </div>
      <p className="text-4xl font-bold font-mono text-gray-900 tabular-nums">
        {valor}
        {sufijo && <span className="text-xl text-gray-500 ml-0.5">{sufijo}</span>}
      </p>
      <p className="text-xs text-gray-500 mt-2">{label}</p>
    </motion.div>
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

  // ── Carga de datos ──
  const cargarDatos = useCallback(async (empId: string) => {
    try {
      const supabase = createClient()

      // a. Empleados de la empresa
      const { data: empleadosRaw } = await supabase
        .from('usuarios')
        .select('id, nombre, puesto, area, foto_url, fecha_ingreso')
        .eq('empresa_id', empId)
        .eq('rol', 'empleado')

      if (!empleadosRaw || empleadosRaw.length === 0) {
        setEmpleados([])
        setAlertas([])
        setChartData([])
        return
      }

      const empleadoIds = empleadosRaw.map(e => e.id)

      // b, c, d, e en paralelo
      const [progresoRes, alertasRes, culturaCountRes, rolCountRes] = await Promise.all([
        supabase
          .from('progreso_modulos')
          .select('usuario_id, modulo, bloque, completado')
          .in('usuario_id', empleadoIds),
        supabase
          .from('alertas_conocimiento')
          .select('id, pregunta, usuario_id, created_at, resuelta, usuarios(nombre)')
          .eq('empresa_id', empId)
          .eq('resuelta', false)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('conocimiento')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', empId)
          .eq('modulo', 'cultura'),
        supabase
          .from('conocimiento')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', empId)
          .eq('modulo', 'rol'),
      ])

      const progresoRows: ProgresoRow[] = (progresoRes.data ?? []) as ProgresoRow[]
      const totalBloquesCultura = culturaCountRes.count ?? 0
      // Mínimo 1 bloque de rol para no dividir por 0 si la empresa aún no cargó contenido
      const totalBloquesRol = Math.max(1, rolCountRes.count ?? 1)
      const totalBloques = totalBloquesCultura + totalBloquesRol

      // Calcular progreso por empleado
      const empleadosConProgreso: AdminEmpleadoConProgreso[] = empleadosRaw.map(e => ({
        id: e.id,
        nombre: e.nombre ?? '',
        puesto: e.puesto ?? undefined,
        area: e.area ?? undefined,
        foto_url: e.foto_url ?? undefined,
        fecha_ingreso: e.fecha_ingreso ?? undefined,
        progreso: calcularProgreso(e.id, progresoRows, totalBloques),
      }))

      setEmpleados(empleadosConProgreso)
      setAlertas((alertasRes.data ?? []) as AlertaRow[])

      // Chart data
      const avgCultura = calcularPromedioModulo(
        progresoRows,
        empleadoIds,
        'cultura',
        totalBloquesCultura
      )
      const avgRol = calcularPromedioModulo(progresoRows, empleadoIds, 'rol', totalBloquesRol)
      setChartData([
        { nombre: 'Cultura', progreso: avgCultura },
        { nombre: 'Rol', progreso: avgRol },
      ])
    } catch (err) {
      console.error('[AdminDashboard] Error en cargarDatos:', err)
      setEmpleados([])
      setAlertas([])
      setChartData([])
    }
  }, [])

  // ── Inicialización ──
  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data: usuarioData } = await supabase
          .from('usuarios')
          .select('empresa_id')
          .eq('id', user.id)
          .single()

        if (!usuarioData?.empresa_id) return

        setEmpresaId(usuarioData.empresa_id)
        await cargarDatos(usuarioData.empresa_id)
      } catch (err) {
        console.error('Error cargando dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [cargarDatos])

  // ── Realtime ──
  useEffect(() => {
    if (!empresaId) return

    const supabase = createClient()
    const channel = supabase
      .channel('dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'progreso_modulos' },
        () => cargarDatos(empresaId)
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alertas_conocimiento',
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => cargarDatos(empresaId)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [empresaId, cargarDatos])

  // ── Marcar alerta como resuelta ──
  const resolverAlerta = async (id: string) => {
    // Optimistic update
    const snapshot = alertas
    setAlertas(prev => prev.filter(a => a.id !== id))

    const supabase = createClient()
    const { error } = await supabase
      .from('alertas_conocimiento')
      .update({ resuelta: true })
      .eq('id', id)

    if (error) {
      setAlertas(snapshot) // rollback
      toast.error('No se pudo resolver la alerta')
    } else {
      toast.success('Alerta marcada como resuelta')
    }
  }

  // ── Métricas derivadas ──
  const empleadosActivos = empleados.length
  const promedioProgreso =
    empleados.length > 0
      ? Math.round(empleados.reduce((sum, e) => sum + e.progreso, 0) / empleados.length)
      : 0
  const alertasPendientes = alertas.length
  const onboardingsEsteMes = empleados.filter(e => {
    if (!e.fecha_ingreso) return false
    const ingreso = new Date(e.fecha_ingreso)
    const ahora = new Date()
    return (
      ingreso.getMonth() === ahora.getMonth() &&
      ingreso.getFullYear() === ahora.getFullYear()
    )
  }).length

  // ─────────────────────────────────────────────
  // Render: loading skeleton
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <MetricSkeleton />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <EmpleadosSkeleton />
          </div>
          <div className="space-y-4">
            <AlertasSkeleton />
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────
  // Render principal
  // ─────────────────────────────────────────────
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* ── Header de página ── */}
      <motion.div
        variants={cardVariants}
        className="flex items-center justify-end gap-4"
      >
        <button
          onClick={() => router.push('/admin/empleados')}
          className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl
            text-sm font-semibold text-white
            bg-gradient-to-r from-cyan-500 to-indigo-500
            hover:from-cyan-400 hover:to-indigo-400
            shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40
            hover:scale-105 transition-all duration-300"
        >
          <Sparkles className="w-5 h-5" />
          <span>Sumar al equipo</span>
        </button>
      </motion.div>

      {/* ── Métricas: 4 cards ── */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <MetricCard
          valor={empleadosActivos}
          label="Empleados activos"
          icon={<Users className="w-4 h-4" />}
        />
        <MetricCard
          valor={promedioProgreso}
          label="Progreso promedio"
          icon={<TrendingUp className="w-4 h-4" />}
          sufijo="%"
        />
        <MetricCard
          valor={alertasPendientes}
          label="Alertas pendientes"
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <MetricCard
          valor={onboardingsEsteMes}
          label="Nuevos este mes"
          icon={<UserPlus className="w-4 h-4" />}
        />
      </motion.div>

      {/* ── Grid principal ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left: Grid de empleados ── */}
        <div className="xl:col-span-2">
          {empleados.length === 0 ? (
            <motion.div
              variants={cardVariants}
              className="bg-white border border-gray-200 shadow-sm rounded-xl p-8 flex flex-col items-center justify-center gap-4 min-h-[200px]"
            >
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="empGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0EA5E9" stopOpacity="0.4" />
                    <stop offset="1" stopColor="#0D9488" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                <circle cx="28" cy="20" r="9" stroke="url(#empGrad)" strokeWidth="1.5" />
                <path d="M10 54c0-9.941 8.059-18 18-18s18 8.059 18 18" stroke="url(#empGrad)" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="46" cy="22" r="6" stroke="url(#empGrad)" strokeWidth="1.5" strokeOpacity="0.5" />
                <path d="M50 54c0-7-4-11.5-8.5-13.5" stroke="url(#empGrad)" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5" />
              </svg>
              <p className="text-sm text-gray-500 text-center">
                No hay empleados registrados aún.
              </p>
            </motion.div>
          ) : (
            <motion.div
              variants={containerVariants}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-6"
            >
              {empleados.map(empleado => (
                <EmpleadoCard key={empleado.id} empleado={empleado} />
              ))}
            </motion.div>
          )}
        </div>

        {/* ── Right: Alertas + Chart ── */}
        <div className="flex flex-col gap-6">

          {/* Alertas recientes */}
          <motion.div variants={cardVariants} className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 flex flex-col gap-3 hover:shadow-md hover:border-gray-300 transition-all duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">
                Alertas recientes
              </h2>
              {alertas.length > 0 && (
                <span className="text-[10px] font-mono text-gray-400">
                  {alertas.length} pendientes
                </span>
              )}
            </div>

            {alertas.length === 0 ? (
              <div className="py-4 flex flex-col items-center gap-2">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="okGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#0D9488" stopOpacity="0.35" />
                      <stop offset="1" stopColor="#0EA5E9" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>
                  <circle cx="20" cy="20" r="14" stroke="url(#okGrad)" strokeWidth="1.5" />
                  <path d="M13 20l5 5 9-10" stroke="url(#okGrad)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-xs text-gray-500 text-center">Sin alertas pendientes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alertas.map(alerta => (
                  <motion.div
                    key={alerta.id}
                    layout
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="rounded-lg bg-gray-50 border border-gray-200 p-3 flex flex-col gap-2"
                  >
                    <p className="text-xs text-gray-800 line-clamp-2 leading-snug">
                      {alerta.pregunta}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-gray-500 truncate">
                          {alerta.usuarios?.[0]?.nombre ?? 'Empleado'}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {tiempoRelativo(alerta.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => resolverAlerta(alerta.id)}
                        className="text-[10px] font-medium text-cyan-700 hover:text-cyan-800
                          border border-cyan-200 hover:border-cyan-400 bg-white
                          px-3 min-h-[44px] rounded-md transition-colors duration-150 flex-shrink-0"
                      >
                        Resolver
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Progreso por módulo — Chart */}
          <motion.div variants={cardVariants} className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 hover:shadow-md hover:border-gray-300 transition-all duration-200">
            <h2 className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-4">
              Progreso por módulo
            </h2>

            {chartData.length === 0 || chartData.every(d => d.progreso === 0) ? (
              <div className="h-[180px] flex items-center justify-center">
                <p className="text-xs text-gray-400">Sin datos de progreso aún</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <XAxis
                    dataKey="nombre"
                    tick={{ fontSize: 11, fill: 'rgba(17,24,39,0.7)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: 'rgba(17,24,39,0.5)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#111827',
                    }}
                    formatter={(value) => [`${value ?? 0}%`, 'Promedio']}
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  />
                  <Bar dataKey="progreso" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.progreso > 70
                            ? '#0D9488'
                            : entry.progreso >= 30
                            ? '#F59E0B'
                            : '#0EA5E9'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

        </div>
      </div>
    </motion.div>
  )
}
