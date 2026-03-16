'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-indigo-600/15 text-indigo-300 border-indigo-500/25',
  success: 'bg-teal-600/15 text-teal-400 border-teal-500/25',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  error:   'bg-red-500/15 text-red-300 border-red-500/25',
  info:    'bg-sky-500/15 text-sky-300 border-sky-500/25',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'inline-flex items-center gap-1',
        'px-2 py-0.5',
        'text-xs font-medium',
        'rounded-md border',
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
