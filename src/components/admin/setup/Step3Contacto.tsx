'use client'

import { useState, useCallback } from 'react'
import { MessageSquare, Check, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { useLanguage } from '@/components/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { HERRAMIENTA_LABELS } from '@/lib/contacto'
import { HerramientaIcon } from '@/components/icons/HerramientaIcon'
import type { SetupData } from '@/app/admin/setup/page'

// ─────────────────────────────────────────────
// Opciones estándar
// ─────────────────────────────────────────────

// `descKey` es la clave i18n de la descripción — se traduce al renderizar
const OPCIONES_ESTANDAR: { value: string; descKey: string }[] = [
  { value: 'email',    descKey: 'adminSetup.s3DescEmail' },
  { value: 'teams',    descKey: 'adminSetup.s3DescTeams' },
  { value: 'slack',    descKey: 'adminSetup.s3DescSlack' },
  { value: 'whatsapp', descKey: 'adminSetup.s3DescWhatsapp' },
  { value: 'meet',     descKey: 'adminSetup.s3DescMeet' },
]

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────

interface Step3Props {
  setupData: SetupData
  onNext: () => void
  onSkip: () => void
}

export function Step3Contacto({ setupData, onNext, onSkip }: Step3Props) {
  const { t } = useLanguage()
  // Herramientas estándar seleccionadas
  const [seleccionadas, setSeleccionadas] = useState<string[]>(['email'])
  // Card "Otra"
  const [otraSeleccionada, setOtraSeleccionada] = useState(false)
  const [otraTexto, setOtraTexto] = useState('')
  const [saving, setSaving] = useState(false)

  // Array final que se guardará en DB
  const arrayFinal = [
    ...seleccionadas,
    ...(otraSeleccionada && otraTexto.trim() ? [otraTexto.trim()] : []),
  ]

  const puedeConntinuar = arrayFinal.length > 0

  const toggleEstandar = (valor: string) => {
    setSeleccionadas(prev =>
      prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor]
    )
  }

  const toggleOtra = () => {
    if (otraSeleccionada) {
      // Deseleccionar: limpiar input
      setOtraSeleccionada(false)
      setOtraTexto('')
    } else {
      setOtraSeleccionada(true)
    }
  }

  const handleContinuar = useCallback(async () => {
    if (arrayFinal.length === 0) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('empresas')
        .update({ herramientas_contacto: arrayFinal })
        .eq('id', setupData.empresaId)

      if (error) throw new Error(error.message)
      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('adminSetup.errGuardar'))
    } finally {
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrayFinal, setupData.empresaId, onNext])

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8">
      {/* Ícono y título */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-[#0EA5E9]/12 border border-[#0EA5E9]/20
          flex items-center justify-center mb-4
          shadow-[0_0_32px_rgba(14,165,233,0.2)]">
          <MessageSquare className="w-8 h-8 text-[#38BDF8]" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-1">{t('adminSetup.s3Titulo')}</h2>
        <p className="text-sm text-white/45 max-w-sm">
          {t('adminSetup.s3Subtitulo')}
        </p>
      </div>

      {/* Checkbox cards — opciones estándar */}
      <div className="space-y-2">
        {OPCIONES_ESTANDAR.map(opcion => {
          const isSelected = seleccionadas.includes(opcion.value)
          return (
            <button
              key={opcion.value}
              type="button"
              onClick={() => toggleEstandar(opcion.value)}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-xl text-left',
                'border transition-all duration-150',
                isSelected
                  ? 'border-[#0EA5E9]/40 bg-[#0EA5E9]/[0.08]'
                  : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.03]'
              )}
            >
              {/* Ícono de la herramienta */}
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                isSelected
                  ? 'bg-[#0EA5E9]/15 text-[#7DD3FC]'
                  : 'bg-white/[0.05] text-white/40'
              )}>
                <HerramientaIcon herramienta={opcion.value} className="w-5 h-5" />
              </div>

              {/* Nombre y descripción */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium',
                  isSelected ? 'text-white' : 'text-white/70'
                )}>
                  {HERRAMIENTA_LABELS[opcion.value]}
                </p>
                <p className="text-xs text-white/35 mt-0.5">{t(opcion.descKey)}</p>
              </div>

              {/* Indicador checkbox */}
              <div className={cn(
                'w-4 h-4 rounded flex items-center justify-center flex-shrink-0',
                'border-2 transition-all duration-150',
                isSelected
                  ? 'border-[#0EA5E9] bg-[#0EA5E9]'
                  : 'border-white/20 bg-transparent'
              )}>
                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
            </button>
          )
        })}

        {/* Card especial "Otra" */}
        <button
          type="button"
          onClick={toggleOtra}
          className={cn(
            'w-full flex items-center gap-4 p-4 rounded-xl text-left',
            'border transition-all duration-150',
            otraSeleccionada
              ? 'border-[#0EA5E9]/40 bg-[#0EA5E9]/[0.08]'
              : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.03]'
          )}
        >
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
            otraSeleccionada
              ? 'bg-[#0EA5E9]/15 text-[#7DD3FC]'
              : 'bg-white/[0.05] text-white/40'
          )}>
            <Plus className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm font-medium',
              otraSeleccionada ? 'text-white' : 'text-white/70'
            )}>
              {t('adminSetup.s3Otra')}
            </p>
            <p className="text-xs text-white/35 mt-0.5">{t('adminSetup.s3OtraDesc')}</p>
          </div>

          <div className={cn(
            'w-4 h-4 rounded flex items-center justify-center flex-shrink-0',
            'border-2 transition-all duration-150',
            otraSeleccionada
              ? 'border-[#0EA5E9] bg-[#0EA5E9]'
              : 'border-white/20 bg-transparent'
          )}>
            {otraSeleccionada && <Check className="w-2.5 h-2.5 text-white" />}
          </div>
        </button>

        {/* Input para herramienta custom — visible solo cuando "Otra" está seleccionada */}
        {otraSeleccionada && (
          <div className="px-1">
            <input
              type="text"
              value={otraTexto}
              onChange={e => setOtraTexto(e.target.value)}
              placeholder={t('adminSetup.s3OtraPh')}
              className="w-full px-4 py-2.5 rounded-lg text-sm
                bg-white/[0.04] border border-white/[0.10]
                text-white placeholder:text-white/25
                focus:outline-none focus:border-[#0EA5E9]/40 focus:bg-white/[0.06]
                transition-all duration-150"
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <Button
          variant="primary"
          size="md"
          loading={saving}
          disabled={!puedeConntinuar}
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
