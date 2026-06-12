'use client'

// Helpers compartidos del módulo Rol (M3) — extraídos de src/app/empleado/rol/page.tsx

import {
  MessageSquare, FileText, Code, Globe,
  Mail, Calendar, BarChart2,
  Briefcase, Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

export function modalidadVariant(m: string): 'info' | 'default' | 'success' {
  if (m === 'presencial') return 'info'
  if (m === 'remoto') return 'success'
  return 'default'
}

// ─────────────────────────────────────────────
// Markdown renderer
// ─────────────────────────────────────────────

export function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n')

  const renderInline = (raw: string): React.ReactNode => {
    const parts = raw.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} className="text-gray-900 font-semibold">{part.slice(2, -2)}</strong>
        : part
    )
  }

  const elements: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []
  let orderedItems: React.ReactNode[] = []
  let listCounter = 0
  let key = 0

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="space-y-2 my-3">
          {listItems}
        </ul>
      )
      listItems = []
    }
    if (orderedItems.length > 0) {
      elements.push(
        <ol key={key++} className="space-y-2 my-3">
          {orderedItems}
        </ol>
      )
      orderedItems = []
      listCounter = 0
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { flushList(); continue }

    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={key++} className="flex items-center gap-2 text-sm font-bold text-amber-600 mt-5 mb-2">
          <span className="w-1 h-4 rounded-full bg-amber-400 flex-shrink-0" />
          {renderInline(trimmed.slice(4))}
        </h3>
      )
    } else if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={key++} className="text-base font-bold text-gray-900 mt-6 mb-3 pb-2 border-b border-gray-200">
          {renderInline(trimmed.slice(3))}
        </h2>
      )
    } else if (trimmed.startsWith('# ')) {
      flushList()
      elements.push(
        <h1 key={key++} className="text-lg font-bold text-gray-900 mt-6 mb-3">
          {renderInline(trimmed.slice(2))}
        </h1>
      )
    } else if (/^\d+\.\s/.test(trimmed)) {
      listCounter++
      const content = trimmed.replace(/^\d+\.\s/, '')
      orderedItems.push(
        <li key={key++} className="flex items-start gap-3 text-gray-600">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold font-mono flex items-center justify-center mt-0.5">
            {listCounter}
          </span>
          <span className="leading-relaxed">{renderInline(content)}</span>
        </li>
      )
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushList()
      const content = trimmed.slice(2)
      listItems.push(
        <li key={key++} className="flex items-start gap-2.5 text-gray-500">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
          <span className="leading-relaxed">{renderInline(content)}</span>
        </li>
      )
    } else {
      flushList()
      elements.push(
        <p key={key++} className="text-gray-500 leading-relaxed">
          {renderInline(trimmed)}
        </p>
      )
    }
  }
  flushList()

  return <div className="text-sm space-y-1">{elements}</div>
}

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

export const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

export const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

export const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1, x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 26 },
  },
}

// ─────────────────────────────────────────────
// Helpers — ícono de herramienta
// ─────────────────────────────────────────────

const ICONO_MAP: Record<string, React.ReactNode> = {
  MessageSquare: <MessageSquare className="w-5 h-5" />,
  FileText:      <FileText      className="w-5 h-5" />,
  Code:          <Code          className="w-5 h-5" />,
  Globe:         <Globe         className="w-5 h-5" />,
  Mail:          <Mail          className="w-5 h-5" />,
  Calendar:      <Calendar      className="w-5 h-5" />,
  BarChart2:     <BarChart2     className="w-5 h-5" />,
  Briefcase:     <Briefcase     className="w-5 h-5" />,
  Wrench:        <Wrench        className="w-5 h-5" />,
}

export function getIcono(nombre?: string): React.ReactNode {
  if (!nombre) return <Wrench className="w-5 h-5" />
  return ICONO_MAP[nombre] ?? <Wrench className="w-5 h-5" />
}

// ─────────────────────────────────────────────
// Semáforo de autonomía
// ─────────────────────────────────────────────

export function SemaforoNivel({ nivel, active }: { nivel: 'solo' | 'consultar' | 'escalar'; active: boolean }) {
  const styles: Record<string, { active: string; inactive: string }> = {
    solo:      { active: 'bg-teal-100 text-teal-600 border-teal-300', inactive: 'bg-gray-50 text-gray-300 border-gray-200' },
    consultar: { active: 'bg-amber-100 text-amber-600 border-amber-300', inactive: 'bg-gray-50 text-gray-300 border-gray-200' },
    escalar:   { active: 'bg-red-100 text-red-600 border-red-300', inactive: 'bg-gray-50 text-gray-300 border-gray-200' },
  }
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-5 h-5 rounded-full border transition-all duration-200',
      active ? styles[nivel].active : styles[nivel].inactive,
    )}>
      {active && <span className="w-2 h-2 rounded-full bg-current opacity-80" />}
    </span>
  )
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

export function SkeletonRol() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-36 rounded-xl bg-white border border-gray-200 shadow-sm" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="shimmer w-8 h-8 rounded-xl" />
            <div className="shimmer h-4 w-36 rounded" />
          </div>
          <div className="shimmer h-3 w-full rounded" />
          <div className="shimmer h-3 w-3/4 rounded" />
          <div className="shimmer h-3 w-5/6 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// SectionHeader — label de sección
// ─────────────────────────────────────────────

export function SectionHeader({
  icon,
  title,
  subtitle,
  iconBg,
  iconText,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  iconBg: string
  iconText: string
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', iconBg, iconText)}>
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
