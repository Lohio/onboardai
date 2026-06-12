'use client'

// Tab "Herramientas" del módulo Rol (M3) — extraído de src/app/empleado/rol/page.tsx

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wrench, ExternalLink, ChevronDown, Sparkles } from 'lucide-react'
import { useLanguage } from '@/components/LanguageProvider'
import { cn } from '@/lib/utils'
import type { HerramientaRol } from '@/types'
import { SectionHeader, getIcono, itemVariants } from './helpers'

// ─────────────────────────────────────────────
// HerramientaCard
// ─────────────────────────────────────────────

function HerramientaCard({ herramienta }: { herramienta: HerramientaRol }) {
  const [expandida, setExpandida] = useState(false)
  const guia = herramienta.guia ?? []

  return (
    <motion.div variants={itemVariants}>
      <div
        className={cn(
          'rounded-xl border overflow-hidden transition-all duration-200',
          expandida
            ? 'border-amber-300 bg-amber-50/50 shadow-sm'
            : 'border-gray-200 bg-white hover:shadow-md hover:border-gray-300',
        )}
      >
        {/* Header */}
        <div className="p-4 flex items-start gap-3">
          <div className={cn(
            'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200',
            expandida ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500',
          )}>
            {getIcono(herramienta.icono)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate">{herramienta.nombre}</p>
              {herramienta.url && (
                <a
                  href={herramienta.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex-shrink-0 flex items-center gap-1 text-[10px] text-gray-400 hover:text-amber-600 transition-colors px-2 py-1 rounded-lg hover:bg-amber-50"
                >
                  <ExternalLink className="w-3 h-3" />
                  Abrir
                </a>
              )}
            </div>
            {herramienta.guia && herramienta.guia[0] && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                {herramienta.guia[0].pasos[0]}
              </p>
            )}
          </div>
        </div>

        {/* Toggle guía */}
        {guia.length > 0 && (
          <button
            onClick={() => setExpandida(v => !v)}
            className="w-full px-4 py-2.5 flex items-center justify-between border-t border-gray-200 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              {expandida ? 'Cerrar guía' : 'Ver guía de uso'}
            </span>
            <motion.div animate={{ rotate: expandida ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
              <ChevronDown className="w-3.5 h-3.5" />
            </motion.div>
          </button>
        )}

        {/* Guía expandida */}
        <AnimatePresence>
          {expandida && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-5 pt-3 space-y-4 border-t border-gray-200">
                {guia.map((seccion, si) => (
                  <div key={si}>
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-2">
                      {seccion.titulo}
                    </p>
                    <ol className="space-y-2">
                      {seccion.pasos.map((paso, pi) => (
                        <li key={pi} className="flex items-start gap-2.5 text-xs text-gray-600">
                          <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[9px] font-mono font-bold">
                            {pi + 1}
                          </span>
                          <span>{paso}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Tab Herramientas
// ─────────────────────────────────────────────

export function TabHerramientas({ herramientas }: { herramientas: HerramientaRol[] }) {
  const { t } = useLanguage()

  return (
    <section>
      <SectionHeader
        icon={<Wrench className="w-4 h-4" />}
        title={t('rol.herramientas.title')}
        subtitle={t('rol.herramientas.subtitle')}
        iconBg="bg-sky-100"
        iconText="text-sky-600"
      />
      {herramientas.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {herramientas.map(h => <HerramientaCard key={h.id} herramienta={h} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-8 text-center">
          <Wrench className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Tu empresa aún no ha configurado las herramientas del rol.</p>
        </div>
      )}
    </section>
  )
}
