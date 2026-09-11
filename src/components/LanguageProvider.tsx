'use client'

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { type Lang, type TranslationMap, LANGS } from '@/lib/i18n'
import es from '@/lib/i18n/es'
import { crearSuscripcionLocal } from '@/lib/suscripcionLocal'

const STORAGE_KEY = 'onboard_lang'
const DEFAULT: Lang = 'es'

// Español viaja en el bundle principal (idioma por defecto, sin flash).
// Los demás idiomas se descargan como chunk separado solo cuando se usan.
const LOADERS: Record<Exclude<Lang, 'es'>, () => Promise<{ default: TranslationMap }>> = {
  en: () => import('@/lib/i18n/en'),
  fr: () => import('@/lib/i18n/fr'),
  pt: () => import('@/lib/i18n/pt'),
}

// Idioma persistido en localStorage, expuesto como store para useSyncExternalStore
const store = crearSuscripcionLocal()

function leerIdiomaGuardado(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY) as Lang | null
  return stored && LANGS.includes(stored) ? stored : DEFAULT
}

const idiomaServidor = () => DEFAULT

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
  // Idioma leído de localStorage al hidratar (en el server: español, como antes)
  const lang = useSyncExternalStore(store.subscribe, leerIdiomaGuardado, idiomaServidor)
  const [dicts, setDicts] = useState<Partial<Record<Lang, TranslationMap>>>({ es })

  const cargarIdioma = useCallback((l: Lang) => {
    if (l === 'es') return
    LOADERS[l]()
      .then((mod) => setDicts((prev) => (prev[l] ? prev : { ...prev, [l]: mod.default })))
      .catch((err: unknown) => console.warn('[i18n] No se pudo cargar el idioma', l, err))
  }, [])

  // Descarga el diccionario del idioma activo (al hidratar con uno guardado y al cambiarlo)
  useEffect(() => {
    cargarIdioma(lang)
  }, [lang, cargarIdioma])

  function setLang(l: Lang) {
    localStorage.setItem(STORAGE_KEY, l)
    store.notify()
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
