'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Briefcase, Users, Shield, Code,
  Copy, Check, User, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { buildContactUrl, getHerramientaLabel } from '@/lib/contacto'
import { HerramientaIcon } from '@/components/icons/HerramientaIcon'

// ─────────────────────────────────────────────
// Config por tipo de contacto
// ─────────────────────────────────────────────

const TIPO_CONFIG = {
  manager: {
    label:       'Manager',
    descripcion: 'Tu manager directo',
    Icon:        Briefcase,
    avatarBg:    'bg-sky-100',
    avatarText:  'text-sky-700',
  },
  buddy: {
    label:       'Buddy',
    descripcion: 'Tu buddy',
    Icon:        Users,
    avatarBg:    'bg-teal-100',
    avatarText:  'text-teal-700',
  },
  it: {
    label:       'IT',
    descripcion: 'Soporte técnico',
    Icon:        Code,
    avatarBg:    'bg-indigo-100',
    avatarText:  'text-indigo-700',
  },
  rrhh: {
    label:       'RRHH',
    descripcion: 'Recursos Humanos',
    Icon:        Shield,
    avatarBg:    'bg-amber-100',
    avatarText:  'text-amber-700',
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

  const esManager = tipo === 'manager'

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'flex flex-col gap-2 min-h-[110px] p-3',
        'rounded-lg bg-gray-50 border border-gray-200',
        esManager && 'border-l-2 border-l-sky-500',
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
          <User className="w-4 h-4 opacity-50" />
        )}
      </div>

      {/* Nombre y descripción del rol */}
      <div className="flex-1">
        <p className={cn(
          'text-sm leading-tight truncate flex items-center gap-1.5',
          nombre ? 'font-semibold text-gray-900' : 'text-xs text-gray-400 italic',
        )}>
          {nombre ? (
            nombre
          ) : (
            <>
              <Clock className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
              <span>Pendiente de asignación</span>
            </>
          )}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {config.descripcion}
        </p>
      </div>

      {/* Botón de acción — separado por borde, solo si hay contacto */}
      {nombre && email ? (
        <div className="border-t border-gray-200 pt-2">
          {url ? (
            <a
              href={url}
              target={!url.startsWith('mailto:') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-sky-600 transition-colors duration-150"
            >
              <HerramientaIcon herramienta={herramienta} className="w-3.5 h-3.5" />
              <span>{getHerramientaLabel(herramienta)}</span>
            </a>
          ) : (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-sky-600 transition-colors duration-150"
              title="Copiar email"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-teal-600" />
                  <span className="text-teal-600">Copiado</span>
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
