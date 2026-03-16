'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  mensaje?: string
  onRetry: () => void
  className?: string
}

// Estado de error reutilizable con SVG monocromático indigo/teal.
// Usar en cualquier página donde un try/catch falle al cargar datos.
export function ErrorState({
  mensaje = 'No se pudieron cargar los datos.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center justify-center gap-4 py-16', className)}
    >
      {/* SVG: triángulo de advertencia monocromático */}
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="errGrad" x1="0" y1="0" x2="72" y2="72" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B4FD8" stopOpacity="0.4" />
            <stop offset="1" stopColor="#0D9488" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <path
          d="M36 12L62 58H10L36 12Z"
          stroke="url(#errGrad)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line x1="36" y1="30" x2="36" y2="44" stroke="url(#errGrad)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="36" cy="50.5" r="1.5" fill="url(#errGrad)" />
      </svg>

      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-white/50">Algo salió mal</p>
        <p className="text-xs text-white/30">{mensaje}</p>
      </div>

      <button
        onClick={onRetry}
        className="min-h-[44px] px-6 rounded-lg border border-indigo-500/30 text-sm text-indigo-400
          hover:bg-indigo-600/10 hover:border-indigo-500/50 transition-colors duration-150"
      >
        Reintentar
      </button>
    </motion.div>
  )
}
