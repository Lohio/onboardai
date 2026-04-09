'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Mail, ExternalLink, Copy, Check,
  MessageSquare, FileText, Code, Globe,
  Calendar, User, Users, BookOpen, Briefcase, Building2, KeyRound, ShieldAlert, Eye, EyeOff,
} from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { ErrorState } from '@/components/shared/ErrorState'
import { createClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn, getInitials, formatFecha, diasDesde } from '@/lib/utils'
import { ContactoCard } from '@/components/empleado/ContactoCard'
import { MiOnboardingCard, EncuestasPulsoCard } from '@/components/empleado/ProgresoPanel'
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
  { key: 'M2' as const, label: 'Rol',        Icon: Briefcase      },
  { key: 'M3' as const, label: 'Cultura',    Icon: BookOpen       },
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
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="shimmer h-20" />
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-7">
            <div className="shimmer rounded-full w-14 h-14 flex-shrink-0" style={{ border: '4px solid #ffffff' }} />
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
          <div className="h-px bg-gray-200 my-4" />
          <SkeletonLine width="w-full" className="h-10" />
        </div>
      </div>

      {/* Mi onboarding skeleton */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonLine width="w-28" className="h-4" />
          <SkeletonLine width="w-20" className="h-4" />
        </div>
        <SkeletonLine width="w-full" className="h-1.5 rounded-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="shimmer rounded-lg h-20" />
          ))}
        </div>
      </div>

      {/* Equipo skeleton */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 space-y-3">
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
        className="w-14 h-14 rounded-full overflow-hidden bg-sky-100 border border-sky-200 flex items-center justify-center"
      >
        {src ? (
          <img src={src} alt={nombre} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sky-700 text-xl font-semibold">{initials}</span>
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
    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-sky-100 border border-sky-200 flex items-center justify-center">
      {src ? (
        <img src={src} alt={nombre} className="w-full h-full object-cover" />
      ) : (
        <span className="text-sky-700 text-xs font-semibold">{getInitials(nombre)}</span>
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
  const [accesosRlsBlock, setAccesosRlsBlock] = useState(false)

  const [herramientaContacto, setHerramientaContacto] = useState<string>('email')
  const [nombreEmpresa, setNombreEmpresa] = useState<string>('')
  const [showPassCorp, setShowPassCorp] = useState(false)
  const [showPassBitlocker, setShowPassBitlocker] = useState(false)
  const [showPassAcceso, setShowPassAcceso] = useState<Record<string, boolean>>({})

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
  })
  const [encuestasPulso, setEncuestasPulso] = useState<{ dia: 7|30|60, respondida: boolean }[]>([])

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

      // 2, 3, 5 en paralelo (passwords se obtienen por endpoint separado — descifrado server-side)
      const [perfilRes, relacionesRes, accesosRes, passwordsRes] = await Promise.all([
        supabase
          .from('usuarios')
          .select('id, nombre, puesto, area, email, modalidad, fecha_ingreso, bio, foto_url, empresa_id, manager_id, buddy_id, contacto_it_nombre, contacto_it_email, contacto_rrhh_nombre, contacto_rrhh_email')
          .eq('id', user.id)
          .single(),
        supabase
          .from('equipo_relaciones')
          .select('relacion, miembro_id')
          .eq('usuario_id', user.id),
        supabase
          .from('accesos_herramientas')
          .select('*')
          .eq('usuario_id', user.id)
          .order('herramienta'),
        fetch('/api/empleado/perfil/passwords').then(r => r.ok ? r.json() : null).catch(() => null),
      ])

      if (perfilRes.data) {
        // Mezclar passwords descifradas (server-side) con el perfil
        const passwords = passwordsRes as { password_corporativo: string | null; password_bitlocker: string | null } | null
        setPerfil({ ...perfilRes.data, ...passwords } as Usuario)
        setBio(perfilRes.data.bio ?? '')

        // Herramienta de contacto de la empresa (primera del array)
        const empresaRes = await supabase
          .from('empresas')
          .select('nombre, herramientas_contacto')
          .eq('id', perfilRes.data.empresa_id)
          .single()
        const herramientas = empresaRes.data?.herramientas_contacto
        if (herramientas && herramientas.length > 0) {
          setHerramientaContacto(herramientas[0] as string)
        }
        if (empresaRes.data?.nombre) {
          setNombreEmpresa(empresaRes.data.nombre as string)
        }
      }

      if (accesosRes.error) {
        console.warn('[Perfil] accesos_herramientas error:', accesosRes.error.code, accesosRes.error.message)
        // PGRST301 = JWT expired, 42501 = insufficient_privilege (RLS bloqueando)
        if (accesosRes.error.code === '42501' || accesosRes.error.message?.includes('permission')) {
          setAccesosRlsBlock(true)
        }
      } else {
        setAccesos((accesosRes.data ?? []) as Acceso[])
      }

      // 4. Miembros del equipo
      // Primero intentar desde equipo_relaciones; si está vacío, fallback a manager_id/buddy_id del perfil
      const ordenEquipo: Record<MiembroEquipo['relacion'], number> = { manager: 0, buddy: 1, companero: 2 }

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

          miembros.sort((a, b) => ordenEquipo[a.relacion] - ordenEquipo[b.relacion])
          setEquipo(miembros)
        }
      } else if (perfilRes.data) {
        // Fallback: resolver manager_id y buddy_id directamente desde usuarios
        const fallbackIds = [perfilRes.data.manager_id, perfilRes.data.buddy_id].filter(Boolean) as string[]
        if (fallbackIds.length > 0) {
          const { data: fallbackUsuarios } = await supabase
            .from('usuarios')
            .select('id, nombre, email, puesto, foto_url')
            .in('id', fallbackIds)

          if (fallbackUsuarios) {
            const miembros: MiembroEquipo[] = []
            if (perfilRes.data.manager_id) {
              const u = fallbackUsuarios.find(m => m.id === perfilRes.data!.manager_id)
              if (u) miembros.push({ id: u.id, nombre: u.nombre, email: u.email, puesto: u.puesto ?? undefined, foto_url: u.foto_url ?? undefined, relacion: 'manager' })
            }
            if (perfilRes.data.buddy_id) {
              const u = fallbackUsuarios.find(m => m.id === perfilRes.data!.buddy_id)
              if (u) miembros.push({ id: u.id, nombre: u.nombre, email: u.email, puesto: u.puesto ?? undefined, foto_url: u.foto_url ?? undefined, relacion: 'buddy' })
            }
            miembros.sort((a, b) => ordenEquipo[a.relacion] - ordenEquipo[b.relacion])
            setEquipo(miembros)
          }
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

        setModulosProgreso({ M1: true, M2: m2, M3: m3 })
      } catch (err) {
        console.warn('[Perfil] progreso_modulos:', err)
      }

      // 7. Encuestas de pulso (no bloqueante)
      const { data: encuestasData } = await supabase
        .from('encuestas_pulso')
        .select('dia_onboarding, respondida')
        .eq('usuario_id', user.id)

      setEncuestasPulso(
        (encuestasData ?? []).map(e => ({
          dia: e.dia_onboarding as 7 | 30 | 60,
          respondida: e.respondida ?? false,
        }))
      )
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
  const progresoTotal      = Math.round((modulosCompletados / 3) * 100)
  const diasOnboarding     = diasDesde(perfil?.fecha_ingreso) ?? 1

  // ── Render: loading ──
  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8">
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
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-4">
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
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No se encontró tu perfil.</p>
      </div>
    )
  }

  // ── Render: principal ──
  return (
    <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* ── Page header M1 ── */}
        <div className="mb-6">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-1">Módulo 1</p>
          <h1 className="text-xl font-bold text-gray-900 leading-tight flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            Mi perfil
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tus accesos, credenciales e información de equipo
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >

          {/* ── Fila principal: 2 columnas ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Columna izquierda: Hero → Accesos+Credenciales → Sobre mí */}
            <div className="space-y-4">

              {/* Bloque A: Profile hero (compacto) */}
              <motion.section id="tour-hero-card" variants={blockVariants}>
                {/* Hero card */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 flex items-start gap-4">
                  <HeroAvatar
                    src={perfil.foto_url}
                    nombre={perfil.nombre}
                    onUpload={handleAvatarUpload}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-gray-900 leading-tight truncate">
                          {perfil.nombre}
                        </h2>
                        {(perfil.puesto || perfil.area) && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {[perfil.puesto, perfil.area].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {nombreEmpresa && (
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 truncate">
                            <Building2 className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{nombreEmpresa}</span>
                          </p>
                        )}
                      </div>
                      {perfil.fecha_ingreso && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                          <span className="text-[11px] text-gray-500 whitespace-nowrap">
                            Día {diasDesde(perfil.fecha_ingreso) ?? 1}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                      {perfil.modalidad && (
                        <Badge variant={modalidadVariant(perfil.modalidad)}>
                          {modalidadLabel(perfil.modalidad, t)}
                        </Badge>
                      )}
                      <button
                        onClick={handleCopyEmail}
                        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-sky-600 transition-colors group"
                        title="Copiar email"
                      >
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="font-mono truncate max-w-[160px]">{perfil.email}</span>
                        {emailCopied
                          ? <Check className="w-2.5 h-2.5 text-teal-600 flex-shrink-0" />
                          : <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        }
                      </button>
                    </div>
                  </div>
                </div>

              </motion.section>

              {/* Mis accesos */}
              <motion.section variants={blockVariants}>
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
                  <h2 className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-4">
                    Mis accesos
                  </h2>

                  {accesosRlsBlock ? (
                    <p className="text-sm text-amber-700 italic py-2">
                      Sin permisos para ver accesos. Pedile al admin que configure los permisos de la tabla.
                    </p>
                  ) : accesos.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-2">
                      Tus accesos aparecerán aquí cuando el admin los configure.
                    </p>
                  ) : (
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="space-y-2"
                    >
                      {accesos.map(acceso => (
                        <motion.div
                          key={acceso.id}
                          variants={itemVariants}
                          className="rounded-lg bg-gray-50 border border-gray-200 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-md bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <ToolIcon name={acceso.herramienta} className="text-gray-500" />
                            </div>

                            <span className="flex-1 text-sm font-semibold text-gray-900 truncate">
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
                                      className="text-gray-400 hover:text-sky-600 transition-colors duration-150"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </>
                              )}
                              {acceso.estado === 'pendiente' && <Badge variant="warning">En proceso</Badge>}
                              {acceso.estado === 'sin_acceso' && <Badge variant="error">Sin acceso</Badge>}
                            </div>
                          </div>

                          {(acceso.usuario_acceso || acceso.password_acceso) && (
                            <div className="mt-2 ml-10 space-y-1">
                              {acceso.usuario_acceso && (
                                <p className="text-xs text-gray-500">
                                  <span className="text-gray-400">Usuario: </span>
                                  {acceso.usuario_acceso}
                                </p>
                              )}
                              {acceso.password_acceso && (
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-gray-500">
                                    <span className="text-gray-400">Pass: </span>
                                    <span className="font-mono">
                                      {showPassAcceso[acceso.id] ? acceso.password_acceso : '••••••••'}
                                    </span>
                                  </p>
                                  <button
                                    onClick={() => setShowPassAcceso(prev => ({ ...prev, [acceso.id]: !prev[acceso.id] }))}
                                    className="text-gray-400 hover:text-gray-700 transition-colors"
                                  >
                                    {showPassAcceso[acceso.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.section>

              {/* Bloque F: Credenciales */}
              {(perfil.password_corporativo || perfil.password_bitlocker) && (
                <motion.section variants={blockVariants}>
                  <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
                    <h2 className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-4">
                      Credenciales
                    </h2>
                    <div className="space-y-3">
                      {perfil.password_corporativo && (
                        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 flex items-center gap-3">
                          <div className="w-7 h-7 rounded-md bg-sky-100 border border-sky-200 flex items-center justify-center flex-shrink-0">
                            <KeyRound className="w-3.5 h-3.5 text-sky-700" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-gray-500 mb-0.5">Contraseña corporativa</p>
                            <p className="text-sm font-mono text-gray-900 truncate">
                              {showPassCorp ? perfil.password_corporativo : '••••••••••••'}
                            </p>
                          </div>
                          <button onClick={() => setShowPassCorp(v => !v)} className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
                            {showPassCorp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                      {perfil.password_bitlocker && (
                        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 flex items-center gap-3">
                          <div className="w-7 h-7 rounded-md bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-gray-500 mb-0.5">Clave BitLocker</p>
                            <p className="text-sm font-mono text-gray-900 truncate">
                              {showPassBitlocker ? perfil.password_bitlocker : '••••••••••••'}
                            </p>
                          </div>
                          <button onClick={() => setShowPassBitlocker(v => !v)} className="text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
                            {showPassBitlocker ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.section>
              )}

              {/* Sobre mí — editable inline (último en columna izquierda) */}
              <motion.section variants={blockVariants}>
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">
                      Sobre mí
                    </span>
                    <AnimatePresence>
                      {savedFeedback && (
                        <motion.span
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-[11px] text-teal-600 flex items-center gap-1"
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
                        'w-full text-sm text-gray-700 bg-gray-50 rounded-lg',
                        'border border-gray-200 focus:border-sky-400',
                        'p-2.5 resize-none outline-none',
                        'placeholder:text-gray-400 transition-colors duration-150',
                      )}
                    />
                  ) : (
                    <p
                      onClick={() => setEditandoBio(true)}
                      className={cn(
                        'text-sm cursor-text rounded-lg p-2 -ml-2',
                        'hover:bg-gray-50 transition-colors duration-150',
                        bio ? 'text-gray-700' : 'text-gray-400 italic',
                      )}
                    >
                      {bio || 'Contá algo sobre vos...'}
                    </p>
                  )}
                </div>
              </motion.section>

            </div>{/* /columna izquierda */}

            {/* Columna derecha: Mi onboarding → Contactos → Encuestas */}
            <div className="space-y-4">

              <motion.section id="tour-onboarding-tracker" variants={blockVariants}>
                <MiOnboardingCard
                  modulos={[
                    {
                      key: 'M1', label: 'Perfil',
                      href: '/empleado/perfil',
                      completado: modulosProgreso['M1'] ?? false,
                      activo: true,
                      accent: '#818CF8',
                      accentBg: 'rgba(59,79,216,0.10)',
                    },
                    {
                      key: 'M2', label: 'Rol',
                      href: '/empleado/rol',
                      completado: modulosProgreso['M2'] ?? false,
                      activo: !(modulosProgreso['M1'] === false),
                      accent: '#FCD34D',
                      accentBg: 'rgba(245,158,11,0.10)',
                    },
                    {
                      key: 'M3', label: 'Cultura',
                      href: '/empleado/cultura',
                      completado: modulosProgreso['M3'] ?? false,
                      activo: modulosProgreso['M2'] ?? false,
                      accent: '#2DD4BF',
                      accentBg: 'rgba(13,148,136,0.10)',
                    },
                  ]}
                  progresoTotal={progresoTotal}
                  diasOnboarding={diasOnboarding}
                />
              </motion.section>

              {/* Contactos Claves */}
              <motion.section variants={blockVariants}>
                <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">
                      Contactos Claves
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
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
                </div>
              </motion.section>

              {/* Encuestas de pulso */}
              <motion.section variants={blockVariants}>
                <EncuestasPulsoCard encuestas={encuestasPulso} diasOnboarding={diasOnboarding} />
              </motion.section>

            </div>{/* /columna derecha */}

          </div>{/* /fila principal */}


          {/* ── Bloque C: Mi equipo ── */}
          {equipo.length > 0 && (
            <motion.section variants={blockVariants}>
              <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
                <h2 className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-4">
                  Mi equipo
                </h2>

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="space-y-2"
                >
                  {equipo.map(miembro => (
                    <motion.div
                      key={miembro.id}
                      variants={itemVariants}
                      className="rounded-lg bg-gray-50 border border-gray-200 p-3 flex items-center gap-3"
                    >
                      <SmallAvatar src={miembro.foto_url} nombre={miembro.nombre} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {miembro.nombre}
                          </span>
                          <Badge variant={relacionBadgeVariant(miembro.relacion)}>
                            {relacionLabel(miembro.relacion, t)}
                          </Badge>
                        </div>
                        {miembro.puesto && (
                          <p className="text-xs text-gray-500 truncate">{miembro.puesto}</p>
                        )}
                      </div>

                      <a
                        href={`mailto:${miembro.email}`}
                        className="text-gray-400 hover:text-sky-600 transition-colors duration-150 p-1.5 rounded flex-shrink-0"
                        title={`Escribir a ${miembro.nombre}`}
                      >
                        <Mail className="w-4 h-4" />
                      </a>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </motion.section>
          )}

        </motion.div>
      </div>

      {/* Tour de bienvenida — se activa solo la primera vez */}
      <ProductTour nombreEmpleado={perfil.nombre ?? ''} />
    </div>
  )
}
