'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { ButtonVariant } from '@/components/ui/Button'
import { Portal } from '@/components/shared/Portal'

// ─────────────────────────────────────────────
// Modal genérico de confirmación
// ─────────────────────────────────────────────

interface ConfirmModalProps {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  /** Color del ícono y del botón de confirmación */
  variant?: 'danger' | 'warning'
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'warning',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const iconClasses =
    variant === 'danger'
      ? 'bg-red-500/15 border-red-500/20 text-red-400'
      : 'bg-amber-500/15 border-amber-500/20 text-amber-400'

  const confirmVariant: ButtonVariant = variant === 'danger' ? 'danger' : 'primary'

  return (
    <Portal>
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 bg-black/60 z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={loading ? undefined : onClose}
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
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${iconClasses}`}>
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-sm font-semibold text-white">{title}</h2>
              </div>
              <button
                onClick={onClose}
                disabled={loading}
                className="text-white/30 hover:text-white/70 transition-colors duration-150 p-1 -mr-1
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido */}
            <div className="px-6 py-5">
              <p className="text-sm text-white/60">{description}</p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
              <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={loading}>
                {cancelLabel}
              </Button>
              <Button
                variant={confirmVariant}
                size="sm"
                loading={loading}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    </Portal>
  )
}
