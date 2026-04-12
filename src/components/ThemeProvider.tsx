'use client'

import { createContext, useContext, useEffect } from 'react'

export type Theme = 'theme-dark' | 'theme-light' | 'theme-gray'

const THEMES: Theme[] = ['theme-dark', 'theme-light', 'theme-gray']
const DEFAULT: Theme = 'theme-dark'

function storageKey(section: string) {
  return `onboard_theme_${section}`
}

// Context para que ThemeSelector sepa en qué sección está
export const ThemeContext = createContext<{ section: string }>({ section: 'admin' })

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
  useEffect(() => {
    applyTheme(getStoredTheme(section), section)
  }, [section])

  return (
    <ThemeContext.Provider value={{ section }}>
      {children}
    </ThemeContext.Provider>
  )
}
