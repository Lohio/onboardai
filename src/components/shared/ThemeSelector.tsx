'use client'

import { useState, useEffect, useContext } from 'react'
import { Check } from 'lucide-react'
import {
  type Theme,
  applyTheme,
  getStoredTheme,
  ThemeContext,
} from '@/components/ThemeProvider'

const OPCIONES: { value: Theme; label: string; bg: string; surface: string; text: string }[] = [
  {
    value: 'theme-dark',
    label: 'Oscuro',
    bg: '#111110',
    surface: '#1a1a18',
    text: '#ffffff',
  },
  {
    value: 'theme-light',
    label: 'Claro',
    bg: '#f8f8f7',
    surface: '#ffffff',
    text: '#111110',
  },
]

export function ThemeSelector() {
  const { section } = useContext(ThemeContext)
  const [current, setCurrent] = useState<Theme>('theme-dark')

  useEffect(() => {
    setCurrent(getStoredTheme(section))
  }, [section])

  function handleSelect(theme: Theme) {
    setCurrent(theme)
    applyTheme(theme, section)
  }

  return (
    <div className="flex gap-3 flex-wrap">
      {OPCIONES.map(op => {
        const active = current === op.value
        return (
          <button
            key={op.value}
            type="button"
            onClick={() => handleSelect(op.value)}
            className={`relative flex-1 min-w-[100px] rounded-xl border-2 p-1.5 transition-all duration-150
              ${active
                ? 'border-sky-500 shadow-[0_0_0_1px_rgba(14,165,233,0.3)]'
                : 'border-transparent hover:border-white/20'
              }`}
            aria-label={`Tema ${op.label}`}
          >
            {/* Preview del tema */}
            <div
              className="rounded-lg overflow-hidden h-14"
              style={{ background: op.bg }}
            >
              {/* Barra superior simulada */}
              <div
                className="h-3 w-full flex items-center gap-1 px-2"
                style={{ background: op.surface }}
              >
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{ width: 20 + i * 10, height: 3, background: op.text, opacity: 0.15 }}
                  />
                ))}
              </div>
              {/* Contenido simulado */}
              <div className="px-2 pt-1.5 space-y-1">
                <div className="rounded" style={{ height: 4, width: '60%', background: op.text, opacity: 0.25 }} />
                <div className="rounded" style={{ height: 3, width: '85%', background: op.text, opacity: 0.10 }} />
                <div className="rounded" style={{ height: 3, width: '45%', background: op.text, opacity: 0.10 }} />
              </div>
            </div>

            {/* Label + check */}
            <div className="flex items-center justify-between mt-1.5 px-0.5">
              <span className="text-xs font-medium text-white/70">{op.label}</span>
              {active && <Check className="w-3 h-3 text-sky-400" />}
            </div>
          </button>
        )
      })}
    </div>
  )
}
