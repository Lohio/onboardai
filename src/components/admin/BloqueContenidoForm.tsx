'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Save, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useLanguage } from '@/components/LanguageProvider'

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
  area?: string | null
  puesto?: string | null
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
  /** Capa de área — se persiste en la columna area */
  area?: string | null
  /** Capa de puesto — se persiste en la columna puesto */
  puesto?: string | null
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
  area,
  puesto,
  onSuccess,
  onCancel,
}: BloqueContenidoFormProps) {
  const { t } = useLanguage()
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
    if (!form.titulo.trim()) errs.titulo = t('adminCont.form.tituloRequerido')
    if (!form.contenido.trim()) errs.contenido = t('adminCont.form.contenidoRequerido')
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
        toast.error(t('adminCont.form.sesionExpirada'))
        return
      }
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()

      if (!perfil || !['admin', 'dev'].includes(perfil.rol)) {
        toast.error(t('adminCont.form.sinPermisos'))
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
        ...(area !== undefined ? { area: area ?? null } : {}),
        ...(puesto !== undefined ? { puesto: puesto ?? null } : {}),
      }

      const { data, error } = await supabase
        .from('conocimiento')
        .upsert(payload)
        .select()
        .single()

      if (error) throw error

      toast.success(esEdicion ? t('adminCont.form.actualizado') : t('adminCont.form.creado'))
      onSuccess(data as BloqueContenido)
    } catch (err) {
      console.error('Error al guardar bloque:', err)
      toast.error(t('adminCont.form.errorGuardar'))
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
        {esEdicion ? t('adminCont.editarBloque') : t('adminCont.nuevoBloque')}
      </p>

      {/* Título */}
      <div className="space-y-1">
        <label className="text-xs text-white/50">{t('adminCont.form.titulo')}</label>
        <input
          type="text"
          value={form.titulo}
          onChange={e => {
            setForm(prev => ({ ...prev, titulo: e.target.value }))
            if (errors.titulo) setErrors(prev => ({ ...prev, titulo: undefined }))
          }}
          placeholder={t('adminCont.form.tituloPlaceholder')}
          className={fieldCls(!!errors.titulo)}
          autoFocus
        />
        {errors.titulo && (
          <p className="text-xs text-red-400">{errors.titulo}</p>
        )}
      </div>

      {/* Contenido */}
      <div className="space-y-1">
        <label className="text-xs text-white/50">{t('adminCont.form.contenido')}</label>
        <textarea
          value={form.contenido}
          onChange={e => {
            setForm(prev => ({ ...prev, contenido: e.target.value }))
            if (errors.contenido) setErrors(prev => ({ ...prev, contenido: undefined }))
          }}
          placeholder={t('adminCont.form.contenidoPlaceholder')}
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
          {t('adminCont.cancelar')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={guardando}
          onClick={handleGuardar}
        >
          <Save className="w-3.5 h-3.5" />
          {t('adminCont.guardar')}
        </Button>
      </div>
    </motion.div>
  )
}
