'use client'

import { useState, useEffect, useRef, useContext } from 'react'
import { Settings } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { type Theme, ThemeContext, getStoredTheme, applyTheme } from '@/components/ThemeProvider'
import { useLanguage } from '@/components/LanguageProvider'
import { LANG_FLAGS, LANG_LABELS, LANGS } from '@/lib/i18n'

const THEME_OPTIONS: { value: Theme; labelKey: string; bg: string }[] = [
  { value: 'theme-dark',  labelKey: 'settings.dark',  bg: '#111110' },
  { value: 'theme-light', labelKey: 'settings.light', bg: '#f8f8f7' },
]

export function SettingsDropdown() {
  const { section } = useContext(ThemeContext)
  const { lang, setLang, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<Theme>('theme-dark')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCurrentTheme(getStoredTheme(section))
  }, [section])

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleTheme(theme: Theme) {
    applyTheme(theme, section)
    setCurrentTheme(theme)
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150
          ${open
            ? 'text-gray-700 bg-gray-100'
            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
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
            className="absolute right-0 bottom-full mb-2 w-72 z-50
              rounded-xl border border-gray-200 bg-white
              shadow-xl overflow-hidden"
          >
            {/* Título */}
            <div className="px-3 py-2.5 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-500">{t('settings.title')}</p>
            </div>

            {/* Apariencia */}
            <div className="px-3 pt-2.5 pb-2.5 border-b border-gray-200">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                {t('settings.appearance')}
              </p>
              <div className="flex gap-1.5">
                {THEME_OPTIONS.map(op => (
                  <button
                    key={op.value}
                    onClick={() => handleTheme(op.value)}
                    className={`flex-1 rounded-lg border p-1.5 transition-all duration-150 text-center
                      ${currentTheme === op.value
                        ? 'border-sky-200 bg-sky-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                  >
                    <div
                      className="h-5 rounded mb-1 border border-gray-200"
                      style={{ background: op.bg }}
                    />
                    <span className={`text-[10px] font-medium ${
                      currentTheme === op.value ? 'text-sky-700' : 'text-gray-500'
                    }`}>
                      {t(op.labelKey)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Idioma */}
            <div className="px-3 pt-2.5 pb-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                {t('settings.language')}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {LANGS.map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium
                      transition-all duration-150
                      ${lang === l
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent'
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
