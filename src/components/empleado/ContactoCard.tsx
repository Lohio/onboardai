'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Mail, Briefcase, Users, Shield, Code,
  Copy, Check, Video, User, MessageSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { buildContactUrl, getHerramientaLabel, type HerramientaContacto } from '@/lib/contacto'

// ─────────────────────────────────────────────
// Íconos inline (sin dependencias externas)
// ─────────────────────────────────────────────

function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-3.5 h-3.5', className)} fill="currentColor" aria-hidden>
      <path d="M19.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM14 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm4.5 1H17a5 5 0 0 1 1 3H22a1 1 0 0 0 1-1v-.5c0-.83-.67-1.5-1.5-1.5zM13 9H8a2 2 0 0 0-2 2v5.5A4.5 4.5 0 0 0 10.5 21h3a4.5 4.5 0 0 0 4.5-4.5V11a2 2 0 0 0-2-2z" />
    </svg>
  )
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-3.5 h-3.5', className)} fill="currentColor" aria-hidden>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.27 0a2.527 2.527 0 0 1 2.52-2.52 2.527 2.527 0 0 1 2.52 2.52v6.313A2.528 2.528 0 0 1 8.833 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.52-10.12a2.528 2.528 0 0 1-2.52-2.523A2.527 2.527 0 0 1 8.833 0a2.528 2.528 0 0 1 2.52 2.522v2.52H8.833zm0 1.272a2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522H2.522A2.528 2.528 0 0 1 0 8.837a2.528 2.528 0 0 1 2.522-2.52h6.311zm10.122 2.52a2.528 2.528 0 0 1 2.522-2.52A2.528 2.528 0 0 1 24 8.837a2.528 2.528 0 0 1-2.522 2.522h-2.52V8.837zm-1.268 0a2.528 2.528 0 0 1-2.523 2.522 2.527 2.527 0 0 1-2.52-2.522V2.522A2.527 2.527 0 0 1 15.167 0a2.528 2.528 0 0 1 2.523 2.522v6.315zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.167 24a2.527 2.527 0 0 1-2.52-2.522v-2.52h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-3.5 h-3.5', className)} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

// ─────────────────────────────────────────────
// Config por tipo de contacto
// ─────────────────────────────────────────────

const TIPO_CONFIG = {
  manager: {
    label:       'Manager',
    descripcion: 'Tu manager directo',
    Icon:        Briefcase,
    avatarBg:    'bg-[#0EA5E9]/20',
    avatarText:  'text-[#38BDF8]',
  },
  buddy: {
    label:       'Buddy',
    descripcion: 'Tu buddy',
    Icon:        Users,
    avatarBg:    'bg-teal-600/15',
    avatarText:  'text-teal-400',
  },
  it: {
    label:       'IT',
    descripcion: 'Soporte técnico',
    Icon:        Code,
    avatarBg:    'bg-sky-600/15',
    avatarText:  'text-sky-300',
  },
  rrhh: {
    label:       'RRHH',
    descripcion: 'Recursos Humanos',
    Icon:        Shield,
    avatarBg:    'bg-amber-600/15',
    avatarText:  'text-amber-300',
  },
} as const

type TipoContacto = keyof typeof TIPO_CONFIG

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getInitials(nombre: string): string {
  return nombre
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ─────────────────────────────────────────────
// Ícono de la herramienta seleccionada
// ─────────────────────────────────────────────

function HerramientaIcon({ h }: { h: string }) {
  if (h === 'teams')    return <TeamsIcon />
  if (h === 'slack')    return <SlackIcon />
  if (h === 'whatsapp') return <WhatsAppIcon />
  if (h === 'meet')     return <Video className="w-3.5 h-3.5" />
  if (h === 'email')    return <Mail className="w-3.5 h-3.5" />
  // Herramienta custom: ícono genérico
  return <MessageSquare className="w-3.5 h-3.5" />
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

interface ContactoCardProps {
  tipo: TipoContacto
  nombre?: string | null
  email?: string | null
  herramienta: string
}

export function ContactoCard({ tipo, nombre, email, herramienta }: ContactoCardProps) {
  const [copied, setCopied] = useState(false)
  const config = TIPO_CONFIG[tipo]
  const url    = email ? buildContactUrl(herramienta, email) : null

  const handleCopy = async () => {
    if (!email) return
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  // El manager tiene borde izquierdo destacado
  const esManager = tipo === 'manager'

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'flex flex-col gap-2 min-h-[110px] p-3',
        'bg-white/[0.02] border border-white/[0.05]',
        esManager
          ? 'border-l-2 border-l-[#0EA5E9]/50 rounded-r-xl'
          : 'rounded-xl',
      )}
    >
      {/* Avatar con iniciales o ícono muted si no hay nombre */}
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
        config.avatarBg,
        config.avatarText,
      )}>
        {nombre ? (
          <span className="text-xs font-semibold">{getInitials(nombre)}</span>
        ) : (
          <User className="w-4 h-4 opacity-40" />
        )}
      </div>

      {/* Nombre y descripción del rol */}
      <div className="flex-1">
        <p className={cn(
          'text-sm font-medium leading-tight truncate',
          nombre ? 'text-white/80' : 'text-white/20 italic',
        )}>
          {nombre || 'Por asignar'}
        </p>
        <p className="text-[10px] text-white/35 mt-0.5">
          {config.descripcion}
        </p>
      </div>

      {/* Botón de acción — separado por borde, solo si hay contacto */}
      {nombre && email ? (
        <div className="border-t border-white/[0.05] pt-2">
          {url ? (
            <a
              href={url}
              target={!url.startsWith('mailto:') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-white/30 hover:text-[#38BDF8] transition-colors duration-150"
            >
              <HerramientaIcon h={herramienta} />
              <span>{getHerramientaLabel(herramienta)}</span>
            </a>
          ) : (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-white/30 hover:text-[#38BDF8] transition-colors duration-150"
              title="Copiar email"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-teal-400" />
                  <span className="text-teal-400">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copiar email
                </>
              )}
            </button>
          )}
        </div>
      ) : null}
    </motion.div>
  )
}
