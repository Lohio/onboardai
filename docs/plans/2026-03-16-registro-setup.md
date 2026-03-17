# Registro y Setup Inicial de Empresas — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Crear el flujo completo de registro de nuevas empresas y el wizard de setup inicial de 4 pasos para que el admin configure su empresa antes de usar el panel.

**Architecture:** API route server-side para el registro (evita problemas de RLS al insertar empresa + usuario admin por primera vez usando service role key). El wizard vive en `/admin/setup` dentro del layout admin existente. El middleware detecta si el admin completó el setup y redirige si no lo hizo.

**Tech Stack:** Next.js 14 App Router, Supabase (service role para registro), Framer Motion, Tailwind CSS, `@/components/ui/Button`, `@/lib/contacto` (HerramientaContacto), `@/lib/supabase`.

---

## CONTEXTO CLAVE (leer antes de implementar)

- El login vive en `src/app/auth/login/page.tsx` — replicar exactamente su estilo: `glass-card`, gradiente de fondo, `FieldInput`, `FieldError`, `translateAuthError`, animaciones con `containerVariants`/`itemVariants`.
- El middleware `src/middleware.ts` cachea el rol en cookie `onboard_rol`. Sigue el mismo patrón para la cookie `onboard_setup`.
- La tabla `empresas` ya tiene RLS habilitado (ver `scripts/roles.sql` líneas 384-405). Solo admin/dev puede UPDATE. No tiene política INSERT → el registro usa service role key que bypasea RLS.
- La tabla `conocimiento` ya tiene RLS: admin puede INSERT para su empresa.
- El API route `src/app/api/admin/empleados/route.ts` ya maneja creación de empleados con service role — **reusar exactamente** este patrón para el registro.
- `HerramientaContacto` type y `HERRAMIENTA_LABELS` están en `src/lib/contacto.ts`.
- El componente `Button` acepta `variant: 'primary' | 'ghost' | 'secondary' | 'danger'`, `size: 'sm' | 'md' | 'lg'`, `loading: boolean`.
- **CRÍTICO**: `createClient()` siempre dentro de callbacks/handlers, nunca a nivel de componente.

---

### Task 1: SQL migration — columnas de setup en empresas

**Files:**
- Modify: `scripts/roles.sql` (append al final)

**Step 1: Agregar columnas al final de roles.sql**

Abrir `scripts/roles.sql` y agregar al final (después de la línea `-- Fin del script`):

```sql
-- ══════════════════════════════════════════════════════════════
-- 14. SETUP INICIAL DE EMPRESA
--     setup_completo: false hasta que el admin complete el wizard
--     industria, tamano: datos recopilados en el paso 1
--     logo_url: URL del logo en Supabase Storage (paso 1, opcional)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS setup_completo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS industria      text,
  ADD COLUMN IF NOT EXISTS tamano         text;

-- logo_url ya puede existir o no; la agregamos con IF NOT EXISTS
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS logo_url text;
```

**Step 2: Verificar el archivo guardado correctamente**

```bash
tail -20 scripts/roles.sql
```
Expected: ver las 4 líneas ALTER TABLE con las nuevas columnas.

**Step 3: Ejecutar en Supabase**

Copiar el bloque SQL del paso 1 y ejecutarlo en el SQL Editor de Supabase Dashboard. No hay comando de terminal para esto — es manual.

**Step 4: Commit**

```bash
git add scripts/roles.sql
git commit -m "feat: add setup columns to empresas table"
```

---

### Task 2: API route de registro — POST /api/auth/register

**Files:**
- Create: `src/app/api/auth/register/route.ts`

**Step 1: Crear el directorio y el archivo**

```bash
mkdir -p src/app/api/auth/register
```

**Step 2: Crear `src/app/api/auth/register/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────
// POST /api/auth/register
// Registra una nueva empresa y su admin inicial.
// Usa service role key para bypasear RLS en la
// primera inserción (no hay admin aún).
// ─────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email: string
      password: string
      nombre: string
      nombreEmpresa: string
    }

    const { email, password, nombre, nombreEmpresa } = body

    // Validaciones básicas
    if (!email || !password || !nombre || !nombreEmpresa) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios' },
        { status: 400 }
      )
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      )
    }

    // Cliente con service role (bypasea RLS)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta' },
        { status: 500 }
      )
    }

    const sa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Crear auth user
    const { data: authData, error: authError } = await sa.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // sin verificación de email
    })

    if (authError) {
      if (authError.message.includes('already been registered') ||
          authError.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'Ya existe una cuenta con ese email' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    // 2. Generar slug de la empresa
    const slug = nombreEmpresa
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    // 3. Crear empresa
    const { data: empresa, error: empresaError } = await sa
      .from('empresas')
      .insert({ nombre: nombreEmpresa.trim(), slug })
      .select('id')
      .single()

    if (empresaError) {
      // Rollback: eliminar auth user
      await sa.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Error al crear la empresa: ' + empresaError.message },
        { status: 500 }
      )
    }

    // 4. Crear usuario admin
    const { error: usuarioError } = await sa
      .from('usuarios')
      .insert({
        id: userId,
        empresa_id: empresa.id,
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        rol: 'admin',
      })

    if (usuarioError) {
      // Rollback: eliminar empresa y auth user
      await sa.from('empresas').delete().eq('id', empresa.id)
      await sa.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Error al crear el perfil: ' + usuarioError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('[register] Error inesperado:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

**Step 3: Verificar compilación**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: sin errores TypeScript.

**Step 4: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "feat: add register API route with service role"
```

