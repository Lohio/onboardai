'use client'

// ─────────────────────────────────────────────
// CapaEmpresaPanel — lista plana de todos los bloques de empresa
// ─────────────────────────────────────────────

import type { Dispatch, SetStateAction } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit3, Trash2, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { BloqueContenidoForm } from '@/components/admin/BloqueContenidoForm'
import type { BloqueContenido } from '@/components/admin/BloqueContenidoForm'
import type { FormularioEmpresa } from './types'
import { containerVariants, itemVariants, SkeletonBloques, EmptyState } from './helpers'
import { useLanguage } from '@/components/LanguageProvider'

export function CapaEmpresaPanel({
  loading,
  empresaId,
  bloquesFiltradosEmpresa,
  proximoOrden,
  formulario,
  setFormulario,
  onBloqueCreado,
  onBloqueActualizado,
  onBloqueEliminar,
}: {
  loading: boolean
  empresaId: string | null
  bloquesFiltradosEmpresa: BloqueContenido[]
  proximoOrden: number
  formulario: FormularioEmpresa
  setFormulario: Dispatch<SetStateAction<FormularioEmpresa>>
  onBloqueCreado: (b: BloqueContenido) => void
  onBloqueActualizado: (b: BloqueContenido) => void
  onBloqueEliminar: (b: BloqueContenido) => void
}) {
  const { t } = useLanguage()
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="text-[#38BDF8]">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/85">{t('adminCont.empresa.titulo')}</h2>
            <p className="text-xs text-white/35 mt-0.5">
              {t('adminCont.empresa.desc')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={bloquesFiltradosEmpresa.length > 0 ? 'success' : 'default'}>
            {bloquesFiltradosEmpresa.length} {bloquesFiltradosEmpresa.length !== 1 ? t('adminCont.bloques') : t('adminCont.bloque')}
          </Badge>
          <button
            onClick={() =>
              setFormulario(formulario && !formulario.bloque ? null : { modulo: 'empresa' })
            }
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-semibold
              bg-gray-900 hover:bg-gray-800 transition-colors duration-150 cursor-pointer"
            style={{ color: 'white' }}
          >
            <Plus className="w-3.5 h-3.5" />
            {t('adminCont.agregar')}
          </button>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="p-5 space-y-3">
        {loading ? (
          <SkeletonBloques />
        ) : (
          <>
            <AnimatePresence>
              {formulario && !formulario.bloque && empresaId && (
                <BloqueContenidoForm
                  key="nuevo"
                  empresaId={empresaId}
                  modulo="empresa"
                  orden={proximoOrden}
                  onSuccess={nuevoBl => {
                    onBloqueCreado(nuevoBl)
                    setFormulario(null)
                  }}
                  onCancel={() => setFormulario(null)}
                />
              )}
            </AnimatePresence>

            {bloquesFiltradosEmpresa.length === 0 && !formulario ? (
              <EmptyState
                label={t('adminCont.labelEmpresa')}
                onAgregar={() => setFormulario({ modulo: 'empresa' })}
              />
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-2"
              >
                {bloquesFiltradosEmpresa
                  .sort((a, b) => a.orden - b.orden)
                  .map(bl => (
                    <AnimatePresence key={bl.id} mode="wait">
                      {formulario?.bloque?.id === bl.id ? (
                        <BloqueContenidoForm
                          key={`edit-${bl.id}`}
                          empresaId={empresaId!}
                          modulo={bl.modulo}
                          bloque={formulario.bloque}
                          onSuccess={actualizado => {
                            onBloqueActualizado(actualizado)
                            setFormulario(null)
                          }}
                          onCancel={() => setFormulario(null)}
                        />
                      ) : (
                        <motion.div
                          key={bl.id}
                          variants={itemVariants}
                          layout
                          className="group flex items-start gap-3 px-4 py-3 rounded-xl
                            bg-white/[0.02] border border-white/[0.05]
                            hover:bg-white/[0.04] hover:border-white/[0.08]
                            transition-colors duration-150"
                        >
                          <span className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-md
                            bg-white/[0.04] border border-white/[0.06]
                            flex items-center justify-center
                            text-[10px] text-white/25 font-mono">
                            {bl.orden}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white/80 truncate">{bl.titulo}</p>
                            <p className="text-xs text-white/35 mt-0.5 line-clamp-2 leading-relaxed">
                              {bl.contenido}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100
                            transition-opacity duration-150 flex-shrink-0">
                            <button
                              onClick={() => setFormulario({ modulo: bl.modulo, bloque: bl })}
                              className="p-1.5 rounded-lg text-white/30 hover:text-[#38BDF8]
                                hover:bg-[#0EA5E9]/10 transition-colors duration-150"
                              aria-label={t('adminCont.editarBloque')}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onBloqueEliminar(bl)}
                              className="p-1.5 rounded-lg text-white/30 hover:text-red-400
                                hover:bg-red-500/10 transition-colors duration-150"
                              aria-label={t('adminCont.eliminarBloque')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ))}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
