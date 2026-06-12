'use client'

// ─────────────────────────────────────────────
// Quiz de comprensión
// ─────────────────────────────────────────────

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/components/LanguageProvider'
import type { BloqueKey } from './types'
import { BLOQUES_CONFIG, PREGUNTAS } from './helpers'

interface QuizProps {
  bloqueKey: BloqueKey
  respuestas: (number | null)[]
  onRespuesta: (qIdx: number, opIdx: number) => void
  onComplete: () => void
  completando: boolean
  onReset: () => void
}

export function BloqueQuiz({ bloqueKey, respuestas, onRespuesta, onComplete, completando, onReset }: QuizProps) {
  const { t } = useLanguage()
  const preguntas = PREGUNTAS[bloqueKey]
  const todasRespondidas = respuestas.every(r => r !== null)
  const todasCorrectas = preguntas.every((p, i) => respuestas[i] === p.correcta)
  const cfg = BLOQUES_CONFIG[bloqueKey]

  return (
    <div className="mt-6 space-y-5">
      {/* Divider con label */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium', cfg.iconBg, cfg.iconText)}>
          <Sparkles className="w-3 h-3" />
          {t('cultura.quiz.title')}
        </div>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {preguntas.map((p, qIdx) => {
        const respuesta = respuestas[qIdx]
        const respondida = respuesta !== null
        const esCorrecta = respondida && respuesta === p.correcta

        return (
          <div key={qIdx} className="space-y-3">
            <p className="text-sm text-gray-800 font-medium leading-snug">
              <span className={cn('inline-block w-5 h-5 rounded-full text-center text-[11px] font-bold mr-2 leading-5', cfg.iconBg, cfg.iconText)}>
                {qIdx + 1}
              </span>
              {p.pregunta}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {p.opciones.map((op, opIdx) => {
                const seleccionada = respuesta === opIdx
                const esLaCorrecta = opIdx === p.correcta

                let style = 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300 text-gray-700'
                if (respondida && seleccionada && esCorrecta)
                  style = 'bg-teal-50 border-teal-300 text-teal-700'
                else if (respondida && seleccionada && !esCorrecta)
                  style = 'bg-red-50 border-red-300 text-red-700'
                else if (respondida && esLaCorrecta)
                  style = 'bg-teal-50/60 border-teal-200 text-teal-600'
                else if (respondida)
                  style = 'bg-gray-50 border-gray-100 text-gray-400'

                return (
                  <button
                    key={opIdx}
                    onClick={() => !respondida && onRespuesta(qIdx, opIdx)}
                    disabled={respondida}
                    className={cn(
                      'w-full text-left text-sm px-4 py-3 rounded-xl border transition-all duration-150',
                      'disabled:cursor-default',
                      style,
                    )}
                  >
                    <span className="inline-block w-4 h-4 rounded-full border border-current opacity-60 mr-2.5 align-middle text-[10px] text-center leading-[14px] flex-shrink-0 inline-flex items-center justify-center">
                      {String.fromCharCode(65 + opIdx)}
                    </span>
                    {op}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Acciones */}
      <AnimatePresence>
        {todasRespondidas && todasCorrectas && (
          <motion.div
            key="completar"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <button
              onClick={onComplete}
              disabled={completando}
              className={cn(
                'w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200',
                'bg-gradient-to-r from-teal-600 to-teal-500 text-white',
                'hover:from-teal-500 hover:to-teal-400',
                'shadow-sm hover:shadow-md',
                'disabled:opacity-60 disabled:cursor-wait',
              )}
            >
              {completando ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                  Guardando progreso...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  ¡Completé este bloque!
                </span>
              )}
            </button>
          </motion.div>
        )}

        {todasRespondidas && !todasCorrectas && (
          <motion.div
            key="reintentar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200"
          >
            <p className="text-xs text-amber-700">{t('cultura.quiz.error')}</p>
            <button
              onClick={onReset}
              className="text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors ml-3 flex-shrink-0"
            >
              Reintentar →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