---

### Task 3: Página de registro — /auth/register

**Files:**
- Create: `src/app/auth/register/page.tsx`

**Step 1: Crear el directorio**

```bash
mkdir -p src/app/auth/register
```

**Step 2: Crear `src/app/auth/register/page.tsx`**

Replicar exactamente el estilo de `src/app/auth/login/page.tsx`. Reutilizar `FieldInput`, `FieldError`, `translateAuthError` — copiarlos al inicio del archivo ya que son helpers locales.

```typescript
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

  // Campos tocados para validación inline on blur
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
```

**Step 3: Verificar compilación**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: sin errores.

**Step 4: Commit**

```bash
git add src/app/auth/register/page.tsx
git commit -m "feat: add register page for new companies"
```

---

### Task 4: Actualizar login — agregar link a registro

**Files:**
- Modify: `src/app/auth/login/page.tsx` (solo el footer)

**Step 1: Agregar import de Link y actualizar el footer**

Leer `src/app/auth/login/page.tsx`. Buscar el bloque del footer (al final del return):

```tsx
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
```

Reemplazarlo con:

```tsx
        {/* Footer */}
        <motion.div
          variants={itemVariants}
          className="mt-5 space-y-2 text-center"
        >
          <p className="text-[11px] text-white/25 leading-relaxed">
            ¿Problemas para ingresar?{' '}
            <span className="text-white/40">
              Contactá a tu administrador
            </span>
          </p>
          <p className="text-[11px] text-white/25 leading-relaxed">
            ¿Primera vez?{' '}
            <Link
              href="/auth/register"
              className="text-indigo-400/70 hover:text-indigo-300 transition-colors duration-150"
            >
              Registrá tu empresa
            </Link>
          </p>
        </motion.div>
```

También agregar `import Link from 'next/link'` al bloque de imports (después de `import { Button } from '@/components/ui/Button'`).

**Step 2: Build para confirmar que compila**

```bash
npm run build 2>&1 | grep -E "error|Error|✓" | head -10
```
Expected: `✓ Compiled successfully`

**Step 3: Commit**

```bash
git add src/app/auth/login/page.tsx
git commit -m "feat: add register link to login page"
```

---

### Task 5: Stepper component y setup page shell

**Files:**
- Create: `src/components/admin/setup/Stepper.tsx`
- Create: `src/app/admin/setup/page.tsx`

**Step 1: Crear directorio de componentes del wizard**

```bash
mkdir -p src/components/admin/setup
mkdir -p src/app/admin/setup
```

**Step 2: Crear `src/components/admin/setup/Stepper.tsx`**

