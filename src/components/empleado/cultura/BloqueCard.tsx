'use client'

// ─────────────────────────────────────────────
// BloqueCard
// ─────────────────────────────────────────────

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, CheckCircle2, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { ContenidoBloque } from '@/types'
import type { BloqueKey } from './types'
import { BLOQUES_CONFIG, blockVariants, quizVariants } from './helpers'
import { MarkdownContent } from './MarkdownContent'
import { BloqueQuiz } from './BloqueQuiz'

interface BloqueCardProps {
  bloqueKey: BloqueKey
  numero: number
  contenido: ContenidoBloque | null
  unlocked: boolean
  completado: boolean
  readProgress: number
  respuestas: (number | null)[]
  completando: boolean
  onRespuesta: (qIdx: number, opIdx: number) => void
  onComplete: () => void
  contentRef: (el: HTMLDivElement | null) => void
  onReset: () => void
  isActive: boolean
}

export function BloqueCard({
  bloqueKey,
  numero,
  contenido,
  unlocked,
  completado,
  readProgress,
  respuestas,
  completando,
  onRespuesta,
  onComplete,
  contentRef,
  onReset,
  isActive,
}: BloqueCardProps) {
  const cfg = BLOQUES_CONFIG[bloqueKey]
  const [expandido, setExpandido] = useState(true)
  const showQuiz = readProgress >= 80 && !completado && contenido !== null
  const locked = !unlocked

  return (
    <motion.div
      variants={blockVariants}
      id={`bloque-${bloqueKey}`}
      className="relative"
    >
      <div
        className={cn(
          'relative bg-white rounded-xl overflow-hidden border transition-all duration-300',
          completado
            ? 'border-teal-200 shadow-sm'
            : isActive
            ? cn('border-gray-300 shadow-md', cfg.accent)
            : 'border-gray-200 shadow-sm',
          locked && 'opacity-60',
        )}
      >
        {/* ── Header ── */}
        <div
          className={cn(
            'relative flex items-start gap-3 p-5',
            completado && 'cursor-pointer',
          )}
          onClick={() => completado && setExpandido(v => !v)}
        >
          {/* Número + ícono */}
          <div className="flex-shrink-0 relative">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300',
                completado
                  ? 'bg-teal-100 text-teal-600'
                  : isActive
                  ? cn(cfg.iconBg, cfg.iconText)
                  : 'bg-gray-100 text-gray-300',
              )}
            >
              {completado ? <CheckCircle2 className="w-5 h-5" /> : cfg.icon}
            </div>
            {/* Número badge */}
            <div className={cn(
              'absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full flex items-center justify-center',
              'text-[9px] font-bold font-mono',
              completado
                ? 'bg-teal-500 text-white'
                : isActive
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-200 text-gray-500',
            )}>
              {numero}
            </div>
          </div>

          {/* Título y progreso */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className={cn(
              'text-sm font-semibold leading-tight',
              completado ? 'text-gray-400' : 'text-gray-900',
            )}>
              {cfg.label}
            </h3>

            {completado && (
              <p className="text-xs text-teal-600 mt-1">Completado ✓</p>
            )}
          </div>

          {/* Badge / estado */}
          <div className="flex-shrink-0 flex items-center gap-1.5 pt-0.5">
            {!completado && unlocked && readProgress > 0 && (
              <Badge variant="info">{Math.round(readProgress)}%</Badge>
            )}
            {completado ? (
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-gray-400 transition-transform duration-200',
                  !expandido && 'rotate-180',
                )}
              />
            ) : locked ? (
              <Lock className="w-4 h-4 text-gray-300" />
            ) : null}
          </div>
        </div>

        {/* ── Contenido ── */}
        <AnimatePresence initial={false}>
          {unlocked && (!completado || expandido) && (
            <motion.div
              initial={completado ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div
                ref={contentRef}
                className="relative px-5 pb-5"
              >
                {/* Texto del bloque */}
                {contenido ? (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                    <MarkdownContent text={contenido.contenido} />
                  </div>
                ) : (
                  <div className="py-4 text-center space-y-1">
                    <p className="text-sm text-gray-400 italic">
                      Contenido no disponible. El administrador aún no cargó este bloque.
                    </p>
                    <p className="text-xs text-gray-300">
                      Este bloque no puede completarse hasta que el contenido esté disponible.
                    </p>
                  </div>
                )}

                {/* Quiz */}
                <AnimatePresence>
                  {showQuiz && (
                    <motion.div
                      variants={quizVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      className="overflow-hidden"
                    >
                      <BloqueQuiz
                        bloqueKey={bloqueKey}
                        respuestas={respuestas}
                        onRespuesta={onRespuesta}
                        onComplete={onComplete}
                        completando={completando}
                        onReset={onReset}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Overlay bloqueado ── */}
        <AnimatePresence>
          {locked && (
            <motion.div
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              className="absolute inset-0 backdrop-blur-[1px] rounded-xl flex flex-col items-center justify-center gap-2"
              style={{ background: 'rgba(255,255,255,0.75)' }}
            >
              <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                <Lock className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500 text-center px-6">
                Completá el bloque anterior para desbloquear
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
