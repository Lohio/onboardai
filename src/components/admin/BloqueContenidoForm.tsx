'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Save, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export interface BloqueContenido {
  id: string
  empresa_id: string
  modulo: string
  titulo: string
  contenido: string
  orden: number
  created_at: string
  updated_at: string
}

interface BloqueContenidoFormProps {
  /** ID de la empresa del admin autenticado */
  empresaId: string
  /** Módulo al que pertenece el bloque: 'perfil' | 'cultura' | 'rol' */
  modulo: string
  /** Si se pasa, es edición; si es undefined, es creación */
  bloque?: BloqueContenido
  /** Posición para un bloque nuevo */
  orden?: number
  onSuccess: (bloque: BloqueContenido) => void
  onCancel: () => void
}

interface FormData {
  titulo: string
  contenido: string
}

type FormErrors = Partial<Record<keyof FormData, string>>

// ─────────────────────────────────────────────
// Helper: clases del input/textarea
// ─────────────────────────────────────────────

function fieldCls(hasError: boolean): string {
  return cn(
    'w-full px-3 py-2 rounded-lg text-sm bg-white/[0.04] border text-white/85',
    'placeholder:text-white/20 outline-none transition-colors duration-150',
    'focus:bg-white/[0.06] focus:border-[#0EA5E9]/60',
    hasError ? 'border-red-500/50' : 'border-white/[0.08]',
  )
}

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────

export function BloqueContenidoForm({
  empresaId,
  modulo,
  bloque,
  orden = 1,
  onSuccess,
  onCancel,
}: BloqueContenidoFormProps) {
  const esEdicion = bloque !== undefined

  const [form, setForm] = useState<FormData>({
    titulo: bloque?.titulo ?? '',
    contenido: bloque?.contenido ?? '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [guardando, setGuardando] = useState(false)

  // ── Validación ──
  function validar(): boolean {
    const errs: FormErrors = {}
    if (!form.titulo.trim()) errs.titulo = 'El título es requerido'
    if (!form.contenido.trim()) errs.contenido = 'El contenido es requerido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Guardar (upsert) ──
  async function handleGuardar() {
    if (!validar()) return
    setGuardando(true)

    try {
      const supabase = createClient()

      // Verificar que el usuario sea admin o dev
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Sesión expirada')
        return
      }
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()

      if (!perfil || !['admin', 'dev'].includes(perfil.rol)) {
        toast.error('Sin permisos para esta acción')
        return
      }

      // Upsert
      const payload = {
        ...(esEdicion ? { id: bloque.id } : {}),
        empresa_id: empresaId,
        modulo,
        titulo: form.titulo.trim(),
        contenido: form.contenido.trim(),
        orden: esEdicion ? bloque.orden : orden,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('conocimiento')
        .upsert(payload)
        .select()
        .single()

      if (error) throw error

      toast.success(esEdicion ? 'Bloque actualizado' : 'Bloque creado')
      onSuccess(data as BloqueContenido)
    } catch (err) {
      console.error('Error al guardar bloque:', err)
      toast.error('No se pudo guardar el bloque')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="rounded-xl border border-[#0EA5E9]/15 bg-[#0EA5E9]/[0.05] p-4 space-y-3"
    >
      <p className="text-xs font-semibold text-[#7DD3FC] uppercase tracking-wider">
        {esEdicion ? 'Editar bloque' : 'Nuevo bloque'}
      </p>

      {/* Título */}
      <div className="space-y-1">
        <label className="text-xs text-white/50">Título</label>
        <input
          type="text"
          value={form.titulo}
          onChange={e => {
            setForm(prev => ({ ...prev, titulo: e.target.value }))
            if (errors.titulo) setErrors(prev => ({ ...prev, titulo: undefined }))
          }}
          placeholder="Ej: Historia de la empresa"
          className={fieldCls(!!errors.titulo)}
          autoFocus
        />
        {errors.titulo && (
          <p className="text-xs text-red-400">{errors.titulo}</p>
        )}
      </div>

      {/* Contenido */}
      <div className="space-y-1">
        <label className="text-xs text-white/50">Contenido</label>
        <textarea
          value={form.contenido}
          onChange={e => {
            setForm(prev => ({ ...prev, contenido: e.target.value }))
            if (errors.contenido) setErrors(prev => ({ ...prev, contenido: undefined }))
          }}
          placeholder="Escribí el contenido que verá el asistente IA..."
          rows={5}
          className={cn(fieldCls(!!errors.contenido), 'resize-y min-h-[100px]')}
        />
        {errors.contenido && (
          <p className="text-xs text-red-400">{errors.contenido}</p>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={guardando}
        >
          <X className="w-3.5 h-3.5" />
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={guardando}
          onClick={handleGuardar}
        >
          <Save className="w-3.5 h-3.5" />
          Guardar
        </Button>
      </div>
    </motion.div>
  )
}
