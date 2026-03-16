'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { BloqueContenido } from './BloqueContenidoForm'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface EliminarBloqueModalProps {
  bloque: BloqueContenido
  onConfirm: () => Promise<void>
  onClose: () => void
}

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────

export function EliminarBloqueModal({
  bloque,
  onConfirm,
  onClose,
}: EliminarBloqueModalProps) {
  const [eliminando, setEliminando] = useState(false)

  async function handleConfirmar() {
    setEliminando(true)
    try {
      await onConfirm()
    } finally {
      setEliminando(false)
    }
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/60 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={!eliminando ? onClose : undefined}
      />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          className="glass-card rounded-2xl w-full max-w-sm pointer-events-auto overflow-hidden"
          initial={{ scale: 0.94, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.94, y: 16, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          {/* Header */}
          <div className="p-5 pb-4">
            <div className="flex items-start gap-3">
              {/* Ícono de alerta */}
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-white/90">
                  Eliminar bloque
                </h2>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">
                  Esta acción no se puede deshacer. El asistente IA perderá
                  acceso a este conocimiento.
                </p>
              </div>
            </div>
          </div>

          {/* Bloque a eliminar */}
          <div className="mx-5 mb-5 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <p className="text-xs text-white/40 mb-0.5">Bloque a eliminar</p>
            <p className="text-sm text-white/80 font-medium truncate">
              {bloque.titulo}
            </p>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-2 px-5 pb-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={eliminando}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={eliminando}
              onClick={handleConfirmar}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
