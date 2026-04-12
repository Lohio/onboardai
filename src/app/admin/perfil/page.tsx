'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { User, Phone, Mail, Save, CheckCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

const PHONE_STORAGE_KEY = 'heero_admin_phone'

export default function AdminPerfilPage() {
  const router = useRouter()

  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [nombre, setNombre]         = useState('')
  const [email, setEmail]           = useState('')
  const [telefono, setTelefono]     = useState('')
  const [emailRecupero, setEmailRecupero] = useState('')
  const [userId, setUserId]         = useState('')

  const cargarDatos = useCallback(async () => {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    setUserId(user.id)
    setEmail(user.email ?? '')
    setEmailRecupero(user.email ?? '')

    const { data } = await supabase
      .from('usuarios')
      .select('nombre')
      .eq('id', user.id)
      .single()

    setNombre(data?.nombre ?? '')

    // Teléfono guardado localmente
    const savedPhone = localStorage.getItem(PHONE_STORAGE_KEY)
    if (savedPhone) setTelefono(savedPhone)

    setLoading(false)
  }, [router])

  useEffect(() => { void cargarDatos() }, [cargarDatos])

  const handleGuardar = async () => {
    if (!userId) return
    setSaving(true)

    try {
      const supabase = createClient()

      // Actualizar nombre en tabla usuarios
      await supabase
        .from('usuarios')
        .update({ nombre })
        .eq('id', userId)

      // Guardar teléfono en localStorage
      localStorage.setItem(PHONE_STORAGE_KEY, telefono)

      // Si cambió el email de recupero, actualizar en auth
      if (emailRecupero && emailRecupero !== email) {
        await supabase.auth.updateUser({ email: emailRecupero })
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const iniciales = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('') || 'A'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-5 h-5 border-2 border-[#0EA5E9]/30 border-t-[#0EA5E9] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin"
          className="w-8 h-8 rounded-lg flex items-center justify-center
            text-white/30 hover:text-white/70 hover:bg-white/[0.06]
            transition-colors duration-150"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-white">Perfil de administrador</h1>
          <p className="text-sm text-white/40">Gestiona tu información personal</p>
        </div>
      </div>

      {/* Avatar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center gap-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#0EA5E9]/20 border border-[#0EA5E9]/25
          flex items-center justify-center flex-shrink-0">
          <span className="text-[#7DD3FC] text-xl font-bold">{iniciales}</span>
        </div>
        <div>
          <p className="text-base font-semibold text-white">{nombre || 'Administrador'}</p>
          <p className="text-sm text-white/40">{email}</p>
        </div>
      </motion.div>

      {/* Formulario */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 space-y-5"
      >
        {/* Nombre */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs font-medium text-white/50 uppercase tracking-wide">
            <User className="w-3.5 h-3.5" />
            Nombre completo
          </label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Tu nombre y apellido"
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl
              px-4 py-3 text-sm text-white placeholder-white/25
              focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9]/40
              transition-colors duration-150"
          />
        </div>

        {/* Teléfono */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs font-medium text-white/50 uppercase tracking-wide">
            <Phone className="w-3.5 h-3.5" />
            Teléfono
          </label>
          <input
            type="tel"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            placeholder="+54 9 11 0000-0000"
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl
              px-4 py-3 text-sm text-white placeholder-white/25
              focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9]/40
              transition-colors duration-150"
          />
        </div>

        {/* Email de recuperación */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs font-medium text-white/50 uppercase tracking-wide">
            <Mail className="w-3.5 h-3.5" />
            Email de recuperación
          </label>
          <input
            type="email"
            value={emailRecupero}
            onChange={e => setEmailRecupero(e.target.value)}
            placeholder="tu@email.com"
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl
              px-4 py-3 text-sm text-white placeholder-white/25
              focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9]/40
              transition-colors duration-150"
          />
          {emailRecupero !== email && emailRecupero && (
            <p className="text-[11px] text-amber-400/80">
              Se enviará un mail de confirmación a la nueva dirección.
            </p>
          )}
        </div>

        {/* Email actual (solo lectura) */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs font-medium text-white/50 uppercase tracking-wide">
            <Mail className="w-3.5 h-3.5" />
            Email actual
          </label>
          <div className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl
            px-4 py-3 text-sm text-white/35 select-all">
            {email}
          </div>
        </div>
      </motion.div>

      {/* Botón guardar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.16 }}
        className="mt-6 flex justify-end"
      >
        <button
          onClick={handleGuardar}
          disabled={saving || !nombre.trim()}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[9px]
            text-sm font-semibold text-white
            bg-[#3B4FD8] hover:bg-[#4B5EE8] disabled:opacity-50 disabled:cursor-not-allowed
            shadow-[0_0_20px_rgba(59,79,216,0.2)] hover:shadow-[0_0_28px_rgba(59,79,216,0.35)]
            transition-all duration-200"
        >
          {saved ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Guardado
            </>
          ) : saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Guardar cambios
            </>
          )}
        </button>
      </motion.div>
    </div>
  )
}
