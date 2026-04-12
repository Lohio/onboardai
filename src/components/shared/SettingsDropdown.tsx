'use client'

import { useState, useEffect, useRef, useContext } from 'react'
import { Settings, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { type Theme, ThemeContext } from '@/components/ThemeProvider'
import { useLanguage } from '@/components/LanguageProvider'
import { LANG_FLAGS, LANG_LABELS, LANGS } from '@/lib/i18n'

const THEME_OPTIONS: { value: Theme; labelKey: string; bg: string; surface: string }[] = [
  { value: 'theme-dark',  labelKey: 'settings.dark',  bg: '#0A1628', surface: '#162440' },
  { value: 'theme-light', labelKey: 'settings.light', bg: '#f8f8f7', surface: '#ffffff' },
  { value: 'theme-gray',  labelKey: 'settings.gray',  bg: '#1c1c1e', surface: '#2c2c2e' },
]

export function SettingsDropdown() {
  const { currentTheme, setTheme } = useContext(ThemeContext)
  const { lang, setLang, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150
          ${open
            ? 'text-white/80 bg-white/10'
            : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
          }`}
        aria-label={t('settings.title')}
      >
        <Settings className="w-[15px] h-[15px]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute right-0 bottom-full mb-2 w-64 z-50
              glass-card rounded-xl overflow-hidden"
          >
            {/* Título */}
            <div className="px-3 py-2.5 border-b border-white/[0.06]">
              <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">
                {t('settings.title')}
              </p>
            </div>

            {/* Apariencia */}
            <div className="px-3 pt-2.5 pb-2.5 border-b border-white/[0.06]">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
                {t('settings.appearance')}
              </p>
              <div className="flex gap-1.5">
                {THEME_OPTIONS.map(op => {
                  const active = currentTheme === op.value
                  return (
                    <button
                      key={op.value}
                      onClick={() => setTheme(op.value)}
                      className={`flex-1 rounded-lg border p-1.5 transition-all duration-150 text-center
                        ${active
                          ? 'border-indigo-500/50 bg-indigo-500/10'
                          : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                        }`}
                      aria-label={`Tema ${op.labelKey}`}
                    >
                      {/* Preview */}
                      <div
                        className="h-5 rounded mb-1 border border-white/10 overflow-hidden"
                        style={{ background: op.bg }}
                      >
                        <div className="h-2 w-full" style={{ background: op.surface }} />
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-[10px] font-medium ${active ? 'text-indigo-400' : 'text-white/40'}`}>
                          {t(op.labelKey)}
                        </span>
                        {active && <Check className="w-2.5 h-2.5 text-indigo-400" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Idioma */}
            <div className="px-3 pt-2.5 pb-3">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
                {t('settings.language')}
              </p>
              <div className="grid grid-cols-2 gap-1">
                {LANGS.map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                      transition-all duration-150
                      ${lang === l
                        ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                        : 'text-white/45 hover:text-white/70 hover:bg-white/[0.05] border border-transparent'
                      }`}
                  >
                    <span>{LANG_FLAGS[l]}</span>
                    <span>{LANG_LABELS[l]}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
