'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, AlertCircle, Zap, User, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Animaciones (igual que login)
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

// Traduce errores al español
function translateRegisterError(message: string): string {
  if (message.includes('Ya existe una cuenta') || message.includes('already'))
    return 'Ya existe una cuenta con ese email'
  if (message.includes('contraseña'))
    return message
  if (message.includes('obligatorios'))
    return message
  return 'Error al crear la cuenta. Intentá de nuevo'
}

// ─────────────────────────────────────────────
// FieldInput — mismo que login
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
  id, type, value, onChange, onBlur, placeholder,
  autoComplete, hasError, isFilled, icon, rightElement,
}: FieldInputProps) {
  return (
    <div className="relative">
      <div className={cn(
        'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-150',
        hasError ? 'text-red-400' : isFilled ? 'text-indigo-400' : 'text-white/25'
      )}>
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
// FieldError — mismo que login
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
// Página de registro
// ─────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter()

  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Campos tocados — activa validación en tiempo real al salir del campo
  const [touched, setTouched] = useState({
    nombreEmpresa: false,
    nombre: false,
    email: false,
    password: false,
  })

  const empresaError =
    touched.nombreEmpresa && !nombreEmpresa.trim()
      ? 'El nombre de la empresa es obligatorio'
      : null

  const nombreError =
    touched.nombre && !nombre.trim()
      ? 'Tu nombre es obligatorio'
      : null

  const emailError =
    touched.email && email && !isValidEmail(email)
      ? 'Ingresá un email válido'
      : touched.email && !email
        ? 'El email es obligatorio'
        : null

  const passwordError =
    touched.password && password && password.length < 8
      ? 'La contraseña debe tener al menos 8 caracteres'
      : touched.password && !password
        ? 'La contraseña es obligatoria'
        : null

  const handleBlur = (field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  const handleChange = (field: keyof typeof touched, value: string) => {
    if (field === 'nombreEmpresa') setNombreEmpresa(value)
    else if (field === 'nombre') setNombre(value)
    else if (field === 'email') setEmail(value)
    else setPassword(value)
    if (authError) setAuthError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Marcar todos como tocados
    setTouched({ nombreEmpresa: true, nombre: true, email: true, password: true })

    // Validar antes de enviar
    if (
      !nombreEmpresa.trim() ||
      !nombre.trim() ||
      !isValidEmail(email) ||
      password.length < 8
    ) return

    setLoading(true)
    setAuthError(null)

    try {
      // 1. Crear cuenta + empresa vía API route (service role)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          nombre: nombre.trim(),
          nombreEmpresa: nombreEmpresa.trim(),
        }),
      })

      const data = await res.json() as { ok?: boolean; error?: string }

      if (!res.ok) {
        setAuthError(translateRegisterError(data.error ?? 'Error desconocido'))
        return
      }

      // 2. Iniciar sesión con las credenciales recién creadas
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInError) {
        setAuthError('Cuenta creada, pero no se pudo iniciar sesión. Usá la pantalla de login.')
        return
      }

      // 3. Redirigir al wizard de setup
      router.push('/admin/setup')
    } catch {
      setAuthError('Error inesperado. Intentá de nuevo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh gradient-bg flex items-center justify-center p-4">
      {/* Orb decorativo */}
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
        className="w-full max-w-[380px]"
      >
        {/* Logo y encabezado */}
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
            Registrá tu empresa
          </h1>
          <p className="text-sm text-white/40">
            Creá tu cuenta de OnboardAI en segundos
          </p>
        </motion.div>

        {/* Formulario */}
        <motion.div variants={itemVariants} className="glass-card rounded-2xl p-5">
          <motion.form
            onSubmit={handleSubmit}
            noValidate
            variants={formContainerVariants}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {/* Nombre de la empresa */}
            <motion.div variants={itemVariants}>
              <label
                htmlFor="nombreEmpresa"
                className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
              >
                Nombre de la empresa
              </label>
              <FieldInput
                id="nombreEmpresa"
                type="text"
                value={nombreEmpresa}
                onChange={val => handleChange('nombreEmpresa', val)}
                onBlur={() => handleBlur('nombreEmpresa')}
                placeholder="Acme S.A."
                autoComplete="organization"
                hasError={!!empresaError}
                isFilled={!!nombreEmpresa}
                icon={<Building2 className="w-4 h-4" />}
              />
              <FieldError message={empresaError} />
            </motion.div>

            {/* Tu nombre */}
            <motion.div variants={itemVariants}>
              <label
                htmlFor="nombre"
                className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
              >
                Tu nombre completo
              </label>
              <FieldInput
                id="nombre"
                type="text"
                value={nombre}
                onChange={val => handleChange('nombre', val)}
                onBlur={() => handleBlur('nombre')}
                placeholder="Juan García"
                autoComplete="name"
                hasError={!!nombreError}
                isFilled={!!nombre}
                icon={<User className="w-4 h-4" />}
              />
              <FieldError message={nombreError} />
            </motion.div>

            {/* Email */}
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
                placeholder="vos@empresa.com"
                autoComplete="email"
                hasError={!!emailError}
                isFilled={!!email}
                icon={<Mail className="w-4 h-4" />}
              />
              <FieldError message={emailError} />
            </motion.div>

            {/* Contraseña */}
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
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                hasError={!!passwordError}
                isFilled={!!password}
                icon={<Lock className="w-4 h-4" />}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    className="text-white/30 hover:text-white/60 transition-colors duration-150"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
              <FieldError message={passwordError} />
            </motion.div>

            {/* Error global */}
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
                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              </Button>
            </motion.div>
          </motion.form>
        </motion.div>

        {/* Link al login */}
        <motion.p
          variants={itemVariants}
          className="text-center text-[11px] text-white/25 mt-5 leading-relaxed"
        >
          ¿Ya tenés cuenta?{' '}
          <Link
            href="/auth/login"
            className="text-indigo-400/70 hover:text-indigo-300 transition-colors duration-150"
          >
            Iniciá sesión
          </Link>
        </motion.p>
      </motion.div>
    </div>
  )
}
