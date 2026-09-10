'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { type Lang, type TranslationMap, LANGS } from '@/lib/i18n'
import es from '@/lib/i18n/es'

const STORAGE_KEY = 'onboard_lang'
const DEFAULT: Lang = 'es'

// Español viaja en el bundle principal (idioma por defecto, sin flash).
// Los demás idiomas se descargan como chunk separado solo cuando se usan.
const LOADERS: Record<Exclude<Lang, 'es'>, () => Promise<{ default: TranslationMap }>> = {
  en: () => import('@/lib/i18n/en'),
  fr: () => import('@/lib/i18n/fr'),
  pt: () => import('@/lib/i18n/pt'),
}

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

export const LanguageContext = createContext<LanguageContextValue>({
  lang: 'es',
  setLang: () => {},
  t: (k) => k,
})

export function useLanguage() {
  return useContext(LanguageContext)
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT)
  const [dicts, setDicts] = useState<Partial<Record<Lang, TranslationMap>>>({ es })

  const cargarIdioma = useCallback((l: Lang) => {
    if (l === 'es') return
    LOADERS[l]()
      .then((mod) => setDicts((prev) => (prev[l] ? prev : { ...prev, [l]: mod.default })))
      .catch((err: unknown) => console.warn('[i18n] No se pudo cargar el idioma', l, err))
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null
    if (stored && LANGS.includes(stored)) {
      setLangState(stored)
      cargarIdioma(stored)
    }
  }, [cargarIdioma])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
    cargarIdioma(l)
  }

  // Mientras carga un idioma no-es se muestra español, nunca keys crudas
  function t(key: string): string {
    return dicts[lang]?.[key] ?? es[key] ?? key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}