```typescript
'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Stepper horizontal para el wizard de setup
// ─────────────────────────────────────────────

interface Step {
  label: string
}

interface StepperProps {
  steps: Step[]
  currentStep: number // 0-based
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex items-center gap-0 w-full max-w-lg mx-auto mb-8">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isActive = index === currentStep
        const isLast = index === steps.length - 1

        return (
          <div key={index} className="flex items-center flex-1 last:flex-none">
            {/* Círculo del paso */}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  'text-sm font-semibold transition-all duration-300',
                  isCompleted
                    ? 'bg-teal-500 text-white'
                    : isActive
                      ? 'bg-indigo-600 text-white shadow-[0_0_16px_rgba(59,79,216,0.4)]'
                      : 'bg-white/[0.06] text-white/30'
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium tracking-wide whitespace-nowrap',
                  isCompleted
                    ? 'text-teal-400'
                    : isActive
                      ? 'text-indigo-300'
                      : 'text-white/25'
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Línea conectora (excepto después del último paso) */}
            {!isLast && (
              <div
                className={cn(
                  'h-[1px] flex-1 mx-2 mb-5 transition-all duration-300',
                  isCompleted ? 'bg-teal-500/50' : 'bg-white/[0.07]'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

**Step 3: Crear `src/app/admin/setup/page.tsx`**

Esta es la página orquestadora del wizard. Importa los 4 steps (se crearán en el Task 6 y 7).

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Stepper } from '@/components/admin/setup/Stepper'
import { Step1Empresa } from '@/components/admin/setup/Step1Empresa'
import { Step2Cultura } from '@/components/admin/setup/Step2Cultura'
import { Step3Contacto } from '@/components/admin/setup/Step3Contacto'
import { Step4Empleado } from '@/components/admin/setup/Step4Empleado'

// ─────────────────────────────────────────────
// Datos compartidos entre pasos
// ─────────────────────────────────────────────

export interface SetupData {
  empresaId: string
  empresaNombre: string
  adminId: string
}

// ─────────────────────────────────────────────
// Variantes de animación entre pasos
// ─────────────────────────────────────────────

const stepVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
}

// ─────────────────────────────────────────────
// Pasos del wizard
// ─────────────────────────────────────────────

const STEPS = [
  { label: 'Empresa' },
  { label: 'Cultura' },
  { label: 'Contacto' },
  { label: 'Primer empleado' },
]

// ─────────────────────────────────────────────
// Página principal del setup
// ─────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [cargando, setCargando] = useState(true)

  // Cargar datos del admin/empresa actual
  const cargarDatos = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: usuario, error } = await supabase
        .from('usuarios')
        .select('empresa_id, nombre')
        .eq('id', user.id)
        .single()

      if (error || !usuario) { router.push('/auth/login'); return }

      const { data: empresa, error: empError } = await supabase
        .from('empresas')
        .select('id, nombre, setup_completo')
        .eq('id', usuario.empresa_id)
        .single()

      if (empError || !empresa) { router.push('/admin'); return }

      // Si ya completó el setup, redirigir
      if (empresa.setup_completo) {
        router.push('/admin')
        return
      }

      // Verificar si ya se completó antes (localStorage)
      if (typeof window !== 'undefined' &&
          localStorage.getItem('onboarding_setup_completo') === 'true') {
        router.push('/admin')
        return
      }

      setSetupData({
        empresaId: empresa.id,
        empresaNombre: empresa.nombre,
        adminId: user.id,
      })
    } catch (err) {
      console.error('[setup] Error cargando datos:', err)
      router.push('/admin')
    } finally {
      setCargando(false)
    }
  }, [router])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // Llamado cuando se completa el último paso o se omite
  const handleFinish = useCallback(async () => {
    if (!setupData) return

    try {
      const supabase = createClient()
      // Marcar setup como completo en la empresa
      await supabase
        .from('empresas')
        .update({ setup_completo: true })
        .eq('id', setupData.empresaId)
    } catch {
      // No es crítico — continuar igual
    }

    // Persistir en localStorage para evitar re-mostrar
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding_setup_completo', 'true')
    }

    toast.success('¡Setup completo! Bienvenido a OnboardAI')
    router.push('/admin')
  }, [setupData, router])

  const nextStep = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1)
    } else {
      handleFinish()
    }
  }, [currentStep, handleFinish])

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin-fast" />
          <span className="text-sm text-white/40">Cargando...</span>
        </div>
      </div>
    )
  }

  if (!setupData) return null

  return (
    <div className="max-w-2xl mx-auto py-6 px-2">
      {/* Stepper de progreso */}
      <Stepper steps={STEPS} currentStep={currentStep} />

      {/* Contenido del paso activo */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          {currentStep === 0 && (
            <Step1Empresa setupData={setupData} onNext={nextStep} />
          )}
          {currentStep === 1 && (
            <Step2Cultura setupData={setupData} onNext={nextStep} onSkip={nextStep} />
          )}
          {currentStep === 2 && (
            <Step3Contacto setupData={setupData} onNext={nextStep} onSkip={nextStep} />
          )}
          {currentStep === 3 && (
            <Step4Empleado setupData={setupData} onFinish={handleFinish} onSkip={handleFinish} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
```

**Step 4: Verificar que TypeScript no se queja de los imports (aunque los steps no existen aún)**

Los imports fallarán en el build hasta que se creen. Continuar al siguiente task.

**Step 5: Commit**

```bash
git add src/components/admin/setup/Stepper.tsx src/app/admin/setup/page.tsx
git commit -m "feat: add setup page shell and Stepper component"
```

---

### Task 6: Step 1 (Empresa) y Step 2 (Cultura)

**Files:**
- Create: `src/components/admin/setup/Step1Empresa.tsx`
- Create: `src/components/admin/setup/Step2Cultura.tsx`

**Step 1: Crear `src/components/admin/setup/Step1Empresa.tsx`**

