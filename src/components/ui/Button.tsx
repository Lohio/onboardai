'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

// Estilos por variante
const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-indigo-600 text-white',
    'hover:bg-indigo-500',
    'shadow-[0_0_20px_rgba(59,79,216,0.25)]',
    'hover:shadow-[0_0_28px_rgba(59,79,216,0.4)]',
  ].join(' '),
  secondary: [
    'bg-surface-700 text-white/85',
    'border border-white/10',
    'hover:bg-surface-600 hover:border-white/20',
  ].join(' '),
  ghost: [
    'text-white/65',
    'hover:text-white hover:bg-white/5',
  ].join(' '),
  danger: [
    'bg-red-600 text-white',
    'hover:bg-red-500',
    'shadow-[0_0_20px_rgba(220,38,38,0.2)]',
    'hover:shadow-[0_0_28px_rgba(220,38,38,0.35)]',
  ].join(' '),
}

// Estilos por tamaño
const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-xs gap-1.5 rounded-md',
  md: 'min-h-[44px] px-4 text-sm gap-2 rounded-lg',
  lg: 'min-h-[44px] px-5 text-base gap-2.5 rounded-xl',
}

// Dimensiones del spinner según tamaño
const spinnerSize: Record<ButtonSize, number> = {
  sm: 12,
  md: 14,
  lg: 18,
}

// Spinner animado
function Spinner({ size }: { size: ButtonSize }) {
  const dim = spinnerSize[size]
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 14 14"
      fill="none"
      className="animate-spin-fast flex-shrink-0"
      aria-hidden="true"
    >
      <circle
        cx="7"
        cy="7"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.25"
      />
      <path
        d="M7 1.5A5.5 5.5 0 0 1 12.5 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <motion.button
      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
      whileTap={!isDisabled ? { scale: 0.97 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        // Base
        'relative inline-flex items-center justify-center font-medium',
        'transition-colors duration-150 cursor-pointer select-none',
        // Focus
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-indigo-500/50 focus-visible:ring-offset-1',
        'focus-visible:ring-offset-surface-900',
        // Disabled
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        variantStyles[variant],
        sizeStyles[size],
        loading && 'cursor-wait',
        className,
      )}
      disabled={isDisabled}
      aria-busy={loading}
      {...(props as HTMLMotionProps<'button'>)}
    >
      {loading && <Spinner size={size} />}
      <span className={cn('transition-opacity duration-150', loading && 'opacity-60')}>
        {children}
      </span>
    </motion.button>
  )
}

export type { ButtonProps, ButtonVariant, ButtonSize }
