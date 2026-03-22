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

// Color semáforo: ≥70% verde, 30-69% amber, <30% rojo
function getBarColor(value: number): string {
  if (value >= 70) return 'bg-[#22c55e]'
  if (value >= 30) return 'bg-amber-500'
  return 'bg-red-500'
}

function getGlowShadow(value: number): string {
  if (value >= 70) return '0 0 8px rgba(34,197,94,0.45)'
  if (value >= 30) return '0 0 8px rgba(245,158,11,0.45)'
  return '0 0 8px rgba(239,68,68,0.45)'
}

export function ProgressBar({
  value,
  label,
  showPercentage = true,
  animated = true,
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)))

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-sm text-white/55">{label}</span>
          )}
          {showPercentage && (
            <span className="text-xs text-white/60 tabular-nums ml-auto">
              {clamped}%
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div className="relative h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', getBarColor(clamped))}
          initial={animated ? { width: '0%' } : false}
          animate={{ width: `${clamped}%` }}
          transition={animated ? { duration: 0.8, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
          style={{ boxShadow: getGlowShadow(clamped) }}
        />
      </div>
    </div>
  )
}

export type { ProgressBarProps }
