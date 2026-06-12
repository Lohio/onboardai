'use client'

// ─────────────────────────────────────────────
// Helpers compartidos de la página de contenido (admin)
// ─────────────────────────────────────────────

import { motion } from 'framer-motion'
import { FileText, Building2, FolderOpen, Briefcase, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { CapaDef } from './types'

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

export const CAPAS: CapaDef[] = [
  { key: 'empresa',  label: 'Empresa',     icon: <Building2   className="w-3.5 h-3.5" /> },
  { key: 'area',     label: 'Área',        icon: <FolderOpen  className="w-3.5 h-3.5" /> },
  { key: 'rol',      label: 'Rol',         icon: <Briefcase   className="w-3.5 h-3.5" /> },
  { key: 'empleado', label: 'Colaborador', icon: <UserCheck   className="w-3.5 h-3.5" /> },
]

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

export const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

export const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

// ─────────────────────────────────────────────
// Skeleton de carga
// ─────────────────────────────────────────────

export function SkeletonBloques() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="shimmer glass-card rounded-xl h-20" />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Empty state por módulo
// ─────────────────────────────────────────────

export function EmptyState({ label, onAgregar }: { label: string; onAgregar: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 gap-3"
    >
      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
        <FileText className="w-5 h-5 text-white/20" />
      </div>
      <div className="text-center">
        <p className="text-sm text-white/50 font-medium">Sin bloques de contenido</p>
        <p className="text-xs text-white/30 mt-0.5">
          Agregá conocimiento sobre {label.toLowerCase()} para nutrir al asistente IA
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onAgregar}>
        Comenzar
      </Button>
    </motion.div>
  )
}
