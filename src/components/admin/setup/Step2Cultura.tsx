'use client'

import { useState, useCallback } from 'react'
import { Lightbulb } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import type { SetupData } from '@/app/admin/setup/page'

// ─────────────────────────────────────────────
// Campos de cultura
// ─────────────────────────────────────────────

const CAMPOS = [
  {
    key: 'historia',
    label: 'Historia y misión',
    titulo: 'Historia de la empresa',
    placeholder: '¿Cuándo y cómo nació la empresa?\n¿Cuál es su propósito?',
  },
  {
    key: 'valores',
    label: 'Valores y cultura',
    titulo: 'Valores y cultura',
    placeholder: '¿Qué valores guían el trabajo?\n¿Cómo es el ambiente laboral?',
  },
  {
    key: 'como_trabajamos',
    label: 'Cómo trabajamos',
    titulo: 'Cómo trabajamos',
    placeholder: '¿Cuál es la modalidad? ¿Cómo se organizan los equipos?\n¿Qué herramientas usan?',
  },
] as const

const textareaCls = [
  'w-full min-h-[100px] text-sm text-white placeholder:text-white/25',
  'bg-surface-800/80 rounded-lg p-3 resize-none',
  'border border-white/[0.07] hover:border-white/15',
  'transition-all duration-150 outline-none',
  'focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50',
].join(' ')

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────

interface Step2Props {
  setupData: SetupData
  onNext: () => void
  onSkip: () => void
}

export function Step2Cultura({ setupData, onNext, onSkip }: Step2Props) {
  const [valores, setValores] = useState<Record<string, string>>({
    historia: '', valores: '', como_trabajamos: '',
  })
  const [saving, setSaving] = useState(false)

  const handleContinuar = useCallback(async () => {
    // Filtrar campos con contenido
    const conContenido = CAMPOS.filter(c => valores[c.key]?.trim())

    if (conContenido.length === 0) {
      // Sin contenido es como omitir
      onNext()
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()

      // Eliminar entradas previas de cultura para esta empresa (evita duplicados)
      await supabase
        .from('conocimiento')
        .delete()
        .eq('empresa_id', setupData.empresaId)
        .eq('modulo', 'cultura')

      const inserts = conContenido.map(campo => ({
        empresa_id: setupData.empresaId,
        modulo: 'cultura',
        bloque: campo.key,
        titulo: campo.titulo,
        contenido: valores[campo.key].trim(),
      }))

      const { error } = await supabase
        .from('conocimiento')
        .insert(inserts)

      if (error) throw new Error(error.message)

      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [valores, setupData.empresaId, onNext])

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8">
      {/* Ícono y título */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/30
          flex items-center justify-center mb-4
          shadow-[0_0_32px_rgba(13,148,136,0.2)]">
          <Lightbulb className="w-8 h-8 text-teal-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-1">Cultura e identidad</h2>
        <p className="text-sm text-white/45 max-w-sm">
          Este contenido es lo que el asistente IA usará para responder
          preguntas de tus empleados.
        </p>
      </div>

      <div className="space-y-5">
        {CAMPOS.map(campo => (
          <div key={campo.key}>
            <label className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase">
              {campo.label}
            </label>
            <textarea
              value={valores[campo.key]}
              onChange={e => setValores(prev => ({ ...prev, [campo.key]: e.target.value }))}
              placeholder={campo.placeholder}
              className={textareaCls}
              rows={4}
            />
          </div>
        ))}
      </div>

      {/* Botones */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Button
          variant="primary"
          size="md"
          loading={saving}
          onClick={handleContinuar}
          className="flex-1"
        >
          {saving ? 'Guardando...' : 'Continuar'}
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={onSkip}
          disabled={saving}
          className="flex-1 sm:flex-none"
        >
          Omitir por ahora
        </Button>
      </div>
    </div>
  )
}
