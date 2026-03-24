'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Mail, ExternalLink, Copy, Check,
  MessageSquare, FileText, Code, Globe,
  Calendar, User, BookOpen, Briefcase, KeyRound, ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ErrorState } from '@/components/shared/ErrorState'
import { createClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn, getInitials, formatFecha, diasDesde } from '@/lib/utils'
import { ContactoCard } from '@/components/empleado/ContactoCard'
import { useLanguage } from '@/components/LanguageProvider'
import ProductTour from '@/components/empleado/ProductTour'
import type { Usuario, MiembroEquipo, Acceso } from '@/types'

// Total de bloques requeridos para completar M2 — Cultura
const CULTURA_TOTAL = 5

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface EstadoModulos {
  M1: boolean
  M2: boolean
  M3: boolean
  M4: boolean
}

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const blockVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 26 },
  },
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

// getInitials, formatFecha y diasDesde importados desde @/lib/utils

function modalidadLabel(m: string, t: (key: string) => string): string {
  if (m === 'presencial') return t('perfil.modalidad.presencial')
  if (m === 'remoto') return t('perfil.modalidad.remoto')
  if (m === 'hibrido') return t('perfil.modalidad.hibrido')
  return m
}

function modalidadVariant(m: string): 'info' | 'default' | 'success' {
  if (m === 'presencial') return 'info'
  if (m === 'hibrido') return 'default'
  if (m === 'remoto') return 'success'
  return 'default'
}

function relacionLabel(r: MiembroEquipo['relacion'], t: (key: string) => string): string {
  if (r === 'manager') return t('perfil.relacion.manager')
  if (r === 'buddy') return t('perfil.relacion.buddy')
  return t('perfil.relacion.companero')
}

function relacionBadgeVariant(r: MiembroEquipo['relacion']): 'default' | 'success' | 'info' {
  if (r === 'manager') return 'default'
  if (r === 'buddy') return 'success'
  return 'info'
}

// diasDesde importado desde @/lib/utils

// ─────────────────────────────────────────────
// Ícono por herramienta de acceso
// ─────────────────────────────────────────────

function ToolIcon({ name, className }: { name: string; className?: string }) {
  const lower = name.toLowerCase()
  if (lower.includes('slack')) return <MessageSquare className={cn('w-4 h-4', className)} />
  if (lower.includes('gmail') || lower.includes('mail')) return <Mail className={cn('w-4 h-4', className)} />
  if (lower.includes('notion')) return <FileText className={cn('w-4 h-4', className)} />
  if (lower.includes('github') || lower.includes('git')) return <Code className={cn('w-4 h-4', className)} />
  return <Globe className={cn('w-4 h-4', className)} />
}

// ─────────────────────────────────────────────
// Info de módulos para "Mi onboarding"
// ─────────────────────────────────────────────

const MODULO_INFO = [
  { key: 'M1' as const, label: 'Perfil',     Icon: User           },
  { key: 'M2' as const, label: 'Cultura',    Icon: BookOpen       },
  { key: 'M3' as const, label: 'Rol',        Icon: Briefcase      },
  { key: 'M4' as const, label: 'Asistente',  Icon: MessageSquare  },
]

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function SkeletonLine({ width = 'w-full', className }: { width?: string; className?: string }) {
  return <div className={cn('shimmer rounded-md h-4', width, className)} />
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero skeleton */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="shimmer h-20" />
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-7">
            <div className="shimmer rounded-full w-14 h-14 flex-shrink-0" style={{ border: '4px solid #0a1628' }} />
            <SkeletonLine width="w-28" className="h-5 rounded-full mb-1" />
          </div>
          <div className="mt-3 space-y-2">
            <SkeletonLine width="w-40" className="h-5" />
            <SkeletonLine width="w-28" />
            <div className="flex flex-wrap gap-4 mt-3">
              <SkeletonLine width="w-32" />
              <SkeletonLine width="w-44" />
              <SkeletonLine width="w-20" className="h-5 rounded-md" />
            </div>
          </div>
          <div className="h-px bg-white/[0.06] my-4" />
          <SkeletonLine width="w-full" className="h-10" />
        </div>
      </div>

      {/* Mi onboarding skeleton */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonLine width="w-28" className="h-4" />
          <SkeletonLine width="w-20" className="h-4" />
        </div>
        <SkeletonLine width="w-full" className="h-1.5 rounded-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="shimmer rounded-xl h-20" />
          ))}
        </div>
      </div>

      {/* Equipo skeleton */}
      <div className="glass-card rounded-xl p-5 space-y-3">
        <SkeletonLine width="w-24" className="h-4 mb-4" />
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="shimmer rounded-full w-10 h-10 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonLine width="w-32" />
              <SkeletonLine width="w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Avatar hero — sobresale del banner (w-14 h-14)
