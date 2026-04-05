'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import HeeroLogo from '@/components/shared/HeeroLogo'
import Image from 'next/image'

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 26 },
  },
}

// ─────────────────────────────────────────────
// Validaciones
// ─────────────────────────────────────────────

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidPassword(password: string) {
  return password.length >= 6
}

function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Email o contraseña incorrectos'
  if (message.includes('Email not confirmed'))        return 'Necesitás confirmar tu email antes de ingresar'
  if (message.includes('Too many requests'))          return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo'
  if (message.includes('User not found'))             return 'No existe una cuenta con ese email'
  return 'Error al iniciar sesión. Intentá de nuevo'
}

// ─────────────────────────────────────────────
// Página de login
// ─────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()

  const [email,        setEmail       ] = useState('')
  const [password,     setPassword    ] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,      setLoading     ] = useState(false)
  const [authError,    setAuthError   ] = useState<string | null>(null)
  const [touched,      setTouched     ] = useState({ email: false, password: false })
  const [oauthLoading, setOauthLoading] = useState<'google' | 'azure' | null>(null)

  // Leer error de la URL (viene desde /auth/callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlError = params.get('error')
    if (urlError) {
      const msgs: Record<string, string> = {
        session_error: 'Error al iniciar sesión con el proveedor. Intentá de nuevo.',
        setup_error:   'Error al configurar tu cuenta. Contactá soporte.',
        missing_code:  'El enlace de autenticación no es válido.',
      }
      setAuthError(msgs[urlError] ?? 'Error de autenticación. Intentá de nuevo.')
    }
  }, [])

  const handleOAuth = async (provider: 'google' | 'azure') => {
    setOauthLoading(provider)
    setAuthError(null)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    setOauthLoading(null)
  }

  const emailError =
    touched.email && email && !isValidEmail(email) ? 'Ingresá un email válido' : null
  const passwordError =
    touched.password && password && !isValidPassword(password)
      ? 'La contraseña debe tener al menos 6 caracteres' : null

  const handleBlur = (field: 'email' | 'password') =>
    setTouched(prev => ({ ...prev, [field]: true }))

  const handleChange = (field: 'email' | 'password', value: string) => {
    if (field === 'email') setEmail(value)
    else setPassword(value)
    if (authError) setAuthError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (!isValidEmail(email) || !isValidPassword(password)) return

    setLoading(true)
    setAuthError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const json = await res.json()

      if (!res.ok) { setAuthError(translateAuthError(json.error ?? '')); return }

      if (json.access_token && json.refresh_token) {
        const supabase = createClient()
        await supabase.auth.setSession({ access_token: json.access_token, refresh_token: json.refresh_token })
      }

      const destinos: Record<string, string> = {
        dev: '/superadmin', admin: '/admin', empleado: '/empleado/perfil',
      }
      router.push(destinos[json.rol] ?? '/empleado/perfil')
    } catch {
      setAuthError('Error inesperado. Intentá de nuevo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex bg-black">
      {/* ── Panel izquierdo: formulario ── */}
      <div className="relative flex-1 flex items-center justify-center p-6 md:p-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="w-full max-w-[271px]"
        >
          {/* Logo */}
          <motion.div variants={itemVariants} className="mb-10">
            <HeeroLogo size="lg" />
          </motion.div>

          {/* Card del formulario */}
          <motion.div
            variants={itemVariants}
            className="rounded-lg border border-[#545454] p-6"
          >
            <h1 className="text-white text-base font-medium tracking-tight mb-6" style={{ letterSpacing: '-0.5px' }}>
              Ingresá a tu cuenta
            </h1>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Email */}
              <div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => handleChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  placeholder="tu@empresa.com"
                  autoComplete="email"
                  className={`
                    w-full h-8 px-3 text-xs text-white placeholder:text-[#808080]
                    bg-[#2f2f2f] rounded-lg border outline-none
                    transition-all duration-150
                    focus:ring-2 focus:ring-[#29d4fc]/30 focus:border-[#29d4fc]/50
                    ${emailError ? 'border-red-500/40 bg-red-500/5' : 'border-transparent hover:border-white/10'}
                  `}
                />
                <FieldError message={emailError} />
              </div>

              {/* Contraseña */}
              <div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => handleChange('password', e.target.value)}
                    onBlur={() => handleBlur('password')}
                    placeholder="contraseña"
                    autoComplete="current-password"
                    className={`
                      w-full h-8 px-3 pr-9 text-xs text-white placeholder:text-[#808080]
                      bg-[#2f2f2f] rounded-lg border outline-none
                      transition-all duration-150
                      focus:ring-2 focus:ring-[#29d4fc]/30 focus:border-[#29d4fc]/50
                      ${passwordError ? 'border-red-500/40 bg-red-500/5' : 'border-transparent hover:border-white/10'}
                    `}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#808080] hover:text-white/60 transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <FieldError message={passwordError} />
              </div>

              {/* Error de autenticación */}
              <AnimatePresence>
                {authError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300 leading-snug">{authError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Botón Comenzar */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={!loading ? { scale: 1.02 } : undefined}
                whileTap={!loading ? { scale: 0.97 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="w-full h-8 rounded-lg bg-[#29d4fc] text-black text-[11px] font-medium
                           hover:bg-[#20c4ec] transition-colors duration-150 cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Ingresando...' : 'Comenzar'}
              </motion.button>
            </form>

            {/* Separador: Google */}
            <div className="mt-5">
              <p className="text-xs text-[#717171] leading-snug mb-3" style={{ letterSpacing: '-0.5px' }}>
                Usá tu cuenta corporativa de<br />Google.
              </p>
              <motion.button
                type="button"
                onClick={() => handleOAuth('google')}
                disabled={!!oauthLoading || loading}
                whileHover={!oauthLoading ? { scale: 1.02 } : undefined}
                whileTap={!oauthLoading ? { scale: 0.97 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="w-full h-8 rounded-lg bg-white text-black text-[10px] font-bold
                           flex items-center justify-center gap-2
                           hover:bg-gray-100 transition-colors duration-150 cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthLoading === 'google'
                  ? <span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
                  : <Image src="/google-g-logo.svg" alt="" width={13} height={13} className="flex-shrink-0" />}
                {oauthLoading === 'google' ? 'Conectando...' : 'Continuar con Google'}
              </motion.button>
            </div>

            {/* Separador: SSO */}
            <div className="mt-4">
              <p className="text-[9px] text-[#717171] text-center mb-3">
                o para empresas
              </p>
              <motion.button
                type="button"
                onClick={() => handleOAuth('azure')}
                disabled={!!oauthLoading || loading}
                whileHover={!oauthLoading ? { scale: 1.02 } : undefined}
                whileTap={!oauthLoading ? { scale: 0.97 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="w-full h-8 rounded-lg bg-[#1f1f1f] border border-[#545454]
                           text-white text-[11px] flex items-center justify-center gap-2
                           hover:bg-[#2a2a2a] transition-colors duration-150 cursor-pointer
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {oauthLoading === 'azure'
                  ? <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                  : (
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden>
                      <path fill="#F25022" d="M1 1h10v10H1z"/>
                      <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                      <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                      <path fill="#FFB900" d="M13 13h10v10H13z"/>
                    </svg>
                  )}
                {oauthLoading === 'azure' ? 'Conectando...' : 'Iniciar sesión con Microsoft 365'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Panel derecho: ilustración ── */}
      <div className="hidden md:block relative w-[55%] overflow-hidden">
        {/* Cielo con gradiente cálido */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, #1a0a2e 0%, #3d1a4f 15%, #c44b3f 40%, #e8734a 55%, #f4a261 70%, #e0935a 85%, #2a1520 100%)',
          }}
        />

        {/* Luna */}
        <div
          className="absolute top-[8%] right-[15%] w-20 h-20 rounded-full"
          style={{
            background: 'radial-gradient(circle, #fff8e7 0%, #f4d8a0 40%, #e8b87044 70%, transparent 100%)',
            boxShadow: '0 0 60px 20px rgba(244,210,160,0.3)',
          }}
        />

        {/* Estrellas */}
        {[
          { top: '5%', left: '20%', size: 2 },
          { top: '10%', left: '45%', size: 1.5 },
          { top: '3%', left: '65%', size: 2 },
          { top: '15%', left: '30%', size: 1.5 },
          { top: '8%', left: '80%', size: 1.5 },
          { top: '12%', left: '55%', size: 2 },
          { top: '18%', left: '15%', size: 1.5 },
          { top: '6%', left: '38%', size: 1 },
        ].map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/70"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
            }}
          />
        ))}

        {/* Agua / reflejo */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[45%]"
          style={{
            background: 'linear-gradient(180deg, #c44b3f88 0%, #3a1525 30%, #1a0a15 100%)',
          }}
        />

        {/* Muelle / puente — pilares verticales */}
        <div className="absolute bottom-[20%] left-[10%] right-[10%] h-[35%]">
          {/* Baranda horizontal superior */}
          <div
            className="absolute top-[10%] left-0 right-0 h-[4%]"
            style={{ background: '#5c2a1a' }}
          />
          {/* Baranda horizontal inferior */}
          <div
            className="absolute top-[45%] left-0 right-0 h-[4%]"
            style={{ background: '#4a2015' }}
          />
          {/* Pilares verticales */}
          {[15, 35, 55, 75].map((left, i) => (
            <div
              key={i}
              className="absolute h-full"
              style={{
                left: `${left}%`,
                width: '4%',
                background: 'linear-gradient(180deg, #6b3020 0%, #3a1810 100%)',
              }}
            />
          ))}
        </div>

        {/* Montañas / tierra distante */}
        <div
          className="absolute bottom-[40%] left-0 right-0 h-[15%]"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, #2a1215 60%, #3a1820 100%)',
            clipPath: 'polygon(0% 100%, 5% 40%, 15% 60%, 25% 30%, 40% 50%, 55% 20%, 70% 45%, 85% 25%, 100% 55%, 100% 100%)',
          }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Error de campo
// ─────────────────────────────────────────────

function FieldError({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          className="text-[10px] text-red-400 flex items-center gap-1"
        >
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}
