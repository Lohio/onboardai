'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Users, ShieldCheck, MessageSquare, TrendingUp,
  Trash2, AlertTriangle, X, Building2, Calendar, Bot,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { useLanguage } from '@/components/LanguageProvider'
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

interface UsoMensualFila {
  mes: string
  consultas: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
}

interface FuenteResumen {
  fuente: string
  llamadas: number
  tokens: number
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

/** Formatea un número con separadores es-AR */
function formatNum(n: number): string {
  return n.toLocaleString('es-AR')
}

/** Formatea una fecha `mes` (YYYY-MM-01) como "junio 2026" */
function formatMes(mes: string): string {
  return new Date(`${mes}T00:00:00`).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
}

/** Primer día del mes actual en formato YYYY-MM-01 */
function primerDiaMesActual(): string {
  const ahora = new Date()
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`
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
  const { t } = useLanguage()
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
      toast.success(t('dev.usuarioEliminado'))
      onDeleted(usuario.id)
    } catch {
      toast.error(t('dev.errorEliminarUsuario'))
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
        <span className="text-[10px] text-white/30">{t('dev.diasMin')}</span>
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
            title={t('dev.eliminarUsuario')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : (
          <AnimatePresence>
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span className="text-[11px] text-white/50 hidden sm:block">{t('dev.confirmEliminarQ')}</span>
              <button
                onClick={handleEliminar}
                disabled={eliminando}
                className="px-2 py-1 text-[11px] font-medium rounded bg-red-500/20 text-red-300
                  border border-red-500/25 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {eliminando ? '...' : t('dev.si')}
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
  const { t } = useLanguage()
  const empresaId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [empresa, setEmpresa] = useState<EmpresaDetalle | null>(null)
  const [usuarios, setUsuarios] = useState<UsuarioFila[]>([])
  const [progresoPorUsuario, setProgresoPorUsuario] = useState<Map<string, number>>(new Map())
  const [mensajesCount, setMensajesCount] = useState<number>(0)
  const [usoMensual, setUsoMensual] = useState<UsoMensualFila[]>([])
  const [usoFuentes, setUsoFuentes] = useState<FuenteResumen[]>([])

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

      // Consumo IA — no bloqueante (las tablas pueden no estar migradas aún)
      const [
        { data: mensualData, error: mensualError },
        { data: detalleData, error: detalleError },
      ] = await Promise.all([
        supabase
          .from('uso_mensual_ia')
          .select('mes, consultas, input_tokens, output_tokens, cache_read_tokens')
          .eq('empresa_id', empresaId)
          .order('mes', { ascending: false })
          .limit(3),
        supabase
          .from('uso_ia')
          .select('fuente, input_tokens, output_tokens')
          .eq('empresa_id', empresaId)
          .gte('created_at', primerDiaMesActual()),
      ])
      if (mensualError) console.warn('[EmpresaDetalle] uso_mensual_ia:', mensualError.message)
      if (detalleError) console.warn('[EmpresaDetalle] uso_ia:', detalleError.message)

      setUsoMensual((mensualData ?? []) as UsoMensualFila[])

      // Agrupar detalle del mes actual por fuente (count + suma de tokens)
      const porFuente = new Map<string, FuenteResumen>()
      for (const row of (detalleData ?? []) as { fuente: string; input_tokens: number | null; output_tokens: number | null }[]) {
        const acc = porFuente.get(row.fuente) ?? { fuente: row.fuente, llamadas: 0, tokens: 0 }
        acc.llamadas += 1
        acc.tokens += (row.input_tokens ?? 0) + (row.output_tokens ?? 0)
        porFuente.set(row.fuente, acc)
      }
      setUsoFuentes(Array.from(porFuente.values()).sort((a, b) => b.llamadas - a.llamadas))
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
      mensaje={error ?? t('dev.empresaNoEncontrada')}
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
          {t('dev.volverEmpresas')}
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
                {t('dev.creada')} {formatFecha(empresa.created_at)}
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
          label={t('dev.empleados')}
          value={totalEmpleados}
          icon={<Users className="w-4 h-4 text-teal-400" />}
          accent="bg-[#0D9488]/15 border border-[#0D9488]/20"
        />
        <MetricCard
          label={t('dev.admins')}
          value={totalAdmins}
          icon={<ShieldCheck className="w-4 h-4 text-indigo-400" />}
          accent="bg-[#3B4FD8]/15 border border-[#3B4FD8]/20"
        />
        <MetricCard
          label={t('dev.mensajesIA')}
          value={mensajesCount}
          icon={<MessageSquare className="w-4 h-4 text-[#38BDF8]" />}
          accent="bg-[#0EA5E9]/12 border border-[#0EA5E9]/20"
        />
        <MetricCard
          label={t('dev.progresoPromedio')}
          value={`${progresoPromedio}%`}
          icon={<TrendingUp className="w-4 h-4 text-amber-400" />}
          accent="bg-amber-500/12 border border-amber-500/20"
        />
      </motion.div>

      {/* ── Consumo IA ── */}
      <motion.div variants={cardVariants} className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white/70">
          <Bot className="w-4 h-4 text-[#0D9488]" />
          {t('dev.consumoIA')}
        </h2>

        {usoMensual.length === 0 ? (
          <div className="glass-card rounded-xl py-10 flex flex-col items-center gap-2">
            <Bot className="w-7 h-7 text-white/10" />
            <p className="text-sm text-white/35">{t('dev.sinConsumoIA')}</p>
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-white/30 border-b border-white/[0.06]">
                  <th className="text-left font-medium px-4 py-2.5">{t('dev.mes')}</th>
                  <th className="text-right font-medium px-4 py-2.5">{t('dev.consultas')}</th>
                  <th className="text-right font-medium px-4 py-2.5">Input tokens</th>
                  <th className="text-right font-medium px-4 py-2.5">Output tokens</th>
                  <th className="text-right font-medium px-4 py-2.5">Cache read</th>
                </tr>
              </thead>
              <tbody>
                {usoMensual.map(fila => (
                  <tr key={fila.mes} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-2.5 text-white/70 capitalize">{formatMes(fila.mes)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-white/80">{formatNum(fila.consultas)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-white/50">{formatNum(fila.input_tokens)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-white/50">{formatNum(fila.output_tokens)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-white/35">{formatNum(fila.cache_read_tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Desglose por fuente del mes actual */}
        {usoFuentes.length > 0 && (
          <div className="glass-card rounded-xl p-4 space-y-2.5">
            <p className="text-[11px] text-white/30 font-medium">{t('dev.desgloseFuente')}</p>
            <div className="space-y-1.5">
              {usoFuentes.map(f => (
                <div key={f.fuente} className="flex items-center justify-between gap-3 text-xs">
                  <Badge variant="info">{f.fuente}</Badge>
                  <div className="flex items-center gap-4 font-mono">
                    <span className="text-white/60">{formatNum(f.llamadas)} {t('dev.llamadas')}</span>
                    <span className="text-white/35 w-28 text-right">{formatNum(f.tokens)} tokens</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Tabla de usuarios ── */}
      <motion.div variants={cardVariants} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/70">
            {t('dev.usuariosTitulo')} <span className="text-white/30 font-normal">({usuarios.length})</span>
          </h2>
          {/* Leyenda columnas */}
          <div className="hidden md:flex items-center gap-6 text-[11px] text-white/25 pr-8">
            <span className="w-16 text-center">{t('dev.dias')}</span>
            <span className="w-28 text-center">{t('dev.progreso')}</span>
          </div>
        </div>

        {usuarios.length === 0 ? (
          <div className="glass-card rounded-xl py-14 flex flex-col items-center gap-3">
            <Users className="w-8 h-8 text-white/10" />
            <p className="text-sm text-white/35">{t('dev.sinUsuariosEmpresa')}</p>
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
