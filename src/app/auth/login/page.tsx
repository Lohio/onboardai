'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'

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
// Página principal
// ─────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()

  const [email,        setEmail       ] = useState('')
  const [password,     setPassword    ] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,      setLoading     ] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'azure' | null>(null)
  const [authError,    setAuthError   ] = useState<string | null>(null)
  const [touched,      setTouched     ] = useState({ email: false, password: false })

  const emailError    = touched.email    && email    && !isValidEmail(email)       ? 'Email inválido' : null
  const passwordError = touched.password && password && !isValidPassword(password) ? 'Mínimo 6 caracteres' : null

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err) {
      const msgs: Record<string, string> = {
        session_error: 'Error al iniciar sesión con el proveedor. Intentá de nuevo.',
        setup_error:   'Error al configurar tu cuenta. Contactá soporte.',
        missing_code:  'El enlace de autenticación no es válido.',
      }
      setAuthError(msgs[err] ?? 'Error de autenticación. Intentá de nuevo.')
    }
  }, [])

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
      {/* ── Columna del formulario ── */}
      <div className="flex-1 md:w-1/2 flex flex-col items-center justify-start md:justify-center px-5 pt-10 pb-8 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[380px]"
        >
          {/* Logo */}
          <div className="flex justify-center mb-8 md:mb-10">
            <Image
              src="/heero-logo.svg"
              alt="Heero"
              width={110}
              height={32}
              priority
              className="h-8 w-auto"
            />
          </div>

          {/* Card del formulario */}
          <div className="rounded-2xl border border-[#2a2a2a] bg-[#0d0d0d] p-6 md:p-7">
            <h1
              className="text-white text-lg md:text-xl font-semibold mb-5 text-center"
              style={{ letterSpacing: '-0.02em' }}
            >
              Ingresá a tu cuenta
            </h1>

            {/* Error */}
            {authError && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-snug">{authError}</p>
              </div>
            )}

            {/* Formulario email/password */}
            <form onSubmit={handleSubmit} noValidate className="space-y-3">
              <div>
                <input
                  type="email" value={email}
                  onChange={e => { setEmail(e.target.value); if (authError) setAuthError(null) }}
                  onBlur={() => setTouched(p => ({ ...p, email: true }))}
                  placeholder="tu@empresa.com" autoComplete="email"
                  className={`w-full h-11 px-3.5 text-sm text-white placeholder:text-[#555]
                    bg-[#151515] rounded-lg border outline-none transition-all duration-150
                    focus:ring-1 focus:ring-[#29d4fc]/40 focus:border-[#29d4fc]/50
                    ${emailError ? 'border-red-500/40' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}
                />
                {emailError && (
                  <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />{emailError}
                  </p>
                )}
              </div>

              <div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => { setPassword(e.target.value); if (authError) setAuthError(null) }}
                    onBlur={() => setTouched(p => ({ ...p, password: true }))}
                    placeholder="Contraseña" autoComplete="current-password"
                    className={`w-full h-11 px-3.5 pr-10 text-sm text-white placeholder:text-[#555]
                      bg-[#151515] rounded-lg border outline-none transition-all duration-150
                      focus:ring-1 focus:ring-[#29d4fc]/40 focus:border-[#29d4fc]/50
                      ${passwordError ? 'border-red-500/40' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}
                  />
                  <button
                    type="button" tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#aaa] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />{passwordError}
                  </p>
                )}
              </div>

              <motion.button
                type="submit" disabled={loading || !!oauthLoading}
                whileHover={!loading ? { scale: 1.01 } : undefined}
                whileTap={!loading ? { scale: 0.98 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="w-full h-11 rounded-lg bg-[#29d4fc] text-black text-sm font-semibold
                           hover:bg-[#20c4ec] transition-colors cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Ingresando...' : 'Comenzar'}
              </motion.button>
            </form>

            {/* Separador Google */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[#2a2a2a]" />
              <span className="text-[10px] text-[#666] whitespace-nowrap">
                Usá tu cuenta corporativa de Google.
              </span>
              <div className="flex-1 h-px bg-[#2a2a2a]" />
            </div>

            {/* Botón Google */}
            <motion.button
              type="button" onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading || loading}
              whileHover={!oauthLoading ? { scale: 1.01 } : undefined}
              whileTap={!oauthLoading ? { scale: 0.98 } : undefined}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full h-11 rounded-lg bg-white flex items-center justify-center gap-2.5
                         text-black text-sm font-medium
                         hover:bg-gray-100 transition-colors cursor-pointer
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'google' ? (
                <span className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
              ) : (
                <>
                  <Image src="/google-g-logo.svg" alt="" width={16} height={16} />
                  Continuar con Google
                </>
              )}
            </motion.button>

            {/* Separador empresas */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[#2a2a2a]" />
              <span className="text-[10px] text-[#666]">o para empresas</span>
              <div className="flex-1 h-px bg-[#2a2a2a]" />
            </div>

            {/* Botón SSO */}
            <motion.button
              type="button" onClick={() => handleOAuth('azure')}
              disabled={!!oauthLoading || loading}
              whileHover={!oauthLoading ? { scale: 1.01 } : undefined}
              whileTap={!oauthLoading ? { scale: 0.98 } : undefined}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full h-11 rounded-lg bg-transparent border border-[#2a2a2a]
                         text-white text-sm font-medium
                         hover:bg-white/[0.04] hover:border-[#3a3a3a]
                         transition-all cursor-pointer
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'azure'
                ? 'Redirigiendo...'
                : 'Iniciar sesión con SSO'}
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* ── Columna ilustración (solo desktop) ── */}
      <div className="hidden md:block relative w-1/2 bg-[#0a0a0a]">
        <Image
          src="/login-illustration.png"
          alt="Heero"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
      </div>
    </div>
  )
}
