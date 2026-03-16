'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, AlertCircle, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

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

const formContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
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

// Traduce errores de Supabase al español
function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials'))
    return 'Email o contraseña incorrectos'
  if (message.includes('Email not confirmed'))
    return 'Necesitás confirmar tu email antes de ingresar'
  if (message.includes('Too many requests'))
    return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo'
  if (message.includes('User not found'))
    return 'No existe una cuenta con ese email'
  return 'Error al iniciar sesión. Intentá de nuevo'
}

// ─────────────────────────────────────────────
// Input con ícono
// ─────────────────────────────────────────────

interface FieldInputProps {
  id: string
  type: string
  value: string
  onChange: (val: string) => void
  onBlur: () => void
  placeholder: string
  autoComplete: string
  hasError: boolean
  isFilled: boolean
  icon: React.ReactNode
  rightElement?: React.ReactNode
}

function FieldInput({
  id,
  type,
  value,
  onChange,
  onBlur,
  placeholder,
  autoComplete,
  hasError,
  isFilled,
  icon,
  rightElement,
}: FieldInputProps) {
  return (
    <div className="relative">
      <div
        className={cn(
          'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-150',
          hasError
            ? 'text-red-400'
            : isFilled
              ? 'text-indigo-400'
              : 'text-white/25'
        )}
      >
        {icon}
      </div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn(
          'w-full h-10 text-sm text-white placeholder:text-white/25',
          'bg-surface-800/80 rounded-lg',
          'border transition-all duration-150',
          'outline-none',
          'focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50',
          rightElement ? 'pl-10 pr-10' : 'pl-10 pr-4',
          hasError
            ? 'border-red-500/40 bg-red-500/5'
            : 'border-white/[0.07] hover:border-white/15'
        )}
      />
      {rightElement && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {rightElement}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Mensaje de error de campo
// ─────────────────────────────────────────────

function FieldError({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          className="text-xs text-red-400 flex items-center gap-1"
        >
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────
// Página de login
// ─────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Campos tocados — activa validación en tiempo real al salir del campo
  const [touched, setTouched] = useState({ email: false, password: false })

  const emailError =
    touched.email && email && !isValidEmail(email)
      ? 'Ingresá un email válido'
      : null

  const passwordError =
    touched.password && password && !isValidPassword(password)
      ? 'La contraseña debe tener al menos 6 caracteres'
      : null

  const handleBlur = (field: 'email' | 'password') => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  const handleChange = (field: 'email' | 'password', value: string) => {
    if (field === 'email') setEmail(value)
    else setPassword(value)
    // Limpiar error global al escribir
    if (authError) setAuthError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Marcar todos los campos como tocados para mostrar errores
    setTouched({ email: true, password: true })

    if (!isValidEmail(email) || !isValidPassword(password)) return

    setLoading(true)
    setAuthError(null)

    try {
      const supabase = createClient()

      const {
        data: { user },
        error: signInError,
      } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInError) {
        setAuthError(translateAuthError(signInError.message))
        return
      }

      if (!user) {
        setAuthError('No se pudo obtener la sesión. Intentá de nuevo')
        return
      }

      // Obtener rol desde la tabla usuarios
      const { data: usuario, error: userError } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()

      if (userError || !usuario) {
        setAuthError(
          'No se encontró tu perfil. Contactá a tu administrador'
        )
        return
      }

      // Redirigir según rol
      router.push(usuario.rol === 'admin' ? '/admin' : '/empleado/perfil')
    } catch {
      setAuthError('Error inesperado. Intentá de nuevo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh gradient-bg flex items-center justify-center p-4">
      {/* Orb decorativo de fondo */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[280px] opacity-[0.15]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(59,79,216,0.8) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-[360px]"
      >
        {/* ── Logo y encabezado ── */}
        <motion.div variants={itemVariants} className="text-center mb-7">
          <motion.div
            className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-4 mx-auto"
            style={{
              background:
                'linear-gradient(135deg, rgba(59,79,216,0.3) 0%, rgba(107,124,240,0.15) 100%)',
              border: '1px solid rgba(59,79,216,0.4)',
              boxShadow: '0 0 24px rgba(59,79,216,0.2)',
            }}
            whileHover={{ scale: 1.05, rotate: 3 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <Zap className="w-5 h-5 text-indigo-400" fill="currentColor" />
          </motion.div>

          <h1 className="text-xl font-semibold tracking-tight text-white mb-1">
            OnboardAI
          </h1>
          <p className="text-sm text-white/40">
            Iniciá sesión para continuar
          </p>
        </motion.div>

        {/* ── Formulario ── */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-2xl p-5"
        >
          <motion.form
            onSubmit={handleSubmit}
            noValidate
            variants={formContainerVariants}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {/* Campo email */}
            <motion.div variants={itemVariants}>
              <label
                htmlFor="email"
                className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
              >
                Email
              </label>
              <FieldInput
                id="email"
                type="email"
                value={email}
                onChange={val => handleChange('email', val)}
                onBlur={() => handleBlur('email')}
                placeholder="tu@empresa.com"
                autoComplete="email"
                hasError={!!emailError}
                isFilled={!!email}
                icon={<Mail className="w-4 h-4" />}
              />
              <FieldError message={emailError} />
            </motion.div>

            {/* Campo contraseña */}
            <motion.div variants={itemVariants}>
              <label
                htmlFor="password"
                className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
              >
                Contraseña
              </label>
              <FieldInput
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={val => handleChange('password', val)}
                onBlur={() => handleBlur('password')}
                placeholder="••••••••"
                autoComplete="current-password"
                hasError={!!passwordError}
                isFilled={!!password}
                icon={<Lock className="w-4 h-4" />}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    className="text-white/30 hover:text-white/60 transition-colors duration-150"
                    aria-label={
                      showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
              />
              <FieldError message={passwordError} />
            </motion.div>

            {/* Error de autenticación */}
            <AnimatePresence>
              {authError && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300 leading-snug">{authError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botón submit */}
            <motion.div variants={itemVariants} className="pt-0.5">
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={loading}
                className="w-full"
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </motion.div>
          </motion.form>
        </motion.div>

        {/* Footer */}
        <motion.p
          variants={itemVariants}
          className="text-center text-[11px] text-white/25 mt-5 leading-relaxed"
        >
          ¿Problemas para ingresar?{' '}
          <span className="text-white/40">
            Contactá a tu administrador
          </span>
        </motion.p>
      </motion.div>
    </div>
  )
}
