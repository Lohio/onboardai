'use client'

import { useState, useCallback } from 'react'
import { Lightbulb } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { useLanguage } from '@/components/LanguageProvider'
import { Button } from '@/components/ui/Button'
import type { SetupData } from '@/app/admin/setup/page'

// ─────────────────────────────────────────────
// Campos de cultura
// ─────────────────────────────────────────────

// `titulo` se guarda en DB (tabla conocimiento) — no se traduce.
// `labelKey`/`placeholderKey` son claves i18n que se traducen al renderizar.
const CAMPOS = [
  {
    key: 'historia',
    labelKey: 'adminSetup.s2HistoriaLabel',
    titulo: 'Historia de la empresa',
    placeholderKey: 'adminSetup.s2HistoriaPh',
  },
  {
    key: 'valores',
    labelKey: 'adminSetup.s2ValoresLabel',
    titulo: 'Valores y cultura',
    placeholderKey: 'adminSetup.s2ValoresPh',
  },
  {
    key: 'como_trabajamos',
    labelKey: 'adminSetup.s2ComoLabel',
    titulo: 'Cómo trabajamos',
    placeholderKey: 'adminSetup.s2ComoPh',
  },
] as const

const textareaCls = [
  'w-full min-h-[100px] text-sm text-white placeholder:text-white/25',
  'bg-surface-800/80 rounded-lg p-3 resize-none',
  'border border-white/[0.07] hover:border-white/15',
  'transition-all duration-150 outline-none',
  'focus:ring-2 focus:ring-[#0EA5E9]/30 focus:border-[#0EA5E9]/40',
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
  const { t } = useLanguage()
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
      toast.error(err instanceof Error ? err.message : t('adminSetup.errGuardar'))
    } finally {
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <h2 className="text-xl font-semibold text-white mb-1">{t('adminSetup.s2Titulo')}</h2>
        <p className="text-sm text-white/45 max-w-sm">
          {t('adminSetup.s2Subtitulo')}
        </p>
      </div>

      <div className="space-y-5">
        {CAMPOS.map(campo => (
          <div key={campo.key}>
            <label className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase">
              {t(campo.labelKey)}
            </label>
            <textarea
              value={valores[campo.key]}
              onChange={e => setValores(prev => ({ ...prev, [campo.key]: e.target.value }))}
              placeholder={t(campo.placeholderKey)}
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
          {saving ? t('adminSetup.guardando') : t('adminSetup.continuar')}
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={onSkip}
          disabled={saving}
          className="flex-1 sm:flex-none"
        >
          {t('adminSetup.omitir')}
        </Button>
      </div>
    </div>
  )
}
