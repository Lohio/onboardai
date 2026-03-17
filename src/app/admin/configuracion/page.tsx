'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Save, Check, Mail, Video, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ContactoCard } from '@/components/empleado/ContactoCard'
import { HERRAMIENTA_LABELS } from '@/lib/contacto'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Opciones estándar de herramienta
// ─────────────────────────────────────────────

const OPCIONES_ESTANDAR: { value: string; desc: string }[] = [
  { value: 'email',    desc: 'Abre el cliente de correo' },
  { value: 'teams',    desc: 'Abre un chat en Microsoft Teams' },
  { value: 'slack',    desc: 'Copia el email (Slack no tiene deep links)' },
  { value: 'whatsapp', desc: 'Copia el email (necesita número de teléfono)' },
  { value: 'meet',     desc: 'Envía un email para coordinar reunión' },
]

// Herramientas conocidas para separar estándar de custom al cargar
const HERRAMIENTAS_CONOCIDAS = new Set(['email', 'teams', 'slack', 'whatsapp', 'meet'])

// Íconos inline para Teams, Slack, WhatsApp
function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'w-4 h-4'} fill="currentColor" aria-hidden>
      <path d="M19.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM14 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm4.5 1H17a5 5 0 0 1 1 3H22a1 1 0 0 0 1-1v-.5c0-.83-.67-1.5-1.5-1.5zM13 9H8a2 2 0 0 0-2 2v5.5A4.5 4.5 0 0 0 10.5 21h3a4.5 4.5 0 0 0 4.5-4.5V11a2 2 0 0 0-2-2z" />
    </svg>
  )
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'w-4 h-4'} fill="currentColor" aria-hidden>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.27 0a2.527 2.527 0 0 1 2.52-2.52 2.527 2.527 0 0 1 2.52 2.52v6.313A2.528 2.528 0 0 1 8.833 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.52-10.12a2.528 2.528 0 0 1-2.52-2.523A2.527 2.527 0 0 1 8.833 0a2.528 2.528 0 0 1 2.52 2.522v2.52H8.833zm0 1.272a2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522H2.522A2.528 2.528 0 0 1 0 8.837a2.528 2.528 0 0 1 2.522-2.52h6.311zm10.122 2.52a2.528 2.528 0 0 1 2.522-2.52A2.528 2.528 0 0 1 24 8.837a2.528 2.528 0 0 1-2.522 2.522h-2.52V8.837zm-1.268 0a2.528 2.528 0 0 1-2.523 2.522 2.527 2.527 0 0 1-2.52-2.522V2.522A2.527 2.527 0 0 1 15.167 0a2.528 2.528 0 0 1 2.523 2.522v6.315zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.167 24a2.527 2.527 0 0 1-2.52-2.522v-2.52h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'w-4 h-4'} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

function OpcionIcon({ h, className }: { h: string; className?: string }) {
  const cls = className ?? 'w-4 h-4'
  if (h === 'teams')    return <TeamsIcon className={cls} />
  if (h === 'slack')    return <SlackIcon className={cls} />
  if (h === 'whatsapp') return <WhatsAppIcon className={cls} />
  if (h === 'meet')     return <Video className={cls} />
  return <Mail className={cls} />
}

// ─────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────

