'use client'

import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'
import { crearSuscripcionLocal } from '@/lib/suscripcionLocal'

export type Theme = 'theme-dark' | 'theme-light' | 'theme-gray'

const THEMES: Theme[] = ['theme-dark', 'theme-light', 'theme-gray']
const DEFAULT: Theme = 'theme-dark'

function storageKey(section: string) {
  return `onboard_theme_${section}`
}

// Avisa a los ThemeProvider montados cuando applyTheme escribe localStorage
const store = crearSuscripcionLocal()

// Context expone sección, tema actual y setter reactivo
export const ThemeContext = createContext<{
  section: string
  currentTheme: Theme
  setTheme: (t: Theme) => void
}>({
  section: 'admin',
  currentTheme: DEFAULT,
  setTheme: () => {},
})

export function useThemeSection() {
  return useContext(ThemeContext).section
}

export function getStoredTheme(section: string): Theme {
  if (typeof window === 'undefined') return DEFAULT
  const stored = localStorage.getItem(storageKey(section))
  if (THEMES.includes(stored as Theme)) return stored as Theme
  // Default por sección: empleado → light, admin/dev → dark
  return section === 'empleado' ? 'theme-light' : DEFAULT
}

export function applyTheme(theme: Theme, section: string) {
  const html = document.documentElement
  THEMES.forEach(t => html.classList.remove(t))
  html.classList.add(theme)
  localStorage.setItem(storageKey(section), theme)
  store.notify()
}

// Fuerza tema oscuro (para auth/login)
export function forceDark() {
  const html = document.documentElement
  THEMES.forEach(t => html.classList.remove(t))
  // Sin clase extra: :root defaults al tema oscuro
}

export function ThemeProvider({
  children,
  section,
}: {
  children: React.ReactNode
  section: string
}) {
  // Tema leído de localStorage al hidratar (en el server: DEFAULT, como antes).
  // useSyncExternalStore evita el setState-en-efecto que disparaba un render extra.
  const currentTheme = useSyncExternalStore(
    store.subscribe,
    () => getStoredTheme(section),
    () => DEFAULT,
  )

  // Aplica la clase al <html> al montar y cuando cambia el tema o la sección
  useEffect(() => {
    applyTheme(currentTheme, section)
  }, [currentTheme, section])

  function setTheme(theme: Theme) {
    applyTheme(theme, section)
  }

  return (
    <ThemeContext.Provider value={{ section, currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
