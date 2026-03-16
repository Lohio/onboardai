import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Combina clases de Tailwind resolviendo conflictos correctamente
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
