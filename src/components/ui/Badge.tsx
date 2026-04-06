'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'teal' | 'amber' | 'indigo'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

// Variantes con paleta Heero
const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[#0EA5E9]/12 text-[#38BDF8] border-[#0EA5E9]/25',
  success: 'bg-[#22c55e]/12 text-[#4ade80] border-[#22c55e]/25',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  error:   'bg-red-500/15 text-red-300 border-red-500/25',
  info:    'bg-[#0EA5E9]/10 text-[#7DD3FC] border-[#0EA5E9]/20',
  teal:    'bg-teal-500/15 text-teal-300 border-teal-500/25',
  amber:   'bg-amber-500/15 text-amber-300 border-amber-500/25',
  indigo:  'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'inline-flex items-center gap-1',
        'px-2.5 py-0.5',
        'text-[11px] font-medium tracking-wide',
        'rounded-full border',
        'transition-colors duration-150',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </motion.span>
  )
}

export type { BadgeProps, BadgeVariant }
