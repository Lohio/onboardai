'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  label?: string
  showPercentage?: boolean
  animated?: boolean
  className?: string
}

// Color de la barra según porcentaje
function getBarColor(value: number): string {
  if (value >= 70) return 'bg-teal-600'
  if (value >= 30) return 'bg-amber-500'
  return 'bg-red-500'
}

// Glow según porcentaje
function getGlowShadow(value: number): string {
  if (value >= 70) return '0 0 8px rgba(13, 148, 136, 0.5)'
  if (value >= 30) return '0 0 8px rgba(245, 158, 11, 0.5)'
  return '0 0 8px rgba(239, 68, 68, 0.5)'
}

export function ProgressBar({
  value,
  label,
  showPercentage = true,
  animated = true,
  className,
}: ProgressBarProps) {
  // Limita el valor entre 0 y 100
  const clamped = Math.min(100, Math.max(0, Math.round(value)))

  return (
    <div className={cn('w-full', className)}>
      {/* Etiqueta y porcentaje */}
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-sm text-white/55 font-medium">{label}</span>
          )}
          {showPercentage && (
            <span className="text-xs font-mono text-white/70 tabular-nums ml-auto">
              {clamped}%
            </span>
          )}
        </div>
      )}

      {/* Track de la barra */}
      <div className="relative h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        {/* Barra de progreso animada */}
        <motion.div
          className={cn('h-full rounded-full', getBarColor(clamped))}
          initial={animated ? { width: '0%' } : false}
          animate={{ width: `${clamped}%` }}
          transition={
            animated
              ? { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
              : { duration: 0 }
          }
          style={{ boxShadow: getGlowShadow(clamped) }}
        />
      </div>
    </div>
  )
}

export type { ProgressBarProps }