// ─────────────────────────────────────────────

function HeroAvatar({
  src,
  nombre,
  onUpload,
}: {
  src?: string
  nombre: string
  onUpload: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const initials = getInitials(nombre)

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="relative group cursor-pointer flex-shrink-0"
      onClick={() => inputRef.current?.click()}
    >
      <div
        className="w-14 h-14 rounded-full overflow-hidden bg-[#0EA5E9]/10 flex items-center justify-center"
        style={{ border: '4px solid #0a1628' }}
      >
        {src ? (
          <img src={src} alt={nombre} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[#7DD3FC] text-xl font-semibold">{initials}</span>
        )}
      </div>

      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
        <Camera className="w-4 h-4 text-white" />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
          e.target.value = ''
        }}
      />
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Avatar pequeño (40px) para el equipo
// ─────────────────────────────────────────────

function SmallAvatar({ src, nombre }: { src?: string; nombre: string }) {
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-[#0EA5E9]/20 border border-[#0EA5E9]/30 flex items-center justify-center">
      {src ? (
        <img src={src} alt={nombre} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[#7DD3FC] text-xs font-semibold">{getInitials(nombre)}</span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function PerfilPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([])
  const [accesos, setAccesos] = useState<Acceso[]>([])

  const [herramientaContacto, setHerramientaContacto] = useState<string>('email')

  const [editandoBio, setEditandoBio] = useState(false)
  const [bio, setBio] = useState('')
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)

  // Progreso de los 4 módulos — M1 siempre completo
  const [modulosProgreso, setModulosProgreso] = useState<EstadoModulos>({
    M1: true,
    M2: false,
    M3: false,
    M4: false,
  })

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setHasError(false)
    try {
      const supabase = createClient()

      // 1. Usuario autenticado
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      // 2, 3, 5 en paralelo
      const [perfilRes, relacionesRes, accesosRes] = await Promise.all([
        supabase
          .from('usuarios')
          .select('id, nombre, puesto, area, email, modalidad, fecha_ingreso, bio, foto_url, empresa_id, manager_id, buddy_id, contacto_it_nombre, contacto_it_email, contacto_rrhh_nombre, contacto_rrhh_email, password_corporativo, password_bitlocker')
          .eq('id', user.id)
          .single(),
        supabase
          .from('equipo_relaciones')
          .select('relacion, miembro_id')
          .eq('usuario_id', user.id),
        supabase
          .from('accesos')
          .select('*')
          .eq('usuario_id', user.id)
          .order('herramienta'),
      ])

      if (perfilRes.data) {
        setPerfil(perfilRes.data as Usuario)
        setBio(perfilRes.data.bio ?? '')

        // Herramienta de contacto de la empresa (primera del array)
        const empresaRes = await supabase
          .from('empresas')
          .select('herramientas_contacto')
          .eq('id', perfilRes.data.empresa_id)
          .single()
        const herramientas = empresaRes.data?.herramientas_contacto
        if (herramientas && herramientas.length > 0) {
          setHerramientaContacto(herramientas[0] as string)
        }
      }

      if (accesosRes.data) {
        setAccesos(accesosRes.data as Acceso[])
      }

      // 4. Miembros del equipo (depende de relaciones)
      if (relacionesRes.data && relacionesRes.data.length > 0) {
        const miembroIds = relacionesRes.data.map(r => r.miembro_id)

        const miembrosRes = await supabase
          .from('usuarios')
          .select('id, nombre, email, puesto, foto_url')
          .in('id', miembroIds)

        if (miembrosRes.data) {
          const miembros: MiembroEquipo[] = relacionesRes.data
            .map(rel => {
              const u = miembrosRes.data.find(m => m.id === rel.miembro_id)
              return {
                id: rel.miembro_id,
                nombre: u?.nombre ?? '',
                email: u?.email ?? '',
                puesto: u?.puesto ?? undefined,
                foto_url: u?.foto_url ?? undefined,
                relacion: rel.relacion as MiembroEquipo['relacion'],
              }
            })
            .filter(m => m.nombre)

          // Orden: manager → buddy → compañero
          const order: Record<MiembroEquipo['relacion'], number> = {
            manager: 0,
            buddy: 1,
            companero: 2,
          }
          miembros.sort((a, b) => order[a.relacion] - order[b.relacion])
          setEquipo(miembros)
        }
      }

      // 6. Progreso de módulos (no bloqueante — tabla puede no existir)
      try {
        const { data: rows } = await supabase
          .from('progreso_modulos')
          .select('modulo, bloque, completado')
          .eq('usuario_id', user.id)

        const progresoRows = rows ?? []
        const culturaCompletados = progresoRows.filter(
          r => r.modulo === 'cultura' && r.completado
        ).length
        const m2 = culturaCompletados >= CULTURA_TOTAL
        const m3 = progresoRows.some(r => r.modulo === 'rol' && r.completado)

        // M4: al menos una conversación de IA
        let m4 = false
        try {
          const { count } = await supabase
            .from('conversaciones_ia')
            .select('*', { count: 'exact', head: true })
            .eq('usuario_id', user.id)
          m4 = (count ?? 0) > 0
        } catch {
          // tabla puede no existir aún
        }

        setModulosProgreso({ M1: true, M2: m2, M3: m3, M4: m4 })
      } catch (err) {
        console.warn('[Perfil] progreso_modulos:', err)
      }
    } catch (err) {
      console.error('Error cargando perfil:', err)
      toast.error('Error al cargar el perfil')
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // Guardar bio al perder foco
  const handleBioBlur = async () => {
    setEditandoBio(false)
    if (!perfil) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('usuarios')
        .update({ bio })
        .eq('id', perfil.id)

      if (error) throw new Error(error.message ?? 'Error al guardar')

      setSavedFeedback(true)
      setTimeout(() => setSavedFeedback(false), 2000)
    } catch {
      toast.error('No se pudo guardar')
    }
  }

  // Upload de avatar a Storage
  const handleAvatarUpload = async (file: File) => {
    if (!perfil) return

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${perfil.id}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

      if (uploadError) throw new Error(uploadError.message ?? 'Error al subir imagen')

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path)

      await supabase
        .from('usuarios')
        .update({ foto_url: publicUrl })
        .eq('id', perfil.id)

      setPerfil(prev => (prev ? { ...prev, foto_url: publicUrl } : prev))
      toast.success('Foto actualizada')
    } catch {
      toast.error('No se pudo subir la foto')
    }
  }

  // Copiar email con feedback inline
  const handleCopyEmail = async () => {
    if (!perfil) return
    try {
      await navigator.clipboard.writeText(perfil.email)
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
      toast.success('Email copiado')
    } catch {
      toast.error('No se pudo copiar el email')
    }
  }

  // Contactos clave derivados del equipo
  const manager = equipo.find(m => m.relacion === 'manager')
  const buddy   = equipo.find(m => m.relacion === 'buddy')

  // Módulo activo: el primero sin completar
  const moduloActivo = MODULO_INFO.find(m => !modulosProgreso[m.key])?.key ?? null

  // Métricas de progreso global
  const modulosCompletados = Object.values(modulosProgreso).filter(Boolean).length
  const progresoTotal      = Math.round((modulosCompletados / 4) * 100)

  // ── Render: loading ──
  if (loading) {
    return (
      <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="shimmer rounded-md h-8 w-40 mb-6" />
          <ProfileSkeleton />
        </div>
      </div>
    )
  }

  // ── Render: error ──
  if (hasError) {
    return (
      <div className="min-h-dvh gradient-bg flex items-center justify-center p-4">
        <ErrorState
          mensaje="No se pudo cargar tu perfil."
          onRetry={cargarDatos}
        />
      </div>
    )
  }

  // ── Render: sin perfil ──
  if (!perfil) {
    return (
      <div className="min-h-dvh gradient-bg flex items-center justify-center">
        <p className="text-white/50 text-sm">No se encontró tu perfil.</p>
      </div>
    )
  }

  // ── Render: principal ──
  return (
    <div className="min-h-dvh gradient-bg p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">

        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="text-2xl font-semibold text-white mb-6"
        >
          Mi perfil
        </motion.h1>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >

          {/* ── Bloque A: Hero Card ── */}
          <motion.section id="tour-hero-card" variants={blockVariants}>
            <Card padding="none" className="overflow-hidden">

              {/* Banner decorativo */}
              <div
                className="relative h-20 overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #1a2d5a 0%, #162440 50%, #0f1e3d 100%)',
                }}
              >
                {/* Overlay radial indigo en esquina izquierda */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(ellipse at -10% 50%, rgba(99,102,241,0.25) 0%, transparent 60%)',
                  }}
                />
                {/* Pulso sutil en esquina derecha */}
                <div
                  className="absolute inset-0 pointer-events-none animate-pulse opacity-50"
                  style={{
                    background:
                      'radial-gradient(ellipse at 110% 50%, rgba(14,165,233,0.15) 0%, transparent 55%)',
                  }}
                />
              </div>

              {/* Body */}
              <div className="px-6 pb-6">

                {/* Fila: avatar (sobresale del banner) + badge día */}
                <div className="flex items-end justify-between -mt-7">
                  <HeroAvatar
                    src={perfil.foto_url}
                    nombre={perfil.nombre}
                    onUpload={handleAvatarUpload}
                  />
                  {perfil.fecha_ingreso && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.06] mb-1"
                      style={{ background: 'rgba(10,22,40,0.8)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                      <span className="text-[11px] text-white/50">
                        Día {diasDesde(perfil.fecha_ingreso) ?? 1} de onboarding
                      </span>
                    </div>
                  )}
                </div>

                {/* Nombre y puesto */}
                <div className="mt-3">
                  <h2 className="text-xl font-semibold text-white/90 leading-tight">
                    {perfil.nombre}
                  </h2>
                  {(perfil.puesto || perfil.area) && (
                    <p className="text-sm text-white/45 mt-0.5">
                      {[perfil.puesto, perfil.area].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                {/* Meta row: fecha · email copiable · modalidad */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
                  {perfil.fecha_ingreso && (
                    <span className="flex items-center gap-1.5 text-xs text-white/45">
                      <Calendar className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                      {formatFecha(perfil.fecha_ingreso)}
                    </span>
                  )}
                  <button
                    onClick={handleCopyEmail}
                    className="flex items-center gap-1.5 text-xs text-white/45 hover:text-[#7DD3FC] transition-colors duration-150 group"
                    title="Copiar email"
                  >
                    <Mail className="w-3.5 h-3.5 text-white/30 group-hover:text-[#0EA5E9] transition-colors flex-shrink-0" />
                    <span className="font-mono">{perfil.email}</span>
                    <span className="ml-0.5">
                      {emailCopied ? (
                        <Check className="w-3 h-3 text-teal-400" />
                      ) : (
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                      )}
                    </span>
                  </button>
                  {perfil.modalidad && (
                    <Badge variant={modalidadVariant(perfil.modalidad)}>
                      {modalidadLabel(perfil.modalidad, t)}
                    </Badge>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-white/[0.06] my-4" />

                {/* Sobre mí — editable inline (lógica sin cambios) */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-medium text-white/35 uppercase tracking-widest">
                      Sobre mí
                    </span>
                    <AnimatePresence>
                      {savedFeedback && (
                        <motion.span
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-[11px] text-teal-400 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> guardado
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  {editandoBio ? (
                    <textarea
                      autoFocus
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      onBlur={handleBioBlur}
                      rows={3}
                      placeholder="Contá algo sobre vos..."
                      className={cn(
                        'w-full text-sm text-white/80 bg-surface-800/60 rounded-lg',
                        'border border-white/10 focus:border-[#0EA5E9]/40',
                        'p-2.5 resize-none outline-none',
                        'placeholder:text-white/25 transition-colors duration-150',
                      )}
                    />
                  ) : (
                    <p
                      onClick={() => setEditandoBio(true)}
                      className={cn(
                        'text-sm cursor-text rounded-lg p-2 -ml-2',
                        'hover:bg-white/[0.03] transition-colors duration-150',
                        bio ? 'text-white/70' : 'text-white/25 italic',
                      )}
                    >
                      {bio || 'Contá algo sobre vos...'}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </motion.section>

          {/* ── Bloque B: Mi onboarding ── */}
          <motion.section id="tour-onboarding-tracker" variants={blockVariants}>
            <Card>
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest">
                  Mi onboarding
                </h2>
                <span className="text-xs text-white/40 font-mono tabular-nums">
                  {modulosCompletados} / 4 módulos
                </span>
              </div>

              {/* Barra de progreso animada */}
              <ProgressBar value={progresoTotal} showPercentage={false} />

              {/* Grid de 4 módulos — 2 cols en mobile, 4 en desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {MODULO_INFO.map(({ key, label, Icon }) => {
                  const completado = modulosProgreso[key]
                  const activo     = moduloActivo === key

                  const iconBg = completado
                    ? 'bg-teal-500/15'
                    : activo
                    ? 'bg-[#0EA5E9]/20'
                    : 'bg-white/[0.03]'

                  const iconText = completado
                    ? 'text-teal-400'
                    : activo
                    ? 'text-[#38BDF8]'
                    : 'text-white/20'

                  const estadoLabel = completado
                    ? 'Completado'
                    : activo
                    ? 'En curso'
                    : 'Bloqueado'

                  const estadoColor = completado
                    ? 'text-teal-400'
                    : activo
                    ? 'text-[#38BDF8]'
                    : 'text-white/20'

                  return (
                    <motion.div
                      key={key}
                      variants={itemVariants}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                    >
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', iconBg)}>
                        <Icon className={cn('w-4 h-4', iconText)} />
                      </div>
                      <span className="text-[11px] font-medium text-white/60 text-center leading-tight">
                        {label}
                      </span>
                      <span className={cn('text-[10px] text-center leading-tight', estadoColor)}>
                        {estadoLabel}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </Card>
          </motion.section>

          {/* ── Bloque C: Mi equipo ── */}
          {equipo.length > 0 && (
            <motion.section variants={blockVariants}>
              <Card>
                <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">
                  Mi equipo
                </h2>

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="space-y-3"
                >
                  {equipo.map(miembro => (
                    <motion.div
                      key={miembro.id}
                      variants={itemVariants}
                      className="flex items-center gap-3"
                    >
                      <SmallAvatar src={miembro.foto_url} nombre={miembro.nombre} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white/90 truncate">
                            {miembro.nombre}
                          </span>
                          <Badge variant={relacionBadgeVariant(miembro.relacion)}>
                            {relacionLabel(miembro.relacion, t)}
                          </Badge>
                        </div>
                        {miembro.puesto && (
                          <p className="text-xs text-white/40 truncate">{miembro.puesto}</p>
                        )}
                      </div>

                      <a
                        href={`mailto:${miembro.email}`}
                        className="text-white/25 hover:text-[#38BDF8] transition-colors duration-150 p-1.5 rounded flex-shrink-0"
                        title={`Escribir a ${miembro.nombre}`}
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                    </motion.div>
                  ))}
                </motion.div>
              </Card>
            </motion.section>
          )}

          {/* ── Bloque D: Contactos clave ── */}
          <motion.section variants={blockVariants}>
            <Card>
              <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">
                Contactos clave
              </h2>

              {/* 2 cols en mobile, 4 en desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ContactoCard
                  tipo="manager"
                  nombre={manager?.nombre}
                  email={manager?.email}
                  herramienta={herramientaContacto}
                />
                <ContactoCard
                  tipo="buddy"
                  nombre={buddy?.nombre}
                  email={buddy?.email}
                  herramienta={herramientaContacto}
                />
                <ContactoCard
                  tipo="it"
                  nombre={perfil.contacto_it_nombre}
                  email={perfil.contacto_it_email}
                  herramienta={herramientaContacto}
                />
                <ContactoCard
                  tipo="rrhh"
                  nombre={perfil.contacto_rrhh_nombre}
                  email={perfil.contacto_rrhh_email}
                  herramienta={herramientaContacto}
                />
              </div>
            </Card>
          </motion.section>

          {/* ── Bloque E: Mis accesos ── */}
          <motion.section variants={blockVariants}>
            <Card>
              <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">
                Mis accesos
              </h2>

              {accesos.length === 0 ? (
                <p className="text-sm text-white/30 italic py-2">
                  Tus accesos aparecerán aquí cuando el admin los configure.
                </p>
              ) : (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="space-y-0"
                >
                  {accesos.map(acceso => (
                    <motion.div
                      key={acceso.id}
                      variants={itemVariants}
                      className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0"
                    >
                      <div className="w-7 h-7 rounded-md bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
                        <ToolIcon name={acceso.herramienta} className="text-white/50" />
                      </div>

                      <span className="flex-1 text-sm text-white/70 truncate">
                        {acceso.herramienta}
                      </span>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {acceso.estado === 'activo' && (
                          <>
                            <Badge variant="success">Activo</Badge>
                            {acceso.url && (
                              <a
                                href={acceso.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white/25 hover:text-teal-400 transition-colors duration-150"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </>
                        )}
                        {acceso.estado === 'pendiente' && (
                          <Badge variant="warning">En proceso</Badge>
                        )}
                        {acceso.estado === 'sin_acceso' && (
                          <Badge variant="error">Sin acceso</Badge>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </Card>
          </motion.section>

          {/* ── Bloque F: Credenciales ── */}
          {(perfil.password_corporativo || perfil.password_bitlocker) && (
            <motion.section variants={blockVariants}>
              <Card>
                <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">
                  Credenciales
                </h2>
                <div className="space-y-3">
                  {perfil.password_corporativo && (
                    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                      <div className="w-7 h-7 rounded-md bg-[#0EA5E9]/10 border border-[#0EA5E9]/20 flex items-center justify-center flex-shrink-0">
                        <KeyRound className="w-3.5 h-3.5 text-[#38BDF8]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white/35 mb-0.5">Contraseña corporativa</p>
                        <p className="text-sm font-mono text-white/70 truncate">{perfil.password_corporativo}</p>
                      </div>
                    </div>
                  )}
                  {perfil.password_bitlocker && (
                    <div className="flex items-center gap-3 py-2.5">
                      <div className="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white/35 mb-0.5">Clave BitLocker</p>
                        <p className="text-sm font-mono text-white/70 truncate">{perfil.password_bitlocker}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </motion.section>
          )}

        </motion.div>
      </div>

      {/* Tour de bienvenida — se activa solo la primera vez */}
      <ProductTour nombreEmpleado={perfil.nombre ?? ''} />
    </div>
  )
}
