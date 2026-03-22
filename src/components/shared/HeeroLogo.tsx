import Image from 'next/image'
import { cn } from '@/lib/utils'

// Tamaños del logo de Heero
type LogoSize = 'sm' | 'md' | 'lg'

interface HeeroLogoProps {
  size?: LogoSize
  className?: string
}

const heightMap: Record<LogoSize, number> = {
  sm: 20,
  md: 28,
  lg: 40,
}

const widthMap: Record<LogoSize, number> = {
  sm: 75,
  md: 105,
  lg: 150,
}

export default function HeeroLogo({ size = 'md', className }: HeeroLogoProps) {
  return (
    <Image
      src="/heero-logo.svg"
      alt="Heero"
      width={widthMap[size]}
      height={heightMap[size]}
      className={cn('object-contain', className)}
      priority
    />
  )
}
