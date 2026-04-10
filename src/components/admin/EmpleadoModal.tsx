'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Eye, EyeOff, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Portal } from '@/components/shared/Portal'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface EmpleadoCreado {
  id: string
  nombre: string
  email: string
}

interface EmpleadoModalProps {
  onClose: () => void
  onCreated: (empleado: EmpleadoCreado) => void
}

interface FormData {
  nombre: string
  email: string
  password: string
  puesto: string
  area: string
  fecha_ingreso: string
  rol: 'empleado' | 'admin'
}

type FormErrors = Partial<Record<keyof FormData, string>>

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function generarPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function inputCls(error: boolean): string {
  return [
    'w-full h-9 px-3 rounded-lg text-sm bg-white/[0.04] border text-white/85',
    'placeholder:text-white/20 outline-none transition-colors duration-150',
    'focus:bg-white/[0.06] focus:border-[#0EA5E9]/60',
    error ? 'border-red-500/50' : 'border-white/[0.08]',
  ].join(' ')
}

function FieldError({ children }: { children: string }) {
  return <p className="mt-1 text-[11px] text-red-400">{children}</p>
}

// ─────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────

export function EmpleadoModal({ onClose, onCreated }: EmpleadoModalProps) {
  const [form, setForm] = useState<FormData>({
    nombre: '',
    email: '',
    password: generarPassword(),
    puesto: '',
    area: '',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    rol: 'empleado',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  function set(key: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: FormErrors = {}
    if (!form.nombre.trim()) errs.nombre = 'Requerido'
    if (!form.email.trim()) errs.email = 'Requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email inválido'
    if (!form.password) errs.password = 'Requerido'
    else if (form.password.length < 8) errs.password = 'Mínimo 8 caracteres'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          nombre: form.nombre.trim(),
          puesto: form.puesto.trim() || undefined,
          area: form.area.trim() || undefined,
          fecha_ingreso: form.fecha_ingreso || undefined,
          rol: form.rol,
        }),
      })
      const data = await res.json() as { usuario?: EmpleadoCreado; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Error al crear empleado')
        return
      }
      toast.success(`Empleado ${form.nombre} creado`)
      onCreated(data.usuario!)
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Portal>
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/60 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Panel centrado */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          className="w-full max-w-lg rounded-2xl border border-white/[0.08]
            bg-[#111110]/95 backdrop-blur-xl shadow-[0_24px_64px_rgba(0,0,0,0.5)]
            pointer-events-auto"
          initial={{ scale: 0.94, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.94, y: 16, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white">Nuevo colaborador</h2>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors duration-150 p-1 -mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">

              {/* Nombre */}
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Nombre completo <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => set('nombre', e.target.value)}
                  className={inputCls(!!errors.nombre)}
                  placeholder="Ana García"
                  autoFocus
                />
                {errors.nombre && <FieldError>{errors.nombre}</FieldError>}
              </div>

              {/* Email + Contraseña */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    className={inputCls(!!errors.email)}
                    placeholder="ana@empresa.com"
                  />
                  {errors.email && <FieldError>{errors.email}</FieldError>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">
                    Contraseña <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      className={inputCls(!!errors.password) + ' pr-16'}
                      placeholder="••••••••"
                    />
                    {/* Mostrar / regenerar */}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => set('password', generarPassword())}
                        className="p-1.5 text-white/25 hover:text-white/60 transition-colors"
                        title="Generar nueva contraseña"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="p-1.5 text-white/25 hover:text-white/60 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  {errors.password && <FieldError>{errors.password}</FieldError>}
                </div>
              </div>

              {/* Puesto + Área */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Puesto</label>
                  <input
                    type="text"
                    value={form.puesto}
                    onChange={e => set('puesto', e.target.value)}
                    className={inputCls(false)}
                    placeholder="Desarrolladora Frontend"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Área</label>
                  <input
                    type="text"
                    value={form.area}
                    onChange={e => set('area', e.target.value)}
                    className={inputCls(false)}
                    placeholder="Producto"
                  />
                </div>
              </div>

              {/* Fecha ingreso + Rol */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Fecha de ingreso</label>
                  <input
                    type="date"
                    value={form.fecha_ingreso}
                    onChange={e => set('fecha_ingreso', e.target.value)}
                    className={inputCls(false)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Rol</label>
                  <select
                    value={form.rol}
                    onChange={e => set('rol', e.target.value)}
                    className={inputCls(false) + ' appearance-none cursor-pointer'}
                  >
                    <option value="empleado" className="bg-[#111110]">Empleado</option>
                    <option value="admin" className="bg-[#111110]">Admin</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
              <Button variant="ghost" size="sm" type="button" onClick={onClose}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" loading={loading} type="submit">
                Agregar
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
    </Portal>
  )
}