```typescript
'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Building2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { SetupData } from '@/app/admin/setup/page'

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

const INDUSTRIAS = [
  'Tecnología', 'Logística', 'Retail', 'Salud',
  'Educación', 'Servicios', 'Manufactura', 'Otro',
]

const TAMANOS = ['1-10', '11-50', '51-200', '200+']

// ─────────────────────────────────────────────
// Estilos compartidos de select e input
// ─────────────────────────────────────────────

const inputCls = [
  'w-full h-10 text-sm text-white placeholder:text-white/25',
  'bg-surface-800/80 rounded-lg px-3',
  'border border-white/[0.07] hover:border-white/15',
  'transition-all duration-150 outline-none',
  'focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50',
].join(' ')

const selectCls = [
  'w-full h-10 text-sm text-white appearance-none cursor-pointer',
  'bg-surface-800/80 rounded-lg pl-3 pr-8',
  'border border-white/[0.07] hover:border-white/15',
  'transition-all duration-150 outline-none',
  'focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50',
].join(' ')

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────

interface Step1Props {
  setupData: SetupData
  onNext: () => void
}

export function Step1Empresa({ setupData, onNext }: Step1Props) {
  const [nombre, setNombre] = useState(setupData.empresaNombre)
  const [industria, setIndustria] = useState('')
  const [tamano, setTamano] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Iniciales para el avatar placeholder
  const iniciales = nombre
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  const handleLogoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen')
      return
    }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!nombre.trim()) {
      toast.error('El nombre de la empresa es obligatorio')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const updates: Record<string, string | boolean> = {
        nombre: nombre.trim(),
        ...(industria && { industria }),
        ...(tamano && { tamano }),
      }

      // Subir logo si se eligió uno
      if (logoFile) {
        const ext = logoFile.name.split('.').pop() ?? 'png'
        const path = `logos/${setupData.empresaId}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, logoFile, { upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(path)
          updates.logo_url = urlData.publicUrl
        } else {
          console.warn('[setup] Error subiendo logo:', uploadError.message)
          // Continuar sin logo — no es crítico
        }
      }

      const { error } = await supabase
        .from('empresas')
        .update(updates)
        .eq('id', setupData.empresaId)

      if (error) throw new Error(error.message)

      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [nombre, industria, tamano, logoFile, setupData.empresaId, onNext])

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8">
      {/* Ícono decorativo */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30
          flex items-center justify-center mb-4
          shadow-[0_0_32px_rgba(59,79,216,0.2)]">
          <Building2 className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-1">Tu empresa</h2>
        <p className="text-sm text-white/45 max-w-sm">
          Completá los datos básicos de tu organización
        </p>
      </div>

      <div className="space-y-5">
        {/* Logo */}
        <div>
          <label className="block text-[11px] font-medium text-white/45 mb-3 tracking-widest uppercase">
            Logo (opcional)
          </label>
          <div className="flex items-center gap-4">
            {/* Preview */}
            <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden
              border border-white/[0.08] bg-surface-700 flex items-center justify-center">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-indigo-300">{iniciales}</span>
              )}
            </div>

            {/* Input file */}
            <label className="flex-1 cursor-pointer">
              <div className={cn(
                inputCls,
                'flex items-center text-white/35 cursor-pointer h-10'
              )}>
                {logoFile ? logoFile.name : 'Subir imagen...'}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="sr-only"
              />
            </label>
          </div>
        </div>

        {/* Nombre de la empresa */}
        <div>
          <label
            htmlFor="s1-nombre"
            className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
          >
            Nombre de la empresa
          </label>
          <input
            id="s1-nombre"
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Acme S.A."
            className={inputCls}
          />
        </div>

        {/* Industria */}
        <div>
          <label
            htmlFor="s1-industria"
            className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
          >
            Industria
          </label>
          <div className="relative">
            <select
              id="s1-industria"
              value={industria}
              onChange={e => setIndustria(e.target.value)}
              className={cn(selectCls, !industria && 'text-white/30')}
            >
              <option value="" disabled>Seleccioná una industria</option>
              {INDUSTRIAS.map(i => (
                <option key={i} value={i} className="bg-[#0f1f3d]">{i}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          </div>
        </div>

        {/* Tamaño */}
        <div>
          <label
            htmlFor="s1-tamano"
            className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
          >
            Cantidad de empleados
          </label>
          <div className="relative">
            <select
              id="s1-tamano"
              value={tamano}
              onChange={e => setTamano(e.target.value)}
              className={cn(selectCls, !tamano && 'text-white/30')}
            >
              <option value="" disabled>Seleccioná un rango</option>
              {TAMANOS.map(t => (
                <option key={t} value={t} className="bg-[#0f1f3d]">{t}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Botón continuar (paso 1 no se puede omitir) */}
      <div className="mt-8">
        <Button
          variant="primary"
          size="md"
          loading={saving}
          onClick={handleSubmit}
          className="w-full"
        >
          {saving ? 'Guardando...' : 'Continuar'}
        </Button>
      </div>
    </div>
  )
}
```

**Step 2: Crear `src/components/admin/setup/Step2Cultura.tsx`**

```typescript
'use client'

import { useState, useCallback } from 'react'
import { Lightbulb } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import type { SetupData } from '@/app/admin/setup/page'

// ─────────────────────────────────────────────
// Campos de cultura
// ─────────────────────────────────────────────

const CAMPOS = [
  {
    key: 'historia',
    label: 'Historia y misión',
    titulo: 'Historia de la empresa',
    placeholder: '¿Cuándo y cómo nació la empresa?\n¿Cuál es su propósito?',
  },
  {
    key: 'valores',
    label: 'Valores y cultura',
    titulo: 'Valores y cultura',
    placeholder: '¿Qué valores guían el trabajo?\n¿Cómo es el ambiente laboral?',
  },
  {
    key: 'como_trabajamos',
    label: 'Cómo trabajamos',
    titulo: 'Cómo trabajamos',
    placeholder: '¿Cuál es la modalidad? ¿Cómo se organizan los equipos?\n¿Qué herramientas usan?',
  },
] as const

const textareaCls = [
  'w-full min-h-[100px] text-sm text-white placeholder:text-white/25',
  'bg-surface-800/80 rounded-lg p-3 resize-none',
  'border border-white/[0.07] hover:border-white/15',
  'transition-all duration-150 outline-none',
  'focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50',
].join(' ')

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────

interface Step2Props {
  setupData: SetupData
  onNext: () => void
  onSkip: () => void
}

export function Step2Cultura({ setupData, onNext, onSkip }: Step2Props) {
  const [valores, setValores] = useState<Record<string, string>>({
    historia: '', valores: '', como_trabajamos: '',
  })
  const [saving, setSaving] = useState(false)

  const handleContinuar = useCallback(async () => {
    // Filtrar campos con contenido
    const conContenido = CAMPOS.filter(c => valores[c.key]?.trim())

    if (conContenido.length === 0) {
      // Sin contenido es como omitir
      onNext()
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()

      const inserts = conContenido.map(campo => ({
        empresa_id: setupData.empresaId,
        modulo: 'cultura',
        bloque: campo.key,
        titulo: campo.titulo,
        contenido: valores[campo.key].trim(),
      }))

      const { error } = await supabase
        .from('conocimiento')
        .insert(inserts)

      if (error) throw new Error(error.message)

      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [valores, setupData.empresaId, onNext])

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8">
      {/* Ícono y título */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/30
          flex items-center justify-center mb-4
          shadow-[0_0_32px_rgba(13,148,136,0.2)]">
          <Lightbulb className="w-8 h-8 text-teal-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-1">Cultura e identidad</h2>
        <p className="text-sm text-white/45 max-w-sm">
          Este contenido es lo que el asistente IA usará para responder
          preguntas de tus empleados.
        </p>
      </div>

      <div className="space-y-5">
        {CAMPOS.map(campo => (
          <div key={campo.key}>
            <label className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase">
              {campo.label}
            </label>
            <textarea
              value={valores[campo.key]}
              onChange={e => setValores(prev => ({ ...prev, [campo.key]: e.target.value }))}
              placeholder={campo.placeholder}
              className={textareaCls}
              rows={4}
            />
          </div>
        ))}
      </div>

      {/* Botones */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Button
          variant="primary"
          size="md"
          loading={saving}
          onClick={handleContinuar}
          className="flex-1"
        >
          {saving ? 'Guardando...' : 'Continuar'}
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={onSkip}
          disabled={saving}
          className="flex-1 sm:flex-none"
        >
          Omitir por ahora
        </Button>
      </div>
    </div>
  )
}
```

**Step 3: Verificar compilación**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: solo errores de imports faltantes (Step3 y Step4 aún no existen) — OK.

**Step 4: Commit**

```bash
git add src/components/admin/setup/Step1Empresa.tsx src/components/admin/setup/Step2Cultura.tsx
git commit -m "feat: add setup wizard steps 1 and 2"
```

---

### Task 7: Step 3 (Contacto) y Step 4 (Primer empleado)

**Files:**
- Create: `src/components/admin/setup/Step3Contacto.tsx`
- Create: `src/components/admin/setup/Step4Empleado.tsx`

**Step 1: Crear `src/components/admin/setup/Step3Contacto.tsx`**

Reusar los íconos inline de `src/app/admin/configuracion/page.tsx`.

```typescript
'use client'

import { useState, useCallback } from 'react'
import { Mail, Video, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { HERRAMIENTA_LABELS, type HerramientaContacto } from '@/lib/contacto'
import type { SetupData } from '@/app/admin/setup/page'

// ─────────────────────────────────────────────
// Íconos (copiados de configuracion/page.tsx)
// ─────────────────────────────────────────────

function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'w-5 h-5'} fill="currentColor" aria-hidden>
      <path d="M19.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM14 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm4.5 1H17a5 5 0 0 1 1 3H22a1 1 0 0 0 1-1v-.5c0-.83-.67-1.5-1.5-1.5zM13 9H8a2 2 0 0 0-2 2v5.5A4.5 4.5 0 0 0 10.5 21h3a4.5 4.5 0 0 0 4.5-4.5V11a2 2 0 0 0-2-2z" />
    </svg>
  )
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'w-5 h-5'} fill="currentColor" aria-hidden>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.27 0a2.527 2.527 0 0 1 2.52-2.52 2.527 2.527 0 0 1 2.52 2.52v6.313A2.528 2.528 0 0 1 8.833 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.52-10.12a2.528 2.528 0 0 1-2.52-2.523A2.527 2.527 0 0 1 8.833 0a2.528 2.528 0 0 1 2.52 2.522v2.52H8.833zm0 1.272a2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522H2.522A2.528 2.528 0 0 1 0 8.837a2.528 2.528 0 0 1 2.522-2.52h6.311zm10.122 2.52a2.528 2.528 0 0 1 2.522-2.52A2.528 2.528 0 0 1 24 8.837a2.528 2.528 0 0 1-2.522 2.522h-2.52V8.837zm-1.268 0a2.528 2.528 0 0 1-2.523 2.522 2.527 2.527 0 0 1-2.52-2.522V2.522A2.527 2.527 0 0 1 15.167 0a2.528 2.528 0 0 1 2.523 2.522v6.315zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.167 24a2.527 2.527 0 0 1-2.52-2.522v-2.52h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'w-5 h-5'} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

function HerramientaIcon({ h, cls = 'w-5 h-5' }: { h: HerramientaContacto; cls?: string }) {
  if (h === 'teams')    return <TeamsIcon className={cls} />
  if (h === 'slack')    return <SlackIcon className={cls} />
  if (h === 'whatsapp') return <WhatsAppIcon className={cls} />
  if (h === 'meet')     return <Video className={cls} />
  return <Mail className={cls} />
}

// ─────────────────────────────────────────────
// Opciones
// ─────────────────────────────────────────────

const OPCIONES: { value: HerramientaContacto; desc: string }[] = [
  { value: 'email',    desc: 'Abre el cliente de correo' },
  { value: 'teams',    desc: 'Abre un chat en Microsoft Teams' },
  { value: 'slack',    desc: 'Copia el email para buscar en Slack' },
  { value: 'whatsapp', desc: 'Copia el email para coordinar por WhatsApp' },
  { value: 'meet',     desc: 'Envía un email para coordinar reunión' },
]

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────

interface Step3Props {
  setupData: SetupData
  onNext: () => void
  onSkip: () => void
}

export function Step3Contacto({ setupData, onNext, onSkip }: Step3Props) {
  const [seleccionada, setSeleccionada] = useState<HerramientaContacto>('email')
  const [saving, setSaving] = useState(false)

  const handleContinuar = useCallback(async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('empresas')
        .update({ herramienta_contacto: seleccionada })
        .eq('id', setupData.empresaId)

      if (error) throw new Error(error.message)
      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [seleccionada, setupData.empresaId, onNext])

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8">
      {/* Ícono y título */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30
          flex items-center justify-center mb-4
          shadow-[0_0_32px_rgba(59,79,216,0.2)]">
          <MessageSquare className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-1">Herramienta de contacto</h2>
        <p className="text-sm text-white/45 max-w-sm">
          Elegí cómo van a poder contactar a sus compañeros los empleados desde OnboardAI
        </p>
      </div>

      {/* Radio cards */}
      <div className="space-y-2">
        {OPCIONES.map(opcion => {
          const isSelected = seleccionada === opcion.value
          return (
            <label
              key={opcion.value}
              className={cn(
                'flex items-center gap-4 p-4 rounded-xl cursor-pointer',
                'border transition-all duration-150',
                isSelected
                  ? 'border-indigo-500/50 bg-indigo-500/10'
                  : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.03]'
              )}
            >
              <input
                type="radio"
                name="herramienta"
                value={opcion.value}
                checked={isSelected}
                onChange={() => setSeleccionada(opcion.value)}
                className="sr-only"
              />

              {/* Ícono de la herramienta */}
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                isSelected
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'bg-white/[0.05] text-white/40'
              )}>
                <HerramientaIcon h={opcion.value} cls="w-5 h-5" />
              </div>

              {/* Nombre y descripción */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium',
                  isSelected ? 'text-white' : 'text-white/70'
                )}>
                  {HERRAMIENTA_LABELS[opcion.value]}
                </p>
                <p className="text-xs text-white/35 mt-0.5">{opcion.desc}</p>
              </div>

              {/* Indicador de selección */}
              <div className={cn(
                'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all duration-150',
                isSelected
                  ? 'border-indigo-400 bg-indigo-400'
                  : 'border-white/20 bg-transparent'
              )} />
            </label>
          )
        })}
      </div>

      {/* Botones */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Button
          variant="primary"
          size="md"
          loading={saving}
          onClick={handleContinuar}
          className="flex-1"
        >
          {saving ? 'Guardando...' : 'Continuar'}
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={onSkip}
          disabled={saving}
          className="flex-1 sm:flex-none"
        >
          Omitir por ahora
        </Button>
      </div>
    </div>
  )
}
```

**Step 2: Crear `src/components/admin/setup/Step4Empleado.tsx`**

```typescript
'use client'

