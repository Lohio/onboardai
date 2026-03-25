// src/components/icons/HerramientaIcon.tsx
// Fuente única de verdad para íconos de herramientas de contacto.
// Usado en: ContactoCard, configuracion/page, Step3Contacto.

import { Mail, Video, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// SVG primitivos (sin tamaño hardcodeado — lo recibe el padre)
// ─────────────────────────────────────────────

export function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('w-4 h-4', className)}
      fill="currentColor"
      aria-hidden
    >
      <path d="M19.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM14 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm4.5 1H17a5 5 0 0 1 1 3H22a1 1 0 0 0 1-1v-.5c0-.83-.67-1.5-1.5-1.5zM13 9H8a2 2 0 0 0-2 2v5.5A4.5 4.5 0 0 0 10.5 21h3a4.5 4.5 0 0 0 4.5-4.5V11a2 2 0 0 0-2-2z" />
    </svg>
  )
}

export function SlackIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('w-4 h-4', className)}
      fill="currentColor"
      aria-hidden
    >
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.27 0a2.527 2.527 0 0 1 2.52-2.52 2.527 2.527 0 0 1 2.52 2.52v6.313A2.528 2.528 0 0 1 8.833 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.52-10.12a2.528 2.528 0 0 1-2.52-2.523A2.527 2.527 0 0 1 8.833 0a2.528 2.528 0 0 1 2.52 2.522v2.52H8.833zm0 1.272a2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522H2.522A2.528 2.528 0 0 1 0 8.837a2.528 2.528 0 0 1 2.522-2.52h6.311zm10.122 2.52a2.528 2.528 0 0 1 2.522-2.52A2.528 2.528 0 0 1 24 8.837a2.528 2.528 0 0 1-2.522 2.522h-2.52V8.837zm-1.268 0a2.528 2.528 0 0 1-2.523 2.522 2.527 2.527 0 0 1-2.52-2.522V2.522A2.527 2.527 0 0 1 15.167 0a2.528 2.528 0 0 1 2.523 2.522v6.315zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.167 24a2.527 2.527 0 0 1-2.52-2.522v-2.52h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  )
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('w-4 h-4', className)}
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

// ─────────────────────────────────────────────
// Componente principal — el único que se usa en toda la app
// Recibe herramienta como string y className opcional para el tamaño
// ─────────────────────────────────────────────

interface HerramientaIconProps {
  herramienta: string
  className?: string
}

export function HerramientaIcon({ herramienta, className }: HerramientaIconProps) {
  if (herramienta === 'teams')    return <TeamsIcon className={className} />
  if (herramienta === 'slack')    return <SlackIcon className={className} />
  if (herramienta === 'whatsapp') return <WhatsAppIcon className={className} />
  if (herramienta === 'meet')     return <Video className={cn('w-4 h-4', className)} />
  if (herramienta === 'email')    return <Mail className={cn('w-4 h-4', className)} />
  // Herramienta custom desconocida
  return <MessageSquare className={cn('w-4 h-4', className)} />
}
