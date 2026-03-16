'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

type PaddingSize = 'none' | 'sm' | 'md' | 'lg'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  padding?: PaddingSize
}

const paddingStyles: Record<PaddingSize, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
}

export function Card({ children, className, onClick, padding = 'md' }: CardProps) {
  const baseClasses = cn(
    'glass-card rounded-xl',
    paddingStyles[padding],
    className,
  )

  // Card interactiva con animación hover
  if (onClick) {
    return (
      <motion.div
        className={cn(baseClasses, 'cursor-pointer')}
        onClick={onClick}
        whileHover={{
          scale: 1.01,
          y: -2,
        }}
        whileTap={{ scale: 0.995 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{ willChange: 'transform' }}
      >
        {children}
      </motion.div>
    )
  }

  // Card estática (compatible con Server Components)
  return (
    <div className={baseClasses}>
      {children}
    </div>
  )
}

export type { CardProps, PaddingSize }
