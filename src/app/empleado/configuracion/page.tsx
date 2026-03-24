'use client'

import { motion } from 'framer-motion'
import { Palette } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { ThemeSelector } from '@/components/shared/ThemeSelector'

export default function ConfiguracionEmpleadoPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <h1 className="text-xl font-semibold text-white">Configuración</h1>
        <p className="text-sm text-white/40 mt-1">Preferencias personales</p>
      </motion.div>

      {/* Apariencia */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.05 }}
      >
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-4 h-4 text-sky-400" />
            <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest">
              Apariencia
            </h2>
          </div>
          <p className="text-xs text-white/40 mb-4">Elegí el tema visual de la aplicación.</p>
          <ThemeSelector />
        </Card>
      </motion.div>
    </div>
  )
}
