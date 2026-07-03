'use client'

// Client Component de la vista de reportes admin (Kanban por franja).
// Recibe los datos iniciales por props (cargados server-side en page.tsx)
// e inicializa el estado con ellos — sin useEffect de carga inicial.
// El retry re-ejecuta cargarReportesAdmin client-side con createClient().

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Users, Clock, CheckCircle2, AlertTriangle, MessageSquare, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { ErrorState } from '@/components/shared/ErrorState'
import { useLanguage } from '@/components/LanguageProvider'
import { cargarReportesAdmin, datosReportesVacios } from '@/lib/reportesAdmin'
import type { EmpleadoReporte, DatosReportesAdmin, FranjaKey } from '@/lib/reportesAdmin'

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

// ─────────────────────────────────────────────
// Empty state de una franja
// ─────────────────────────────────────────────

function EmptyFranja({ label }: { label: string }) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <Users className="w-7 h-7 text-white/10" />
      <p className="text-xs text-white/25 text-center">
        {t('adminRep.emptyFranja1') + label + t('adminRep.emptyFranja2')}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────
// Badge de estado del empleado
// ─────────────────────────────────────────────

function BadgeEstado({ emp }: { emp: EmpleadoReporte }) {
  const { t } = useLanguage()
  // Para graduados: lógica propia
  if (emp.franja === 'graduados') {
    return emp.progreso >= 90
      ? <Badge variant="success">{t('adminRep.completado')}</Badge>
      : <Badge variant="warning">{t('adminRep.pendiente')}</Badge>
  }

  // Para el resto: estancado > en meta > en progreso
  if (emp.estancado) {
    return <Badge variant="error">{t('adminRep.estancado')}</Badge>
  }
  if (emp.enMeta) {
    return <Badge variant="success">{t('adminRep.enMeta')}</Badge>
  }
  return <Badge variant="warning">{t('adminRep.enProgreso')}</Badge>
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
  const { t } = useLanguage()
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
          <div className="w-9 h-9 rounded-full flex-shrink-0 bg-[#0EA5E9]/20 border border-[#0EA5E9]/20
            flex items-center justify-center overflow-hidden">
            {emp.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={emp.foto_url} alt={emp.nombre} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[#7DD3FC] text-xs font-semibold">{initials}</span>
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
            <span className="text-white/40">{t('adminRep.progreso')}</span>
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
            {t('adminRep.metaCard1') + emp.progresoEsperado + t('adminRep.metaCard2')}
          </p>
        </div>

        {/* Footer: día + badge de estado */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-white/35 font-mono">
            {t('adminRep.dia')} {emp.diasOnboarding}
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
  label,
  meta,
  empleados,
  onNavigate,
  iconColor,
}: FranjaColumnaProps) {
  const { t } = useLanguage()
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
            {empleados.length} {empleados.length !== 1 ? t('adminRep.empleados') : t('adminRep.empleado')}
            {' · '}{t('adminRep.metaWord')} {meta}%
          </p>
        </div>

        {/* Resumen rápido */}
        {empleados.length > 0 && (
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {enMeta > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-teal-400">
                <CheckCircle2 className="w-3 h-3" />
                {enMeta} {t('adminRep.enMetaLower')}
              </span>
            )}
            {estancados > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-red-400">
                <AlertTriangle className="w-3 h-3" />
                {estancados} {estancados !== 1 ? t('adminRep.estancadosLower') : t('adminRep.estancadoLower')}
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
// Componente principal
// ─────────────────────────────────────────────

interface ReportesClientProps {
  empresaId: string | null
  datosIniciales: DatosReportesAdmin
  errorInicial: boolean
}

export function ReportesClient({ empresaId, datosIniciales, errorInicial }: ReportesClientProps) {
  const router = useRouter()
  const { t } = useLanguage()

  const [error, setError] = useState(errorInicial)
  const [empleados, setEmpleados] = useState<EmpleadoReporte[]>(datosIniciales.empleados)

  // ── Retry client-side ──
  const cargarDatos = useCallback(async () => {
    setError(false)
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

      const eId: string = empresaId ?? perfil.empresa_id
      const datos = await cargarReportesAdmin(supabase, eId)
      setEmpleados(datos.empleados)
    } catch (err) {
      console.error('[Reportes] Error al cargar datos:', err)
      setError(true)
    }
  }, [router, empresaId])

  // ── Datos derivados por franja ──
  const por30d       = empleados.filter(e => e.franja === '30d')
  const por60d       = empleados.filter(e => e.franja === '60d')
  const por90d       = empleados.filter(e => e.franja === '90d')
  const porGraduados = empleados.filter(e => e.franja === 'graduados')

  // Métricas del header
  const totalEmpleados = empleados.length
  const enMetaTotal    = empleados.filter(e => e.enMeta && !e.estancado).length
  const estancadosTotal = empleados.filter(e => e.estancado).length

  if (error) {
    return <ErrorState onRetry={cargarDatos} />
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
          <h1 className="text-lg font-semibold text-white/90">{t('adminRep.titulo')}</h1>
          <p className="text-sm text-white/40 mt-0.5">{t('adminRep.subtitulo')}</p>
        </div>

        {/* Métricas rápidas en el header */}
        {totalEmpleados > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Users className="w-3.5 h-3.5" />
              <span>{totalEmpleados} {t('adminRep.total')}</span>
            </div>
            {enMetaTotal > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-teal-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{enMetaTotal} {t('adminRep.enMetaLower')}</span>
              </div>
            )}
            {estancadosTotal > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{estancadosTotal} {estancadosTotal !== 1 ? t('adminRep.estancadosLower') : t('adminRep.estancadoLower')}</span>
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
            label={t('adminRep.franja.30d')}
            meta={25}
            empleados={por30d}
            onNavigate={id => router.push(`/admin/empleados/${id}`)}
            iconColor="text-teal-400"
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <FranjaColumna
            franjaKey="60d"
            label={t('adminRep.franja.60d')}
            meta={60}
            empleados={por60d}
            onNavigate={id => router.push(`/admin/empleados/${id}`)}
            iconColor="text-amber-400"
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <FranjaColumna
            franjaKey="90d"
            label={t('adminRep.franja.90d')}
            meta={90}
            empleados={por90d}
            onNavigate={id => router.push(`/admin/empleados/${id}`)}
            iconColor="text-[#38BDF8]"
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
                <h2 className="text-sm font-semibold text-white/80">{t('adminRep.graduados')}</h2>
                <span className="text-xs text-white/35">· {t('adminRep.mas90')}</span>
              </div>
              <span className="text-xs text-white/35">
                {porGraduados.length} {porGraduados.length !== 1 ? t('adminRep.empleados') : t('adminRep.empleado')}
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
            <div className="w-10 h-10 rounded-xl bg-[#0EA5E9]/15 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-[#38BDF8]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/80">{t('adminRep.encuestas')}</p>
              <p className="text-xs text-white/35 mt-0.5">
                {t('adminRep.encuestasDesc')}
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
            <p className="text-sm font-medium text-white/40">{t('adminRep.emptyGlobal')}</p>
            <p className="text-xs text-white/25 mt-1">
              {t('adminRep.emptyGlobalDesc')}
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