export default function ConfiguracionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [empresaId, setEmpresaId] = useState<string | null>(null)

  // Herramientas estándar seleccionadas
  const [seleccionadas, setSeleccionadas] = useState<string[]>(['email'])
  // Estado original para detectar cambios pendientes
  const [original, setOriginal] = useState<string[]>(['email'])
  // Card "Otra"
  const [otraSeleccionada, setOtraSeleccionada] = useState(false)
  const [otraTexto, setOtraTexto] = useState('')
  // Original de "Otra" para detectar cambios
  const [originalOtra, setOriginalOtra] = useState('')

  // Array final que se guardará en DB
  const arrayFinal = [
    ...seleccionadas,
    ...(otraSeleccionada && otraTexto.trim() ? [otraTexto.trim()] : []),
  ]

  // Detectar cambios pendientes
  const hayPendientes = (
    JSON.stringify([...seleccionadas].sort()) !== JSON.stringify([...original].sort()) ||
    (otraSeleccionada && otraTexto.trim()) !== originalOtra
  )

  const toggleEstandar = (valor: string) => {
    setSeleccionadas(prev =>
      prev.includes(valor) ? prev.filter(v => v !== valor) : [...prev, valor]
    )
  }

  const toggleOtra = () => {
    if (otraSeleccionada) {
      setOtraSeleccionada(false)
      setOtraTexto('')
    } else {
      setOtraSeleccionada(true)
    }
  }

  const cargarDatos = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: adminData } = await supabase
        .from('usuarios')
        .select('empresa_id, rol')
        .eq('id', user.id)
        .single()

      if (!adminData || !['admin', 'dev'].includes(adminData.rol)) {
        router.push('/auth/login')
        return
      }

      setEmpresaId(adminData.empresa_id)

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('herramientas_contacto')
        .eq('id', adminData.empresa_id)
        .single()

      if (empresaData?.herramientas_contacto) {
        const arr: string[] = empresaData.herramientas_contacto
        // Separar herramientas conocidas de custom
        const conocidas = arr.filter(h => HERRAMIENTAS_CONOCIDAS.has(h))
        const custom    = arr.find(h => !HERRAMIENTAS_CONOCIDAS.has(h)) ?? ''

        setSeleccionadas(conocidas.length > 0 ? conocidas : ['email'])
        setOriginal(conocidas.length > 0 ? conocidas : ['email'])

        if (custom) {
          setOtraSeleccionada(true)
          setOtraTexto(custom)
          setOriginalOtra(custom)
        }
      }
    } catch (err) {
      console.error('Error cargando configuración:', err)
      toast.error('Error al cargar la configuración')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  async function handleGuardar() {
    if (!empresaId || arrayFinal.length === 0) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('empresas')
        .update({ herramientas_contacto: arrayFinal })
        .eq('id', empresaId)

      if (error) throw error

      setOriginal(seleccionadas)
      setOriginalOtra(otraSeleccionada && otraTexto.trim() ? otraTexto.trim() : '')
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
      toast.success('Configuración guardada')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Primera herramienta seleccionada para la vista previa
  const herramientaPreview = arrayFinal[0] ?? 'email'

  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-40 bg-white/[0.06] rounded" />
        <div className="h-36 bg-white/[0.03] rounded-xl border border-white/[0.06]" />
        <div className="h-40 bg-white/[0.03] rounded-xl border border-white/[0.06]" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <h1 className="text-xl font-semibold text-white">Configuración</h1>
        <p className="text-sm text-white/40 mt-1">Ajustes generales del panel admin</p>
      </motion.div>

      {/* ── Herramientas de contacto ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.05 }}
      >
        <Card>
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest">
              Herramientas de contacto
            </h2>
            <AnimatePresence>
              {hayPendientes && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full
                    bg-amber-500/15 text-amber-400 border border-amber-500/20"
                >
                  Sin guardar
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <p className="text-xs text-white/40 mb-4">
            Herramientas que se usan para el botón de contacto en las tarjetas "Contactos clave"
            del módulo M1. Podés seleccionar más de una.
          </p>

          {/* Opciones estándar */}
          <div className="space-y-2">
            {OPCIONES_ESTANDAR.map(op => {
              const isSelected = seleccionadas.includes(op.value)
              return (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => toggleEstandar(op.value)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left',
                    'border transition-all duration-150',
                    isSelected
                      ? 'bg-indigo-600/10 border-indigo-500/30'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                  )}
                >
                  {/* Checkbox dot */}
                  <span className={cn(
                    'w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0',
                    'transition-colors duration-150',
                    isSelected
                      ? 'border-indigo-400 bg-indigo-400'
                      : 'border-white/20 bg-transparent'
                  )}>
                    {isSelected && <Check className="w-2 h-2 text-white" />}
                  </span>

                  {/* Ícono + label */}
                  <span className={cn(
                    'flex-shrink-0 transition-colors duration-150',
                    isSelected ? 'text-indigo-300' : 'text-white/30'
                  )}>
                    <OpcionIcon h={op.value} />
                  </span>

                  <div className="flex-1 min-w-0">
                    <span className={cn(
                      'text-sm font-medium transition-colors duration-150',
                      isSelected ? 'text-white/90' : 'text-white/60'
                    )}>
                      {HERRAMIENTA_LABELS[op.value]}
                    </span>
                    <p className="text-xs text-white/30 mt-0.5">{op.desc}</p>
                  </div>
                </button>
              )
            })}

            {/* Card "Otra" */}
            <button
              type="button"
              onClick={toggleOtra}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left',
                'border transition-all duration-150',
                otraSeleccionada
                  ? 'bg-indigo-600/10 border-indigo-500/30'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
              )}
            >
              <span className={cn(
                'w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0',
                'transition-colors duration-150',
                otraSeleccionada
                  ? 'border-indigo-400 bg-indigo-400'
                  : 'border-white/20 bg-transparent'
              )}>
                {otraSeleccionada && <Check className="w-2 h-2 text-white" />}
              </span>

              <span className={cn(
                'flex-shrink-0 transition-colors duration-150',
                otraSeleccionada ? 'text-indigo-300' : 'text-white/30'
              )}>
                <Plus className="w-4 h-4" />
              </span>

              <div className="flex-1 min-w-0">
                <span className={cn(
                  'text-sm font-medium transition-colors duration-150',
                  otraSeleccionada ? 'text-white/90' : 'text-white/60'
                )}>
                  Otra
                </span>
                <p className="text-xs text-white/30 mt-0.5">Especificá el nombre de otra herramienta</p>
              </div>
            </button>

            {/* Input custom — visible solo cuando "Otra" está seleccionada */}
            <AnimatePresence>
              {otraSeleccionada && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden px-1"
                >
                  <input
                    type="text"
                    value={otraTexto}
                    onChange={e => setOtraTexto(e.target.value)}
                    placeholder="Nombre de la herramienta (ej: Discord, Telegram...)"
                    className="w-full px-3 py-2 rounded-lg text-sm
                      bg-white/[0.04] border border-white/[0.10]
                      text-white placeholder:text-white/25
                      focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.06]
                      transition-all duration-150"
                    autoFocus
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Botón guardar */}
          <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-white/[0.06]">
            <AnimatePresence>
              {savedOk && (
                <motion.span
                  initial={{ opacity: 0, x: 4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-xs text-teal-400"
                >
                  <Check className="w-3.5 h-3.5" />
                  Guardado
                </motion.span>
              )}
            </AnimatePresence>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!hayPendientes || arrayFinal.length === 0}
              onClick={handleGuardar}
            >
              <Save className="w-3.5 h-3.5" />
              Guardar
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* ── Preview ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.1 }}
      >
        <Card>
          <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">
            Vista previa — Contactos clave
          </h2>
          <p className="text-xs text-white/35 mb-4">
            Así verá el empleado las tarjetas en su módulo M1. Se muestra la primera herramienta seleccionada.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ContactoCard
              tipo="manager"
              nombre="Ana García"
              email="ana@empresa.com"
              herramienta={herramientaPreview}
            />
            <ContactoCard
              tipo="buddy"
              nombre="Juan Pérez"
              email="juan@empresa.com"
              herramienta={herramientaPreview}
            />
            <ContactoCard
              tipo="it"
              nombre="Carlos IT"
              email="it@empresa.com"
              herramienta={herramientaPreview}
            />
            <ContactoCard
              tipo="rrhh"
              nombre={undefined}
              email={undefined}
              herramienta={herramientaPreview}
            />
          </div>
        </Card>
      </motion.div>

    </div>
  )
}
