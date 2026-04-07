'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Eye, EyeOff, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import HeeroLogo from '@/components/shared/HeeroLogo'
import Image from 'next/image'

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 24 } },
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }
function isValidPassword(p: string) { return p.length >= 6 }
function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos'
  if (msg.includes('Email not confirmed'))        return 'Confirmá tu email antes de ingresar'
  if (msg.includes('Too many requests'))          return 'Demasiados intentos. Esperá unos minutos'
  if (msg.includes('User not found'))             return 'No existe una cuenta con ese email'
  if (msg.includes('No se encontró el perfil'))   return 'Usuario sin perfil configurado. Contactá soporte.'
  return 'Error al iniciar sesión. Intentá de nuevo'
}

// ─────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────

function AuthModal({
  mode,
  onClose,
  initialError,
  oauthLoading,
  onOAuth,
}: {
  mode: 'login' | 'signup'
  onClose: () => void
  initialError: string | null
  oauthLoading: 'google' | 'azure' | null
  onOAuth: (provider: 'google' | 'azure') => void
}) {
  const router = useRouter()
  const [email,        setEmail       ] = useState('')
  const [password,     setPassword    ] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,      setLoading     ] = useState(false)
  const [authError,    setAuthError   ] = useState<string | null>(initialError)
  const [touched,      setTouched     ] = useState({ email: false, password: false })

  const emailError    = touched.email    && email    && !isValidEmail(email)       ? 'Email inválido' : null
  const passwordError = touched.password && password && !isValidPassword(password) ? 'Mínimo 6 caracteres' : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (!isValidEmail(email) || !isValidPassword(password)) return
    setLoading(true)
    setAuthError(null)
    try {
      const res  = await fetch('/api/auth/login', {
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
      const destinos: Record<string, string> = { dev: '/superadmin', admin: '/admin', empleado: '/empleado/perfil' }
      router.push(destinos[json.rol] ?? '/empleado/perfil')
    } catch {
      setAuthError('Error inesperado. Intentá de nuevo')
    } finally {
      setLoading(false)
    }
  }

  const title = mode === 'login' ? 'Iniciá sesión' : 'Creá tu cuenta'

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => { if (!loading && !oauthLoading) onClose() }}
      />

      {/* Panel */}
      <motion.div
        className="relative z-10 w-full max-w-[300px] rounded-xl border border-[#545454] bg-[#111] p-6"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        {/* Cerrar */}
        <button
          onClick={() => { if (!loading && !oauthLoading) onClose() }}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center
            text-[#717171] hover:text-white transition-colors rounded hover:bg-white/[0.06]"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <h2 className="text-white text-sm font-semibold mb-5" style={{ letterSpacing: '-0.4px' }}>
          {title}
        </h2>

        {/* Error */}
        <AnimatePresence>
          {authError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 mb-4"
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300 leading-snug">{authError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Formulario email/password */}
        <form onSubmit={handleSubmit} noValidate className="space-y-2.5 mb-4">
          <div>
            <input
              type="email" value={email}
              onChange={e => { setEmail(e.target.value); if (authError) setAuthError(null) }}
              onBlur={() => setTouched(p => ({ ...p, email: true }))}
              placeholder="email" autoComplete="email"
              className={`w-full h-8 px-3 text-xs text-white placeholder:text-[#555]
                bg-[#1e1e1e] rounded-lg border outline-none transition-all duration-150
                focus:ring-1 focus:ring-[#29d4fc]/40 focus:border-[#29d4fc]/50
                ${emailError ? 'border-red-500/40' : 'border-[#333] hover:border-[#444]'}`}
            />
            {emailError && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{emailError}</p>}
          </div>
          <div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); if (authError) setAuthError(null) }}
                onBlur={() => setTouched(p => ({ ...p, password: true }))}
                placeholder="contraseña" autoComplete="current-password"
                className={`w-full h-8 px-3 pr-9 text-xs text-white placeholder:text-[#555]
                  bg-[#1e1e1e] rounded-lg border outline-none transition-all duration-150
                  focus:ring-1 focus:ring-[#29d4fc]/40 focus:border-[#29d4fc]/50
                  ${passwordError ? 'border-red-500/40' : 'border-[#333] hover:border-[#444]'}`}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#aaa] transition-colors">
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {passwordError && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{passwordError}</p>}
          </div>
          <motion.button type="submit" disabled={loading || !!oauthLoading}
            whileHover={!loading ? { scale: 1.02 } : undefined}
            whileTap={!loading ? { scale: 0.97 } : undefined}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="w-full h-8 rounded-lg bg-[#29d4fc] text-black text-[11px] font-semibold
                       hover:bg-[#20c4ec] transition-colors cursor-pointer
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Ingresando...' : 'Continuar'}
          </motion.button>
        </form>

        {/* Divisor */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-px bg-[#2a2a2a]" />
          <span className="text-[9px] text-[#555]">o con</span>
          <div className="flex-1 h-px bg-[#2a2a2a]" />
        </div>

        {/* OAuth */}
        <div className="flex gap-2">
          <motion.button type="button" onClick={() => onOAuth('google')}
            disabled={!!oauthLoading || loading}
            whileHover={!oauthLoading ? { scale: 1.04 } : undefined}
            whileTap={!oauthLoading ? { scale: 0.96 } : undefined}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            title="Continuar con Google"
            className="flex-1 h-8 rounded-lg bg-white flex items-center justify-center
                       hover:bg-gray-100 transition-colors cursor-pointer
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {oauthLoading === 'google'
              ? <span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
              : <Image src="/google-g-logo.svg" alt="Google" width={15} height={15} />}
          </motion.button>

          <motion.button type="button" onClick={() => onOAuth('azure')}
            disabled={!!oauthLoading || loading}
            whileHover={!oauthLoading ? { scale: 1.04 } : undefined}
            whileTap={!oauthLoading ? { scale: 0.96 } : undefined}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            title="Continuar con Microsoft 365"
            className="flex-1 h-8 rounded-lg bg-[#1e1e1e] border border-[#333]
                       flex items-center justify-center
                       hover:bg-[#2a2a2a] transition-colors cursor-pointer
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {oauthLoading === 'azure'
              ? <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#F25022" d="M1 1h10v10H1z"/>
                  <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                  <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                  <path fill="#FFB900" d="M13 13h10v10H13z"/>
                </svg>
              )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function LoginPage() {
  const [modal,        setModal       ] = useState<'login' | 'signup' | null>(null)
  const [urlError,     setUrlError    ] = useState<string | null>(null)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'azure' | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err) {
      const msgs: Record<string, string> = {
        session_error: 'Error al iniciar sesión con el proveedor. Intentá de nuevo.',
        setup_error:   'Error al configurar tu cuenta. Contactá soporte.',
        missing_code:  'El enlace de autenticación no es válido.',
      }
      setUrlError(msgs[err] ?? 'Error de autenticación. Intentá de nuevo.')
      setModal('login')
    }
  }, [])

  const handleOAuth = async (provider: 'google' | 'azure') => {
    setOauthLoading(provider)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    setOauthLoading(null)
  }

  return (
    <div className="min-h-dvh flex bg-black">
      {/* ── Panel izquierdo ── */}
      <div className="relative flex-1 flex items-center justify-center p-6 md:p-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="w-full max-w-[271px]"
        >
          <motion.div variants={itemVariants} className="mb-12">
            <HeeroLogo size="lg" />
          </motion.div>

          <motion.div variants={itemVariants} className="mb-10">
            <h1 className="text-white text-2xl font-light leading-tight mb-2" style={{ letterSpacing: '-0.04em' }}>
              Tu onboarding,<br />inteligente.
            </h1>
            <p className="text-[#717171] text-xs leading-relaxed">
              Plataforma de onboarding para equipos modernos.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-2">
            <motion.button
              type="button"
              onClick={() => { setUrlError(null); setModal('login') }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full h-9 rounded-lg bg-[#29d4fc] text-black text-[12px] font-semibold
                         hover:bg-[#20c4ec] transition-colors cursor-pointer"
            >
              Iniciar sesión
            </motion.button>

            <motion.button
              type="button"
              onClick={() => { setUrlError(null); setModal('signup') }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full h-9 rounded-lg bg-transparent border border-[#545454]
                         text-white text-[12px] font-medium
                         hover:bg-white/[0.04] hover:border-[#717171]
                         transition-all cursor-pointer"
            >
              Registrarse
            </motion.button>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Panel derecho: ilustración ── */}
      <div className="hidden md:block relative w-[55%] overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #1a0a2e 0%, #3d1a4f 15%, #c44b3f 40%, #e8734a 55%, #f4a261 70%, #e0935a 85%, #2a1520 100%)' }} />
        <div className="absolute top-[8%] right-[15%] w-20 h-20 rounded-full" style={{ background: 'radial-gradient(circle, #fff8e7 0%, #f4d8a0 40%, #e8b87044 70%, transparent 100%)', boxShadow: '0 0 60px 20px rgba(244,210,160,0.3)' }} />
        {[
          { top: '5%',  left: '20%', size: 2   },
          { top: '10%', left: '45%', size: 1.5 },
          { top: '3%',  left: '65%', size: 2   },
          { top: '15%', left: '30%', size: 1.5 },
          { top: '8%',  left: '80%', size: 1.5 },
          { top: '12%', left: '55%', size: 2   },
          { top: '18%', left: '15%', size: 1.5 },
          { top: '6%',  left: '38%', size: 1   },
        ].map((s, i) => (
          <div key={i} className="absolute rounded-full bg-white/70" style={{ top: s.top, left: s.left, width: s.size, height: s.size }} />
        ))}
        <div className="absolute bottom-0 left-0 right-0 h-[45%]" style={{ background: 'linear-gradient(180deg, #c44b3f88 0%, #3a1525 30%, #1a0a15 100%)' }} />
        <div className="absolute bottom-[20%] left-[10%] right-[10%] h-[35%]">
          <div className="absolute top-[10%] left-0 right-0 h-[4%]" style={{ background: '#5c2a1a' }} />
          <div className="absolute top-[45%] left-0 right-0 h-[4%]" style={{ background: '#4a2015' }} />
          {[15, 35, 55, 75].map((left, i) => (
            <div key={i} className="absolute h-full" style={{ left: `${left}%`, width: '4%', background: 'linear-gradient(180deg, #6b3020 0%, #3a1810 100%)' }} />
          ))}
        </div>
        <div className="absolute bottom-[40%] left-0 right-0 h-[15%]" style={{ background: 'linear-gradient(180deg, transparent 0%, #2a1215 60%, #3a1820 100%)', clipPath: 'polygon(0% 100%, 5% 40%, 15% 60%, 25% 30%, 40% 50%, 55% 20%, 70% 45%, 85% 25%, 100% 55%, 100% 100%)' }} />
      </div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {modal && (
          <AuthModal
            mode={modal}
            onClose={() => setModal(null)}
            initialError={urlError}
            oauthLoading={oauthLoading}
            onOAuth={handleOAuth}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
