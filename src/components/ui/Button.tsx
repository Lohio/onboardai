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

// Estilos por variante — paleta Heero
const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-[#0EA5E9] text-[#111110]',
    'hover:bg-[#0284C7]',
    'shadow-[0_0_20px_rgba(14,165,233,0.2)]',
    'hover:shadow-[0_0_28px_rgba(14,165,233,0.35)]',
    'font-medium',
  ].join(' '),
  secondary: [
    'bg-white/[0.06] text-white/80',
    'border border-white/[0.12]',
    'hover:bg-white/[0.10] hover:border-white/20',
  ].join(' '),
  ghost: [
    'text-white/60',
    'hover:text-white hover:bg-white/[0.05]',
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
  md: 'min-h-[44px] px-5 text-sm gap-2 rounded-lg',
  lg: 'min-h-[44px] px-6 text-[15px] gap-2.5 rounded-xl',
}

const spinnerSize: Record<ButtonSize, number> = { sm: 12, md: 14, lg: 18 }

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
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
      whileHover={!isDisabled ? { scale: 1.02, y: -1 } : undefined}
      whileTap={!isDisabled ? { scale: 0.97 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'relative inline-flex items-center justify-center',
        'font-[\'Instrument_Sans\'] transition-colors duration-150 cursor-pointer select-none',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-[#0EA5E9]/50 focus-visible:ring-offset-1',
        'focus-visible:ring-offset-[#111110]',
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
