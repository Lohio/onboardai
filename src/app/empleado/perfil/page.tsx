'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Mail, ExternalLink, Copy, Check,
  MessageSquare, FileText, Code, Globe,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ErrorState } from '@/components/shared/ErrorState'
import { createClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { ContactoCard } from '@/components/empleado/ContactoCard'
import type { HerramientaContacto } from '@/lib/contacto'
import type { Usuario, MiembroEquipo, Acceso } from '@/types'

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

function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function modalidadLabel(m: string): string {
  if (m === 'presencial') return 'Presencial'
  if (m === 'remoto') return 'Remoto'
  if (m === 'hibrido') return 'Híbrido'
  return m
}

function modalidadVariant(m: string): 'info' | 'default' | 'success' {
  if (m === 'presencial') return 'info'
  if (m === 'hibrido') return 'default'
  if (m === 'remoto') return 'success'
  return 'default'
}

function relacionLabel(r: MiembroEquipo['relacion']): string {
  if (r === 'manager') return 'Manager'
  if (r === 'buddy') return 'Buddy'
  return 'Compañero'
}

function relacionBadgeVariant(r: MiembroEquipo['relacion']): 'default' | 'success' | 'info' {
  if (r === 'manager') return 'default'
  if (r === 'buddy') return 'success'
  return 'info'
}

// ─────────────────────────────────────────────
// Ícono por herramienta
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
// Skeleton
// ─────────────────────────────────────────────

function SkeletonLine({ width = 'w-full', className }: { width?: string; className?: string }) {
  return <div className={cn('shimmer rounded-md h-4', width, className)} />
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Bloque A */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="shimmer rounded-full w-24 h-24 flex-shrink-0" />
          <div className="flex-1 space-y-3 pt-1">
            <SkeletonLine width="w-48" className="h-6" />
            <SkeletonLine width="w-36" />
            <SkeletonLine width="w-24" className="h-5 rounded-full" />
            <SkeletonLine width="w-32" />
            <SkeletonLine width="w-full" className="h-12 mt-2" />
          </div>
        </div>
      </div>

      {/* Bloque B */}
      <div className="glass-card rounded-xl p-5 space-y-3">
        <SkeletonLine width="w-28" className="h-5 mb-4" />
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

      {/* Bloque C */}
      <div className="glass-card rounded-xl p-5 space-y-3">
        <SkeletonLine width="w-28" className="h-5 mb-4" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="shimmer rounded-md w-8 h-8 flex-shrink-0" />
            <SkeletonLine width="w-32" />
            <div className="ml-auto">
              <SkeletonLine width="w-16" className="h-5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Avatar con upload
// ─────────────────────────────────────────────

function AvatarUpload({
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
    <div
      className="relative group cursor-pointer flex-shrink-0 w-24 h-24"
      onClick={() => inputRef.current?.click()}
    >
      {src ? (
        <img
          src={src}
          alt={nombre}
          className="w-24 h-24 rounded-full object-cover"
        />
      ) : (
        <div className="w-24 h-24 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
          <span className="text-indigo-300 text-3xl font-semibold">{initials}</span>
        </div>
      )}

      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
        <Camera className="w-6 h-6 text-white" />
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
    </div>
  )
}

// ─────────────────────────────────────────────
// Avatar pequeño (40px) para equipo
// ─────────────────────────────────────────────

function SmallAvatar({ src, nombre }: { src?: string; nombre: string }) {
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
      {src ? (
        <img src={src} alt={nombre} className="w-full h-full object-cover" />
      ) : (
        <span className="text-indigo-300 text-xs font-semibold">{getInitials(nombre)}</span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function PerfilPage() {
  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState<Usuario | null>(null)
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([])
  const [accesos, setAccesos] = useState<Acceso[]>([])

  const [herramientaContacto, setHerramientaContacto] = useState<HerramientaContacto>('email')

  const [editandoBio, setEditandoBio] = useState(false)
  const [bio, setBio] = useState('')
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [hasError, setHasError] = useState(false)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setHasError(false)
    try {
      const supabase = createClient()

      // 1. Usuario autenticado
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // 2, 3, 5 en paralelo
      const [perfilRes, relacionesRes, accesosRes] = await Promise.all([
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
          .from('accesos')
          .select('*')
          .eq('usuario_id', user.id)
          .order('herramienta'),
      ])

      if (perfilRes.data) {
        setPerfil(perfilRes.data as Usuario)
        setBio(perfilRes.data.bio ?? '')

        // Herramienta de contacto de la empresa
        const empresaRes = await supabase
          .from('empresas')
          .select('herramienta_contacto')
          .eq('id', perfilRes.data.empresa_id)
          .single()
        if (empresaRes.data?.herramienta_contacto) {
          setHerramientaContacto(empresaRes.data.herramienta_contacto as HerramientaContacto)
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

      if (error) throw error

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

      if (uploadError) throw uploadError

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

  // Contactos clave desde datos de equipo ya cargados
  const manager = equipo.find(m => m.relacion === 'manager')
  const buddy = equipo.find(m => m.relacion === 'buddy')

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
          {/* ── Bloque A: Mis datos ── */}
          <motion.section variants={blockVariants}>
            <Card>
              <div className="flex flex-col sm:flex-row gap-5">
                {/* Avatar con upload */}
                <AvatarUpload
                  src={perfil.foto_url}
                  nombre={perfil.nombre}
                  onUpload={handleAvatarUpload}
                />

                {/* Datos personales */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-white leading-tight">
                    {perfil.nombre}
                  </h2>

                  {(perfil.puesto || perfil.area) && (
                    <p className="text-sm text-white/55 mt-0.5">
                      {[perfil.puesto, perfil.area].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {perfil.modalidad && (
                      <Badge variant={modalidadVariant(perfil.modalidad)}>
                        {modalidadLabel(perfil.modalidad)}
                      </Badge>
                    )}
                    {perfil.fecha_ingreso && (
                      <span className="text-xs text-white/35">
                        Ingresó el {formatDate(perfil.fecha_ingreso)}
                      </span>
                    )}
                  </div>

                  {/* Email copiable */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(perfil.email).catch(() => {})
                      toast.success('Email copiado')
                    }}
                    className="flex items-center gap-1.5 mt-2 text-sm text-white/45 hover:text-indigo-300 transition-colors duration-150 group"
                    title="Copiar email"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span className="font-mono text-xs">{perfil.email}</span>
                    <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                  </button>

                  {/* Sobre mí editable inline */}
                  <div className="mt-3">
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
                          'border border-white/10 focus:border-indigo-500/40',
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
              </div>
            </Card>
          </motion.section>

          {/* ── Bloque B: Mi equipo ── */}
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
                            {relacionLabel(miembro.relacion)}
                          </Badge>
                        </div>
                        {miembro.puesto && (
                          <p className="text-xs text-white/40 truncate">{miembro.puesto}</p>
                        )}
                      </div>

                      <a
                        href={`mailto:${miembro.email}`}
                        className="text-white/25 hover:text-indigo-400 transition-colors duration-150 p-1.5 rounded flex-shrink-0"
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

          {/* ── Bloque C: Mis accesos ── */}
          {accesos.length > 0 && (
            <motion.section variants={blockVariants}>
              <Card>
                <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">
                  Mis accesos
                </h2>

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="space-y-3"
                >
                  {accesos.map(acceso => (
                    <motion.div
                      key={acceso.id}
                      variants={itemVariants}
                      className="flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-md bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
                        <ToolIcon name={acceso.herramienta} className="text-white/50" />
                      </div>

                      <span className="flex-1 text-sm text-white/80 truncate">
                        {acceso.herramienta}
                      </span>

                      {acceso.estado === 'activo' && (
                        <div className="flex items-center gap-2 flex-shrink-0">
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
                        </div>
                      )}

                      {acceso.estado === 'pendiente' && (
                        <span className="animate-pulse-soft flex-shrink-0">
                          <Badge variant="warning">En proceso</Badge>
                        </span>
                      )}

                      {acceso.estado === 'sin_acceso' && (
                        <span className="flex-shrink-0">
                          <Badge variant="error">Sin acceso</Badge>
                        </span>
                      )}
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
        </motion.div>
      </div>
    </div>
  )
}
