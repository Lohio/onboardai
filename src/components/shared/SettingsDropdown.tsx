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
            className="absolute right-0 bottom-full mb-2 w-64 z-50 rounded-xl overflow-hidden
              shadow-xl shadow-black/40"
            style={{ background: '#0F1F3D', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* Título */}
            <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.40)' }}>
                {t('settings.title')}
              </p>
            </div>

            {/* Apariencia */}
            <div className="px-3 pt-2.5 pb-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.30)' }}>
                {t('settings.appearance')}
              </p>
              <div className="flex gap-1.5">
                {THEME_OPTIONS.map(op => {
                  const active = currentTheme === op.value
                  return (
                    <button
                      key={op.value}
                      onClick={() => setTheme(op.value)}
                      className="flex-1 rounded-lg p-1.5 transition-all duration-150 text-center"
                      style={{
                        border: active ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        background: active ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                      }}
                      aria-label={`Tema ${op.labelKey}`}
                    >
                      {/* Preview */}
                      <div
                        className="h-5 rounded mb-1 overflow-hidden"
                        style={{ background: op.bg, border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <div className="h-2 w-full" style={{ background: op.surface }} />
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-[10px] font-medium" style={{ color: active ? '#818cf8' : 'rgba(255,255,255,0.45)' }}>
                          {t(op.labelKey)}
                        </span>
                        {active && <Check className="w-2.5 h-2.5" style={{ color: '#818cf8' }} />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Idioma */}
            <div className="px-3 pt-2.5 pb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.30)' }}>
                {t('settings.language')}
              </p>
              <div className="grid grid-cols-2 gap-1">
                {LANGS.map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150"
                    style={{
                      color: lang === l ? '#818cf8' : 'rgba(255,255,255,0.50)',
                      background: lang === l ? 'rgba(99,102,241,0.12)' : 'transparent',
                      border: lang === l ? '1px solid rgba(99,102,241,0.30)' : '1px solid transparent',
                    }}
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
