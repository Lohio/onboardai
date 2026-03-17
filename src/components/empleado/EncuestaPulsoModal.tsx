'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Star, Send, CheckCircle2 } from 'lucide-react'
import { Portal } from '@/components/shared/Portal'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export interface EncuestaPendiente {
  id: string
  dia_onboarding: number
  pregunta_1: string
  pregunta_2: string
  pregunta_3: string
}

interface Props {
  encuesta: EncuestaPendiente
  onClose: () => void
  onCompletada: () => void
}

// ─────────────────────────────────────────────
// StarRating
// ─────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const activa = (hover || value) >= star
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
            className={`transition-all duration-100 focus:outline-none
              ${disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110'}
            `}
          >
            <Star
              className={`w-7 h-7 transition-colors duration-100 ${
                activa ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-white/20'
              }`}
            />
          </button>
        )
      })}
      {value > 0 && (
        <span className="ml-2 text-xs text-white/40 tabular-nums">{value}/5</span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────

export function EncuestaPulsoModal({ encuesta, onClose, onCompletada }: Props) {
  const [r1, setR1] = useState(0)
  const [r2, setR2] = useState(0)
  const [r3, setR3] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [completado, setCompletado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const completo = r1 > 0 && r2 > 0 && r3 > 0

  async function enviar() {
    if (!completo || enviando) return
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch('/api/empleado/encuesta-responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encuestaId: encuesta.id,
          respuesta1: r1,
          respuesta2: r2,
          respuesta3: r3,
          comentario: comentario.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      setCompletado(true)
      setTimeout(() => {
        onCompletada()
      }, 1800)
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const titulo = `Check-in — Día ${encuesta.dia_onboarding}`

  return (
    <Portal>
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !enviando) onClose()
        }}
      >
        {/* Panel */}
        <motion.div
          key="panel"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="w-full max-w-md bg-[#0f1f3d] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl"
        >
          {completado ? (
            /* Estado de éxito */
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 px-6 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-teal-500/15 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-teal-400" />
              </div>
              <p className="text-lg font-semibold text-white">¡Gracias por tu feedback!</p>
              <p className="text-sm text-white/45 mt-1">Tu opinión nos ayuda a mejorar el onboarding</p>
            </motion.div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-white/[0.06]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400/70 mb-1">
                    Encuesta de pulso
                  </p>
                  <h2 className="text-base font-semibold text-white">{titulo}</h2>
                  <p className="text-xs text-white/40 mt-0.5">Solo toma 1 minuto · Anónima para RRHH</p>
                </div>
                <button
                  onClick={onClose}
                  disabled={enviando}
                  className="mt-0.5 p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-6">
                {/* Pregunta 1 */}
                <div className="space-y-2.5">
                  <p className="text-sm text-white/75 leading-snug">{encuesta.pregunta_1}</p>
                  <StarRating value={r1} onChange={setR1} disabled={enviando} />
                </div>

                {/* Divider */}
                <div className="h-px bg-white/[0.05]" />

                {/* Pregunta 2 */}
                <div className="space-y-2.5">
                  <p className="text-sm text-white/75 leading-snug">{encuesta.pregunta_2}</p>
                  <StarRating value={r2} onChange={setR2} disabled={enviando} />
                </div>

                {/* Divider */}
                <div className="h-px bg-white/[0.05]" />

                {/* Pregunta 3 */}
                <div className="space-y-2.5">
                  <p className="text-sm text-white/75 leading-snug">{encuesta.pregunta_3}</p>
                  <StarRating value={r3} onChange={setR3} disabled={enviando} />
                </div>

                {/* Divider */}
                <div className="h-px bg-white/[0.05]" />

                {/* Comentario opcional */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
                    Comentario libre <span className="normal-case">(opcional)</span>
                  </label>
                  <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    disabled={enviando}
                    rows={3}
                    placeholder="¿Querés agregar algo más?"
                    className="w-full px-3 py-2.5 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg
                      text-white/80 placeholder:text-white/20 resize-none
                      focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20
                      transition-colors disabled:opacity-50"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-xs text-red-400/80">{error}</p>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 flex items-center gap-3">
                <button
                  onClick={onClose}
                  disabled={enviando}
                  className="flex-1 py-2.5 text-sm font-medium text-white/40 hover:text-white/60
                    border border-white/[0.08] rounded-xl transition-colors disabled:opacity-50"
                >
                  Más tarde
                </button>
                <button
                  onClick={enviar}
                  disabled={!completo || enviando}
                  className={`flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-semibold
                    rounded-xl transition-all duration-150
                    ${completo && !enviando
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-white/[0.04] text-white/25 cursor-not-allowed'
                    }`}
                >
                  {enviando ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                      Enviando…
                    </span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Enviar feedback
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
    </Portal>
  )
}
