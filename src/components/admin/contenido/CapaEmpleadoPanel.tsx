'use client'

// ─────────────────────────────────────────────
// CapaEmpleadoPanel — notas del manager
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { UserCheck, Lock, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import toast from 'react-hot-toast'
import type { EmpleadoConNotas } from './types'
import { containerVariants, itemVariants, SkeletonBloques } from './helpers'
import { useLanguage } from '@/components/LanguageProvider'

export function CapaEmpleadoPanel({ empresaId }: { empresaId: string }) {
  const { t } = useLanguage()
  const [empleados, setEmpleados]   = useState<EmpleadoConNotas[]>([])
  const [loading, setLoading]       = useState(true)
  const [notas, setNotas]           = useState<Record<string, string>>({})
  const [guardando, setGuardando]   = useState<Record<string, boolean>>({})
  const [guardado, setGuardado]     = useState<Record<string, boolean>>({})

  const cargarEmpleados = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, puesto, area, notas_ia')
      .eq('empresa_id', empresaId)
      .eq('rol', 'empleado')
      .order('nombre')

    if (error) {
      console.warn('[CapaEmpleado] error:', error.message)
      setLoading(false)
      return
    }

    const lista = (data ?? []) as EmpleadoConNotas[]
    setEmpleados(lista)

    const notasInit: Record<string, string> = {}
    for (const e of lista) notasInit[e.id] = e.notas_ia ?? ''
    setNotas(notasInit)
    setLoading(false)
  }, [empresaId])

  useEffect(() => { void cargarEmpleados() }, [cargarEmpleados])

  const guardarNotas = async (id: string) => {
    setGuardando(prev => ({ ...prev, [id]: true }))
    const supabase = createClient()
    const { error } = await supabase
      .from('usuarios')
      .update({ notas_ia: notas[id] ?? '' })
      .eq('id', id)

    if (error) {
      toast.error(t('adminCont.toast.errorNotas'))
    } else {
      setGuardado(prev => ({ ...prev, [id]: true }))
      setTimeout(() => setGuardado(prev => ({ ...prev, [id]: false })), 2500)
    }
    setGuardando(prev => ({ ...prev, [id]: false }))
  }

  if (loading) return <SkeletonBloques />

  if (empleados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <UserCheck className="w-8 h-8 text-white/15" />
        <p className="text-sm text-white/35">{t('adminCont.sinEmpleados')}</p>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-3"
    >
      {empleados.map(emp => {
        const iniciales = emp.nombre
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map(p => p[0].toUpperCase())
          .join('')

        return (
          <motion.div
            key={emp.id}
            variants={itemVariants}
            className="glass-card rounded-xl p-4 space-y-3"
          >
            {/* Info empleado */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#0EA5E9]/15 border border-[#0EA5E9]/20
                flex items-center justify-center flex-shrink-0">
                <span className="text-[#7DD3FC] text-xs font-bold">{iniciales}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 truncate">{emp.nombre}</p>
                <p className="text-xs text-white/35 truncate">
                  {[emp.puesto, emp.area].filter(Boolean).join(' · ') || t('adminCont.sinPuestoArea')}
                </p>
              </div>
            </div>

            {/* Textarea de notas */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/35">
                {t('adminCont.notasCopilbot')}
              </label>
              <textarea
                value={notas[emp.id] ?? ''}
                onChange={e => setNotas(prev => ({ ...prev, [emp.id]: e.target.value }))}
                rows={3}
                placeholder={t('adminCont.notasPlaceholder')}
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg
                  px-3 py-2 text-xs text-white/75 placeholder-white/20
                  outline-none focus:border-[#0EA5E9]/40 focus:bg-white/[0.05]
                  resize-none transition-colors duration-150"
              />
            </div>

            <div className="flex justify-end">
              {(() => {
                const sinTexto = !(notas[emp.id]?.trim())
                const deshabilitado = guardando[emp.id] || sinTexto
                return (
                  <button
                    onClick={() => guardarNotas(emp.id)}
                    disabled={deshabilitado}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                      transition-colors duration-150
                      ${deshabilitado
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-900 hover:bg-gray-800 cursor-pointer'}`}
                    style={deshabilitado ? undefined : { color: 'white' }}
                  >
                    {guardado[emp.id] ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        {t('adminCont.guardado')}
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        {t('adminCont.guardar')}
                      </>
                    )}
                  </button>
                )
              })()}
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