import { useState, useCallback } from 'react'
import { UserPlus, AlertCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { SetupData } from '@/app/admin/setup/page'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function randomPassword(len = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  return Array.from({ length: len }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

const inputCls = [
  'w-full h-10 text-sm text-white placeholder:text-white/25',
  'bg-surface-800/80 rounded-lg px-3',
  'border border-white/[0.07] hover:border-white/15',
  'transition-all duration-150 outline-none',
  'focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50',
].join(' ')

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────

interface Step4Props {
  setupData: SetupData
  onFinish: () => void
  onSkip: () => void
}

export function Step4Empleado({ onFinish, onSkip }: Step4Props) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [puesto, setPuesto] = useState('')
  const [fechaIngreso, setFechaIngreso] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [touched, setTouched] = useState({ nombre: false, email: false })

  const nombreError = touched.nombre && !nombre.trim() ? 'El nombre es obligatorio' : null
  const emailError = touched.email && !isValidEmail(email) ? 'Ingresá un email válido' : null

  const handleInvitar = useCallback(async () => {
    setTouched({ nombre: true, email: true })
    if (!nombre.trim() || !isValidEmail(email)) return

    setSaving(true)
    setError(null)

    try {
      const password = randomPassword()

      const res = await fetch('/api/admin/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          password,
          puesto: puesto.trim() || undefined,
          fecha_ingreso: fechaIngreso || undefined,
        }),
      })

      const data = await res.json() as { usuario?: unknown; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Error al crear el empleado')
        return
      }

      toast.success(`¡${nombre} fue invitado exitosamente!`)
      onFinish()
    } catch {
      setError('Error inesperado. Intentá de nuevo')
    } finally {
      setSaving(false)
    }
  }, [nombre, email, puesto, fechaIngreso, onFinish])

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8">
      {/* Ícono y título */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/30
          flex items-center justify-center mb-4
          shadow-[0_0_32px_rgba(13,148,136,0.2)]">
          <UserPlus className="w-8 h-8 text-teal-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-1">
          Invitá a tu primer empleado
        </h2>
        <p className="text-sm text-white/45 max-w-sm">
          Podés agregar más empleados después desde el panel.
        </p>
      </div>

      <div className="space-y-4">
        {/* Nombre */}
        <div>
          <label
            htmlFor="s4-nombre"
            className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
          >
            Nombre completo *
          </label>
          <input
            id="s4-nombre"
            type="text"
            value={nombre}
            onChange={e => { setNombre(e.target.value); if (error) setError(null) }}
            onBlur={() => setTouched(p => ({ ...p, nombre: true }))}
            placeholder="María González"
            className={cn(inputCls, nombreError && 'border-red-500/40 bg-red-500/5')}
          />
          <AnimatePresence>
            {nombreError && (
              <motion.p
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="text-xs text-red-400 flex items-center gap-1"
              >
                <AlertCircle className="w-3 h-3" />
                {nombreError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="s4-email"
            className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
          >
            Email *
          </label>
          <input
            id="s4-email"
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (error) setError(null) }}
            onBlur={() => setTouched(p => ({ ...p, email: true }))}
            placeholder="maria@empresa.com"
            className={cn(inputCls, emailError && 'border-red-500/40 bg-red-500/5')}
          />
          <AnimatePresence>
            {emailError && (
              <motion.p
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="text-xs text-red-400 flex items-center gap-1"
              >
                <AlertCircle className="w-3 h-3" />
                {emailError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Puesto (opcional) */}
        <div>
          <label
            htmlFor="s4-puesto"
            className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
          >
            Puesto <span className="text-white/20 normal-case tracking-normal">(opcional)</span>
          </label>
          <input
            id="s4-puesto"
            type="text"
            value={puesto}
            onChange={e => setPuesto(e.target.value)}
            placeholder="Desarrolladora Frontend"
            className={inputCls}
          />
        </div>

        {/* Fecha de ingreso */}
        <div>
          <label
            htmlFor="s4-fecha"
            className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
          >
            Fecha de ingreso
          </label>
          <input
            id="s4-fecha"
            type="date"
            value={fechaIngreso}
            onChange={e => setFechaIngreso(e.target.value)}
            className={cn(inputCls, 'text-white/80')}
          />
        </div>

        {/* Error global */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
            >
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300 leading-snug">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Botones */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Button
          variant="primary"
          size="md"
          loading={saving}
          onClick={handleInvitar}
          className="flex-1"
        >
          {saving ? 'Invitando...' : 'Invitar y finalizar'}
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={onSkip}
          disabled={saving}
          className="flex-1 sm:flex-none"
        >
          Hacerlo después
        </Button>
      </div>
    </div>
  )
}
```

**Step 3: Verificar build completo**

```bash
npm run build 2>&1 | grep -E "error|Error|✓" | head -20
```
Expected: `✓ Compiled successfully`

**Step 4: Commit**

```bash
git add src/components/admin/setup/Step3Contacto.tsx src/components/admin/setup/Step4Empleado.tsx
git commit -m "feat: add setup wizard steps 3 and 4"
```

---

### Task 8: Middleware update y build final

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Actualizar el middleware**

Leer `src/middleware.ts`. Agregar la constante `COOKIE_SETUP` después de `COOKIE_PREBOARDING`:

```typescript
/** Cookie que cachea si el setup inicial fue completado (evita query a empresas en cada request) */
const COOKIE_SETUP = 'onboard_setup'
```

Luego, en la sección `// ── 7. /admin/* → solo admin` (línea ~173), **reemplazar** el bloque actual:

```typescript
  // ── 7. /admin/* → solo admin (empleado → redirect /empleado) ─
  if (pathname.startsWith('/admin')) {
    if (rol !== 'admin') {
      return NextResponse.redirect(new URL('/empleado/perfil', request.url))
    }
    return supabaseResponse
  }
```

Con este bloque ampliado:

```typescript
  // ── 7. /admin/* → solo admin (empleado → redirect /empleado) ─
  if (pathname.startsWith('/admin')) {
    if (rol !== 'admin') {
      return NextResponse.redirect(new URL('/empleado/perfil', request.url))
    }

    // /admin/setup siempre accesible para admin — no verificar setup aquí
    if (pathname === '/admin/setup') {
      return supabaseResponse
    }

    // Para cualquier otra ruta /admin, verificar si completó el setup.
    // Usamos cookie de caché corta para no consultar la DB en cada request.
    const setupCacheado = request.cookies.get(COOKIE_SETUP)?.value

    if (setupCacheado !== '1') {
      // Consultar empresas en la DB
      try {
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('empresa_id')
          .eq('id', user.id)
          .single()

        if (usuario?.empresa_id) {
          const { data: empresa } = await supabase
            .from('empresas')
            .select('setup_completo')
            .eq('id', usuario.empresa_id)
            .single()

          if (empresa && !empresa.setup_completo) {
            return NextResponse.redirect(new URL('/admin/setup', request.url))
          }

          // Setup completo — cachear en cookie para próximos requests (1 hora)
          supabaseResponse.cookies.set(COOKIE_SETUP, '1', {
            httpOnly: true,
            sameSite: 'strict',
            maxAge: 60 * 60,
            path: '/',
          })
        }
      } catch (err) {
        // Fail open: si falla la query de empresas, dejamos pasar
        console.warn('[middleware] Error verificando setup:', err)
      }
    }

    return supabaseResponse
  }
```

**Step 2: Verificar el build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓|compiled" | head -20
```
Expected: `✓ Compiled successfully`

**Step 3: Verificar que las rutas key aparecen en el output**

```bash
npm run build 2>&1 | grep -E "auth/register|admin/setup"
```
Expected: ver `/auth/register` y `/admin/setup` en la lista de rutas.

**Step 4: Commit final**

```bash
git add src/middleware.ts
git commit -m "feat: middleware redirects admin to setup if not completed"
```

**Step 5: Commit maestro de resumen**

```bash
git log --oneline -8
```
Expected: ver los 6-7 commits de este feature en orden cronológico.

---

## NOTAS DE IMPLEMENTACIÓN

### RLS y el flujo de registro
El registro usa `SUPABASE_SERVICE_ROLE_KEY` que bypasea RLS. Esto es intencional: el primer usuario no puede satisfacer las políticas RLS (que requieren ser admin de una empresa existente para hacer INSERT en empresas). Una vez creado el par empresa+admin, las queries subsiguientes del wizard usan el anon key con las políticas normales.

### Cookie `onboard_setup` vs localStorage
El middleware usa la cookie `onboard_setup` (server-side, httpOnly). La página de setup usa `localStorage` como fallback client-side. Ambos señalan el mismo evento: setup completado. La cookie se invalida en 1 hora; si el admin no la tiene, el middleware hace 1 query a DB (con caché de rol ya consumido). Esto agrega ~1 query por hora como máximo para admins activos.

### Logo upload
El logo se sube al bucket `avatars` (que ya existe para fotos de usuarios). El path es `logos/{empresa_id}.{ext}`. Si el bucket no existe en la instalación, la subida fallará silenciosamente (console.warn) y el setup continúa sin logo. Se puede configurar el bucket en Supabase Dashboard → Storage → crear bucket `avatars` con acceso público.

### Generación de contraseña para empleados
El paso 4 genera una contraseña aleatoria de 12 caracteres. No se muestra al admin en la UI (por simplicidad). El flujo de recuperación de contraseña de Supabase queda como tarea pendiente.

### Validaciones inline
Todas las validaciones siguen el patrón del login: `onBlur` → `touched[field] = true` → la UI muestra el error solo si el campo fue tocado Y tiene valor inválido. Al submit, se marcan todos los campos como tocados.
