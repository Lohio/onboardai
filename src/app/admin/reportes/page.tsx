'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Users, Clock, CheckCircle2, AlertTriangle, MessageSquare, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import type { BadgeVariant } from '@/components/ui/Badge'

// ─────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────

type FranjaKey = '30d' | '60d' | '90d' | 'graduados'

interface EmpleadoReporte {
  id: string
  nombre: string
  puesto: string | null
  foto_url: string | null
  fecha_ingreso: string | null
  diasOnboarding: number
  franja: FranjaKey
  progreso: number          // 0–100
  progresoEsperado: number  // meta según franja
  enMeta: boolean
  estancado: boolean
  ultimaActividad: string | null
}

/** Fila de la query de progreso_modulos */
interface ProgresoRow {
  usuario_id: string
  completado: boolean
  created_at: string
}

// ─────────────────────────────────────────────
// Constantes de franja
// ─────────────────────────────────────────────

const FRANJAS: { key: FranjaKey; label: string; diaMin: number; diaMax: number; meta: number }[] = [
  { key: '30d', label: '30 días',   diaMin: 0,  diaMax: 30,  meta: 25 },
  { key: '60d', label: '60 días',   diaMin: 31, diaMax: 60,  meta: 60 },
  { key: '90d', label: '90 días',   diaMin: 61, diaMax: 90,  meta: 90 },
  { key: 'graduados', label: 'Graduados', diaMin: 91, diaMax: Infinity, meta: 90 },
]

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
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
  return nombre
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function diasDesdeIngreso(fechaIngreso: string | null): number {
  if (!fechaIngreso) return 0
  const diffMs = Date.now() - new Date(fechaIngreso).getTime()
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

function getFranja(dias: number): FranjaKey {
  if (dias <= 30) return '30d'
  if (dias <= 60) return '60d'
  if (dias <= 90) return '90d'
  return 'graduados'
}

function getMetaPorFranja(franja: FranjaKey): number {
  return FRANJAS.find(f => f.key === franja)?.meta ?? 90
}

function esEstancado(ultimaActividad: string | null): boolean {
  if (!ultimaActividad) return true
  const sietesDias = 7 * 24 * 60 * 60 * 1000
  return Date.now() - new Date(ultimaActividad).getTime() > sietesDias
}

// ─────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────

function SkeletonColumna() {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="shimmer h-4 w-24 rounded mb-1" />
        <div className="shimmer h-3 w-16 rounded" />
      </div>
      <div className="p-3 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="shimmer rounded-lg h-24" />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Empty state de una franja
// ─────────────────────────────────────────────

function EmptyFranja({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <Users className="w-7 h-7 text-white/10" />
      <p className="text-xs text-white/25 text-center">
        Sin empleados en franja {label}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────
// Badge de estado del empleado
// ─────────────────────────────────────────────

function BadgeEstado({ emp }: { emp: EmpleadoReporte }) {
  // Para graduados: lógica propia
  if (emp.franja === 'graduados') {
    return emp.progreso >= 90
      ? <Badge variant="success">Completado</Badge>
      : <Badge variant="warning">Pendiente</Badge>
  }

  // Para el resto: estancado > en meta > en progreso
  if (emp.estancado) {
    return <Badge variant="error">Estancado</Badge>
  }
  if (emp.enMeta) {
    return <Badge variant="success">En meta</Badge>
  }
  return <Badge variant="warning">En progreso</Badge>
}

// ─────────────────────────────────────────────
// Card individual de empleado
// ─────────────────────────────────────────────

function EmpleadoReporteCard({
  emp,
  onClick,
}: {
  emp: EmpleadoReporte
  onClick: () => void
}) {
  const initials = getInitials(emp.nombre)

  // Color de la barra de progreso según si está en meta
  const barColor = emp.estancado
    ? 'bg-red-500'
    : emp.enMeta
    ? 'bg-teal-500'
    : 'bg-amber-500'

  return (
    <motion.div variants={itemVariants}>
      <button
        onClick={onClick}
        className="w-full text-left rounded-xl p-3.5 group
          bg-white/[0.02] border border-white/[0.05]
          hover:bg-white/[0.05] hover:border-white/[0.10]
          transition-colors duration-150 space-y-3"
      >
        {/* Fila superior: avatar + nombre + badge */}
        <div className="flex items-start gap-2.5">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full flex-shrink-0 bg-indigo-600/20 border border-indigo-500/20
            flex items-center justify-center overflow-hidden">
            {emp.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={emp.foto_url} alt={emp.nombre} className="w-full h-full object-cover" />
            ) : (
              <span className="text-indigo-300 text-xs font-semibold">{initials}</span>
            )}
          </div>

          {/* Nombre + puesto */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/85 truncate
              group-hover:text-white transition-colors duration-150">
              {emp.nombre}
            </p>
            {emp.puesto && (
              <p className="text-xs text-white/35 truncate mt-0.5">{emp.puesto}</p>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/40">Progreso</span>
            <span className="font-mono text-white/60">{emp.progreso}%</span>
          </div>
          {/* Barra manual para poder controlar el color dinámicamente */}
          <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${emp.progreso}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              className={`h-full rounded-full ${barColor}`}
            />
          </div>
          {/* Meta esperada (línea de referencia visual en texto) */}
          <p className="text-[10px] text-white/25">
            Meta: {emp.progresoEsperado}% para esta franja
          </p>
        </div>

        {/* Footer: día + badge de estado */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-white/35 font-mono">
            Día {emp.diasOnboarding}
          </span>
          <BadgeEstado emp={emp} />
        </div>
      </button>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Columna de una franja
// ─────────────────────────────────────────────

interface FranjaColumnaProps {
  franjaKey: FranjaKey
  label: string
  meta: number
  empleados: EmpleadoReporte[]
  onNavigate: (id: string) => void
  iconColor: string
}

function FranjaColumna({
  franjaKey,
  label,
  meta,
  empleados,
  onNavigate,
  iconColor,
}: FranjaColumnaProps) {
  const enMeta    = empleados.filter(e => e.enMeta && !e.estancado).length
  const estancados = empleados.filter(e => e.estancado).length

  return (
    <div className="glass-card rounded-xl overflow-hidden flex flex-col">
      {/* Header de la columna */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Clock className={`w-3.5 h-3.5 ${iconColor}`} />
            <h2 className="text-sm font-semibold text-white/80">{label}</h2>
          </div>
          <p className="text-xs text-white/35 mt-0.5">
            {empleados.length} empleado{empleados.length !== 1 ? 's' : ''}
            {' · '}meta {meta}%
          </p>
        </div>

        {/* Resumen rápido */}
        {empleados.length > 0 && (
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {enMeta > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-teal-400">
                <CheckCircle2 className="w-3 h-3" />
                {enMeta} en meta
              </span>
            )}
            {estancados > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-red-400">
                <AlertTriangle className="w-3 h-3" />
                {estancados} estancado{estancados !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Lista de empleados */}
      <div className="flex-1 p-3">
        {empleados.length === 0 ? (
          <EmptyFranja label={label} />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-2"
          >
            {empleados.map(emp => (
              <EmpleadoReporteCard
                key={emp.id}
                emp={emp}
                onClick={() => onNavigate(emp.id)}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function ReportesPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [empleados, setEmpleados] = useState<EmpleadoReporte[]>([])

  // ── Carga de datos ──
  const cargarDatos = useCallback(async () => {
    try {
      const supabase = createClient()

      // Verificar sesión y obtener empresa_id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: perfil } = await supabase
        .from('usuarios')
        .select('empresa_id, rol')
        .eq('id', user.id)
        .single()

      if (!perfil || !['admin', 'dev'].includes(perfil.rol)) {
        router.push('/auth/login')
        return
      }

      const empresaId: string = perfil.empresa_id

      // 1. Empleados de la empresa
      const { data: usuariosRaw } = await supabase
        .from('usuarios')
        .select('id, nombre, puesto, foto_url, fecha_ingreso')
        .eq('empresa_id', empresaId)
        .eq('rol', 'empleado')
        .order('fecha_ingreso', { ascending: true })

      if (!usuariosRaw || usuariosRaw.length === 0) {
        setEmpleados([])
        return
      }

      const empleadoIds = usuariosRaw.map(u => u.id)

      // 2 y 3 en paralelo: progreso_modulos y total de bloques de conocimiento
      const [progresoRes, totalBloquesRes] = await Promise.all([
        supabase
          .from('progreso_modulos')
          .select('usuario_id, completado, created_at')
          .in('usuario_id', empleadoIds),
        supabase
          .from('conocimiento')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', empresaId),
      ])

      const progresoRows: ProgresoRow[] = (progresoRes.data ?? []) as ProgresoRow[]
      const totalBloques = Math.max(totalBloquesRes.count ?? 1, 1)

      // ── Procesar datos por empleado ──
      const lista: EmpleadoReporte[] = usuariosRaw.map(u => {
        const filasUsuario = progresoRows.filter(r => r.usuario_id === u.id)

        // Progreso: bloques completados / total
        const completados = filasUsuario.filter(r => r.completado).length
        const progreso = Math.min(100, Math.round((completados / totalBloques) * 100))

        // Última actividad: max created_at entre sus filas
        const ultimaActividad = filasUsuario.length > 0
          ? filasUsuario.reduce((max, r) => r.created_at > max ? r.created_at : max, filasUsuario[0].created_at)
          : null

        const diasOnboarding = diasDesdeIngreso(u.fecha_ingreso)
        const franja = getFranja(diasOnboarding)
        const progresoEsperado = getMetaPorFranja(franja)

        return {
          id: u.id,
          nombre: u.nombre ?? '',
          puesto: u.puesto ?? null,
          foto_url: u.foto_url ?? null,
          fecha_ingreso: u.fecha_ingreso ?? null,
          diasOnboarding,
          franja,
          progreso,
          progresoEsperado,
          enMeta: progreso >= progresoEsperado,
          estancado: esEstancado(ultimaActividad),
          ultimaActividad,
        }
      })

      setEmpleados(lista)
    } catch (err) {
      console.error('Error al cargar reportes:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Datos derivados por franja ──
  const por30d       = empleados.filter(e => e.franja === '30d')
  const por60d       = empleados.filter(e => e.franja === '60d')
  const por90d       = empleados.filter(e => e.franja === '90d')
  const porGraduados = empleados.filter(e => e.franja === 'graduados')

  // Métricas del header
  const totalEmpleados = empleados.length
  const enMetaTotal    = empleados.filter(e => e.enMeta && !e.estancado).length
  const estancadosTotal = empleados.filter(e => e.estancado).length

  // ─────────────────────────────────────────────
  // Render: skeleton
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="shimmer h-5 w-32 rounded-lg" />
            <div className="shimmer h-3.5 w-48 rounded" />
          </div>
          <div className="flex gap-3">
            {[1, 2, 3].map(i => <div key={i} className="shimmer h-8 w-20 rounded-lg" />)}
          </div>
        </div>
        {/* Columnas skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <SkeletonColumna key={i} />)}
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
      {/* ── Header ── */}
      <motion.div variants={itemVariants} className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-white/90">Reportes</h1>
          <p className="text-sm text-white/40 mt-0.5">Progreso 30 / 60 / 90 días</p>
        </div>

        {/* Métricas rápidas en el header */}
        {totalEmpleados > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Users className="w-3.5 h-3.5" />
              <span>{totalEmpleados} total</span>
            </div>
            {enMetaTotal > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-teal-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{enMetaTotal} en meta</span>
              </div>
            )}
            {estancadosTotal > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{estancadosTotal} estancado{estancadosTotal !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Tres columnas principales ── */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <motion.div variants={itemVariants}>
          <FranjaColumna
            franjaKey="30d"
            label="30 días"
            meta={25}
            empleados={por30d}
            onNavigate={id => router.push(`/admin/empleados/${id}`)}
            iconColor="text-teal-400"
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <FranjaColumna
            franjaKey="60d"
            label="60 días"
            meta={60}
            empleados={por60d}
            onNavigate={id => router.push(`/admin/empleados/${id}`)}
            iconColor="text-amber-400"
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <FranjaColumna
            franjaKey="90d"
            label="90 días"
            meta={90}
            empleados={por90d}
            onNavigate={id => router.push(`/admin/empleados/${id}`)}
            iconColor="text-indigo-400"
          />
        </motion.div>
      </motion.div>

      {/* ── Graduados: solo si hay empleados ── */}
      {porGraduados.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="glass-card rounded-xl overflow-hidden">
            {/* Header de la sección */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <h2 className="text-sm font-semibold text-white/80">Graduados</h2>
                <span className="text-xs text-white/35">· +90 días</span>
              </div>
              <span className="text-xs text-white/35">
                {porGraduados.length} empleado{porGraduados.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Grid de graduados */}
            <div className="p-3">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2"
              >
                {porGraduados.map(emp => (
                  <EmpleadoReporteCard
                    key={emp.id}
                    emp={emp}
                    onClick={() => router.push(`/admin/empleados/${emp.id}`)}
                  />
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Enlace a encuestas de pulso ── */}
      <motion.div variants={itemVariants}>
        <Link href="/admin/reportes/encuestas" className="block">
          <div className="glass-card rounded-xl p-4 flex items-center gap-4
            hover:border-white/[0.12] hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/15 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/80">Encuestas de pulso</p>
              <p className="text-xs text-white/35 mt-0.5">
                Feedback automático en días 7, 30 y 60 del onboarding
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-white/25 flex-shrink-0" />
          </div>
        </Link>
      </motion.div>

      {/* ── Empty state global ── */}
      {totalEmpleados === 0 && (
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl p-12 flex flex-col items-center gap-4"
        >
          <Users className="w-10 h-10 text-white/10" />
          <div className="text-center">
            <p className="text-sm font-medium text-white/40">Sin empleados registrados</p>
            <p className="text-xs text-white/25 mt-1">
              Los reportes se generarán automáticamente a medida que se agreguen empleados
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
