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
  'focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0EA5E9]/40',
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
