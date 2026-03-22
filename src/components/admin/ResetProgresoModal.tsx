'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, BookOpen, Wrench, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase'
import { Portal } from '@/components/shared/Portal'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export type ModuloReset = 'cultura' | 'rol' | 'asistente' | 'todos'

interface ResetProgresoModalProps {
  empleadoId: string
  empleadoNombre: string
  /** Módulo a resetear; 'todos' resetea M2+M3+M4 */
  modulo: ModuloReset
  onClose: () => void
  onReset: () => void
}

// ─────────────────────────────────────────────
// Configuración visual de módulos
// ─────────────────────────────────────────────

const MODULO_CONFIG: Record<
  Exclude<ModuloReset, 'todos'>,
  { label: string; descripcion: string; icon: React.ReactNode; color: string }
> = {
  cultura: {
    label: 'M2 — Cultura',
    descripcion: 'Se eliminan todos los bloques completados del módulo de cultura e identidad.',
    icon: <BookOpen className="w-4 h-4" />,
    color: 'text-[#38BDF8]',
  },
  rol: {
    label: 'M3 — Rol y herramientas',
    descripcion: 'Se eliminan el progreso de tareas y bloques del módulo de rol.',
    icon: <Wrench className="w-4 h-4" />,
    color: 'text-teal-400',
  },
  asistente: {
    label: 'M4 — Asistente IA',
    descripcion: 'Se eliminan todas las conversaciones con el asistente.',
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'text-amber-400',
  },
}

// ─────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────

export function ResetProgresoModal({
  empleadoId,
  empleadoNombre,
  modulo,
  onClose,
  onReset,
}: ResetProgresoModalProps) {
  const [loading, setLoading] = useState(false)

  // Módulos que se van a resetear según la selección
  const modulosAfectados: Exclude<ModuloReset, 'todos'>[] =
    modulo === 'todos' ? ['cultura', 'rol', 'asistente'] : [modulo]

  async function handleReset() {
    setLoading(true)
    try {
      const supabase = createClient()

      // Doble check: verificar que el usuario actual tiene permisos
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Sin sesión'); return }

      const { data: adminData } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()

      if (!adminData || !['admin', 'dev'].includes(adminData.rol)) {
        toast.error('Sin permisos para esta acción')
        return
      }

      const errores: string[] = []

      // Resetear progreso_modulos para cada módulo seleccionado
      for (const mod of modulosAfectados) {
        if (mod === 'cultura' || mod === 'rol') {
          const { error } = await supabase
            .from('progreso_modulos')
            .delete()
            .eq('usuario_id', empleadoId)
            .eq('modulo', mod)

          if (error) errores.push(mod)
        }

        if (mod === 'asistente') {
          // Obtener conversaciones del usuario para eliminar mensajes en cascada
          const { data: convs } = await supabase
            .from('conversaciones_ia')
            .select('id')
            .eq('usuario_id', empleadoId)

          if (convs && convs.length > 0) {
            const ids = convs.map(c => c.id)
            await supabase.from('mensajes_ia').delete().in('conversacion_id', ids)
            const { error } = await supabase
              .from('conversaciones_ia')
              .delete()
              .eq('usuario_id', empleadoId)
            if (error) errores.push('asistente')
          }

          // También limpiar progreso del módulo asistente si existe
          await supabase
            .from('progreso_modulos')
            .delete()
            .eq('usuario_id', empleadoId)
            .eq('modulo', 'asistente')
        }
      }

      if (errores.length > 0) {
        toast.error(`Error reseteando: ${errores.join(', ')}`)
      } else {
        const label = modulo === 'todos'
          ? 'Todo el progreso reseteado'
          : `Módulo ${MODULO_CONFIG[modulo].label} reseteado`
        toast.success(label)
        onReset()
      }
    } catch {
      toast.error('Error inesperado')
    } finally {
      setLoading(false)
      onClose()
    }
  }

  return (
    <Portal>
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          className="w-full max-w-md rounded-2xl border border-white/[0.08]
            bg-[#111110]/95 backdrop-blur-xl shadow-[0_24px_64px_rgba(0,0,0,0.5)]
            pointer-events-auto"
          initial={{ scale: 0.94, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.94, y: 12, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/20
                flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <h2 className="text-sm font-semibold text-white">Resetear progreso</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/70 transition-colors duration-150 p-1 -mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Contenido */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-white/60">
              Vas a resetear el progreso de{' '}
              <span className="text-white/85 font-medium">{empleadoNombre}</span>.
              Esta acción no se puede deshacer.
            </p>

            {/* Módulos afectados */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-white/35 uppercase tracking-wider">
                Módulos que se van a resetear
              </p>
              <div className="space-y-2">
                {modulosAfectados.map(mod => {
                  const cfg = MODULO_CONFIG[mod]
                  return (
                    <div
                      key={mod}
                      className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                    >
                      <span className={cfg.color + ' mt-0.5 flex-shrink-0'}>{cfg.icon}</span>
                      <div>
                        <p className="text-xs font-medium text-white/70">{cfg.label}</p>
                        <p className="text-[11px] text-white/35 mt-0.5">{cfg.descripcion}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" loading={loading} onClick={handleReset}>
              Sí, resetear
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
    </Portal>
  )
}
