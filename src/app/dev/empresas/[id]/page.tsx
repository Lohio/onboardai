'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Users, ShieldCheck, MessageSquare, TrendingUp,
  Trash2, AlertTriangle, X, Building2, Calendar,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ErrorState } from '@/components/shared/ErrorState'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

type Plan = 'free' | 'starter' | 'pro' | 'enterprise'
type UserRol = 'empleado' | 'admin' | 'dev'

interface EmpresaDetalle {
  id: string
  nombre: string
  slug: string | null
  plan: Plan | null
  created_at: string
}

interface UsuarioFila {
  id: string
  nombre: string
  email: string
  puesto: string | null
  rol: UserRol
  created_at: string
  foto_url: string | null
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const PLAN_VARIANTS: Record<Plan, 'default' | 'success' | 'warning' | 'info'> = {
  free: 'default',
  starter: 'info',
  pro: 'success',
  enterprise: 'warning',
}

const TOTAL_BLOQUES_ESTIMADO = 20

function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()
}

function diasOnboarding(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
}

function progresoPercent(bloquesCompletados: number): number {
  return Math.min(100, Math.round((bloquesCompletados / TOTAL_BLOQUES_ESTIMADO) * 100))
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

// ─────────────────────────────────────────────
// Skeleton de carga
// ─────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="shimmer h-4 w-24 rounded" />
        <div className="shimmer h-7 w-48 rounded" />
        <div className="shimmer h-3 w-32 rounded" />
      </div>

      {/* Métrica cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shimmer h-24 rounded-xl" />
        ))}
      </div>

      {/* Tabla skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shimmer h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Tarjeta de métrica
// ─────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  accent: string
}

function MetricCard({ label, value, icon, accent }: MetricCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      className="glass-card rounded-xl p-5 flex items-start gap-3"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-white/40 font-medium">{label}</p>
        <p className="text-2xl font-semibold text-white/90 mt-0.5 tabular-nums">{value}</p>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Fila de usuario
// ─────────────────────────────────────────────

interface UsuarioFilaProps {
  usuario: UsuarioFila
  progresoBloques: number
  onDeleted: (id: string) => void
}

function UsuarioFilaRow({ usuario, progresoBloques, onDeleted }: UsuarioFilaProps) {
  const [confirmando, setConfirmando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  async function handleEliminar() {
    setEliminando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('usuarios').delete().eq('id', usuario.id)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Usuario eliminado')
      onDeleted(usuario.id)
    } catch {
      toast.error('Error inesperado al eliminar usuario')
    } finally {
      setEliminando(false)
      setConfirmando(false)
    }
  }

  const pct = progresoPercent(progresoBloques)
  const dias = diasOnboarding(usuario.created_at)
  const avatarBg = usuario.rol === 'admin'
    ? 'bg-[#3B4FD8]/20 border border-[#3B4FD8]/30 text-indigo-300'
    : 'bg-[#0D9488]/15 border border-[#0D9488]/25 text-teal-300'

  return (
    <motion.div
      variants={cardVariants}
      layout
      className="glass-card rounded-xl px-4 py-3.5 flex items-center gap-3 relative overflow-hidden"
    >
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${avatarBg}`}>
        {getInitials(usuario.nombre)}
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white/85 truncate">{usuario.nombre}</span>
          <Badge variant={usuario.rol === 'admin' ? 'indigo' : 'teal'}>
            {usuario.rol}
          </Badge>
        </div>
        <p className="text-xs text-white/35 truncate">{usuario.email}</p>
        {usuario.puesto && (
          <p className="text-xs text-white/25 truncate">{usuario.puesto}</p>
        )}
      </div>

      {/* Días */}
      <div className="hidden sm:flex flex-col items-center flex-shrink-0 w-16 text-center">
        <span className="text-base font-semibold text-white/70 tabular-nums">{dias}</span>
        <span className="text-[10px] text-white/30">días</span>
      </div>

      {/* Progreso */}
      <div className="hidden md:block flex-shrink-0 w-28">
        <ProgressBar value={pct} showPercentage animated />
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {!confirmando ? (
          <button
            onClick={() => setConfirmando(true)}
            className="p-1.5 text-white/25 hover:text-red-400 transition-colors rounded-md hover:bg-red-500/[0.06]"
            title="Eliminar usuario"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span className="text-[11px] text-white/50 hidden sm:block">¿Eliminar?</span>
              <button
                onClick={handleEliminar}
                disabled={eliminando}
                className="px-2 py-1 text-[11px] font-medium rounded bg-red-500/20 text-red-300
                  border border-red-500/25 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {eliminando ? '...' : 'Sí'}
              </button>
              <button
                onClick={() => setConfirmando(false)}
                className="p-1 text-white/30 hover:text-white/60 transition-colors rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function EmpresaDetallePage() {
  const params = useParams()
  const router = useRouter()
  const empresaId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [empresa, setEmpresa] = useState<EmpresaDetalle | null>(null)
  const [usuarios, setUsuarios] = useState<UsuarioFila[]>([])
  const [progresoPorUsuario, setProgresoPorUsuario] = useState<Map<string, number>>(new Map())
  const [mensajesCount, setMensajesCount] = useState<number>(0)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()

      // Verificar sesión y rol dev
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: ud } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()
      if (!ud || ud.rol !== 'dev') { router.push('/admin'); return }

      // Cargar datos en paralelo
      const [
        { data: empData, error: empError },
        { data: usersData, error: usersError },
        { data: progresosData },
        { count: msgCount },
      ] = await Promise.all([
        supabase
          .from('empresas')
          .select('id, nombre, slug, plan, created_at')
          .eq('id', empresaId)
          .single(),
        supabase
          .from('usuarios')
          .select('id, nombre, email, puesto, rol, created_at, foto_url')
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: true }),
        supabase
          .from('progreso_modulos')
          .select('usuario_id')
          .eq('empresa_id', empresaId),
        supabase
          .from('mensajes_ia')
          .select('conversaciones_ia!inner(empresa_id)', { count: 'exact', head: true })
          .eq('conversaciones_ia.empresa_id', empresaId),
      ])

      if (empError) throw new Error(empError.message ?? 'Error cargando empresa')
      if (usersError) {
        console.warn('[EmpresaDetalle] usuarios:', usersError.message)
      }

      setEmpresa(empData as EmpresaDetalle)
      setUsuarios((usersData ?? []) as UsuarioFila[])

      // Construir mapa progreso_modulos por usuario
      const mapa = new Map<string, number>()
      for (const row of (progresosData ?? [])) {
        const uid = (row as { usuario_id: string }).usuario_id
        mapa.set(uid, (mapa.get(uid) ?? 0) + 1)
      }
      setProgresoPorUsuario(mapa)
      setMensajesCount(msgCount ?? 0)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg)
      console.error('[EmpresaDetalle]', err)
    } finally {
      setLoading(false)
    }
  }, [empresaId, router])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // Métricas derivadas
  const totalEmpleados = usuarios.filter(u => u.rol === 'empleado').length
  const totalAdmins = usuarios.filter(u => u.rol === 'admin').length
  const progresoPromedio = usuarios.length > 0
    ? Math.round(
        usuarios.reduce((acc, u) => acc + progresoPercent(progresoPorUsuario.get(u.id) ?? 0), 0)
        / usuarios.length
      )
    : 0

  if (loading) return (
    <div className="space-y-6">
      <LoadingSkeleton />
    </div>
  )

  if (error || !empresa) return (
    <ErrorState
      mensaje={error ?? 'Empresa no encontrada'}
      onRetry={cargarDatos}
    />
  )

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Header ── */}
      <motion.div variants={cardVariants} className="space-y-3">
        <Link
          href="/dev/empresas"
          className="inline-flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65
            transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          Volver a empresas
        </Link>

        <div className="flex items-start gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20
            flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold text-white">{empresa.nombre}</h1>
              {empresa.plan && (
                <Badge variant={PLAN_VARIANTS[empresa.plan] ?? 'default'}>
                  {empresa.plan}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-white/35">
              {empresa.slug && (
                <span className="font-mono text-white/30">{empresa.slug}</span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Creada {formatFecha(empresa.created_at)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Métricas ── */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <MetricCard
          label="Empleados"
          value={totalEmpleados}
          icon={<Users className="w-4 h-4 text-teal-400" />}
          accent="bg-[#0D9488]/15 border border-[#0D9488]/20"
        />
        <MetricCard
          label="Admins"
          value={totalAdmins}
          icon={<ShieldCheck className="w-4 h-4 text-indigo-400" />}
          accent="bg-[#3B4FD8]/15 border border-[#3B4FD8]/20"
        />
        <MetricCard
          label="Mensajes IA"
          value={mensajesCount}
          icon={<MessageSquare className="w-4 h-4 text-[#38BDF8]" />}
          accent="bg-[#0EA5E9]/12 border border-[#0EA5E9]/20"
        />
        <MetricCard
          label="Progreso promedio"
          value={`${progresoPromedio}%`}
          icon={<TrendingUp className="w-4 h-4 text-amber-400" />}
          accent="bg-amber-500/12 border border-amber-500/20"
        />
      </motion.div>

      {/* ── Tabla de usuarios ── */}
      <motion.div variants={cardVariants} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/70">
            Usuarios <span className="text-white/30 font-normal">({usuarios.length})</span>
          </h2>
          {/* Leyenda columnas */}
          <div className="hidden md:flex items-center gap-6 text-[11px] text-white/25 pr-8">
            <span className="w-16 text-center">Días</span>
            <span className="w-28 text-center">Progreso</span>
          </div>
        </div>

        {usuarios.length === 0 ? (
          <div className="glass-card rounded-xl py-14 flex flex-col items-center gap-3">
            <Users className="w-8 h-8 text-white/10" />
            <p className="text-sm text-white/35">Sin usuarios en esta empresa</p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            className="space-y-2"
          >
            <AnimatePresence>
              {usuarios.map(u => (
                <UsuarioFilaRow
                  key={u.id}
                  usuario={u}
                  progresoBloques={progresoPorUsuario.get(u.id) ?? 0}
                  onDeleted={id => setUsuarios(prev => prev.filter(x => x.id !== id))}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
