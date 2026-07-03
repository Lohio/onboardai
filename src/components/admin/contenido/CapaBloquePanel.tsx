'use client'

// ─────────────────────────────────────────────
// CapaBloquePanel — panel para área o rol
// ─────────────────────────────────────────────

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Edit3,
  Trash2,
  FolderOpen,
  Briefcase,
  Check,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { BloqueContenidoForm } from '@/components/admin/BloqueContenidoForm'
import type { BloqueContenido } from '@/components/admin/BloqueContenidoForm'
import { containerVariants, itemVariants, EmptyState } from './helpers'
import { useLanguage } from '@/components/LanguageProvider'

// ─────────────────────────────────────────────
// Lista de bloques reutilizable
// ─────────────────────────────────────────────

function BloquesList({
  bloques,
  empresaId,
  modulo,
  area,
  puesto,
  onActualizado,
  onEliminar,
}: {
  bloques: BloqueContenido[]
  empresaId: string
  modulo: string
  area?: string | null
  puesto?: string | null
  onActualizado: (b: BloqueContenido) => void
  onEliminar: (b: BloqueContenido) => void
}) {
  const { t } = useLanguage()
  const [formulario, setFormulario] = useState<{ bloque?: BloqueContenido } | null>(null)

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-2"
    >
      {bloques.sort((a, b) => a.orden - b.orden).map(bl => (
        <AnimatePresence key={bl.id} mode="wait">
          {formulario?.bloque?.id === bl.id ? (
            <BloqueContenidoForm
              key={`edit-${bl.id}`}
              empresaId={empresaId}
              modulo={modulo}
              bloque={formulario.bloque}
              area={area}
              puesto={puesto}
              onSuccess={actualizado => {
                onActualizado(actualizado)
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
                  onClick={() => setFormulario({ bloque: bl })}
                  className="p-1.5 rounded-lg text-white/30 hover:text-[#38BDF8]
                    hover:bg-[#0EA5E9]/10 transition-colors duration-150"
                  aria-label={t('adminCont.editarBloque')}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onEliminar(bl)}
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
  )
}

// ─────────────────────────────────────────────
// Panel principal de capa (área o rol)
// ─────────────────────────────────────────────

export function CapaBloquePanel({
  tipo,
  valores,
  bloques,
  empresaId,
  onBloqueCreado,
  onBloqueActualizado,
  onBloqueEliminar,
}: {
  tipo: 'area' | 'rol'
  valores: string[]
  bloques: BloqueContenido[]
  empresaId: string
  onBloqueCreado: (b: BloqueContenido) => void
  onBloqueActualizado: (b: BloqueContenido) => void
  onBloqueEliminar: (b: BloqueContenido) => void
}) {
  const { t } = useLanguage()
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [valorNuevo, setValorNuevo] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)

  // Incluir también valores que ya tienen bloques cargados (aunque no haya empleado)
  const valoresExistentes = [
    ...new Set([
      ...valores,
      ...bloques
        .filter(b => tipo === 'area' ? (!!b.area && !b.puesto) : !!b.puesto)
        .map(b => (tipo === 'area' ? b.area! : b.puesto!)),
    ]),
  ].sort()

  const bloquesFiltrados = seleccionado
    ? bloques.filter(b =>
        tipo === 'area'
          ? b.area === seleccionado && !b.puesto
          : b.puesto === seleccionado
      )
    : []

  const etiqueta = tipo === 'area' ? t('adminCont.etiqueta.area') : t('adminCont.etiqueta.rol')
  const modulo   = tipo === 'area' ? 'area' : 'puesto'

  const handleCrearNuevo = () => {
    const val = valorNuevo.trim()
    if (!val) return
    setSeleccionado(val)
    setMostrarNuevo(false)
    setValorNuevo('')
    setMostrarForm(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Pills de valores + agregar nuevo */}
      <div className="flex flex-wrap items-center gap-2">
        {valoresExistentes.map(v => {
          const count = bloques.filter(b =>
            tipo === 'area' ? b.area === v && !b.puesto : b.puesto === v
          ).length
          const activo = seleccionado === v
          return (
            <button
              key={v}
              onClick={() => { setSeleccionado(v); setMostrarForm(false) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-150
                ${activo
                  ? 'bg-gray-200 border border-gray-300'
                  : 'bg-white border border-gray-200 hover:bg-gray-50'
                }`}
              style={activo
                ? { color: '#111827' }
                : { color: '#4B5563' }
              }
            >
              {v}
              {count > 0 && (
                <span
                  className="min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-bold
                    flex items-center justify-center"
                  style={activo
                    ? { backgroundColor: '#D1D5DB', color: '#374151' }
                    : { backgroundColor: '#F3F4F6', color: '#6B7280' }
                  }
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}

        {/* Agregar nuevo valor */}
        {mostrarNuevo ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={valorNuevo}
              onChange={e => setValorNuevo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCrearNuevo(); if (e.key === 'Escape') setMostrarNuevo(false) }}
              placeholder={t('adminCont.nombre.' + tipo)}
              autoFocus
              className="w-40 px-2.5 py-1.5 rounded-lg text-xs bg-white/[0.05] border border-[#0EA5E9]/30
                text-white/85 placeholder-white/25 outline-none focus:border-[#0EA5E9]/60"
            />
            <button
              onClick={handleCrearNuevo}
              className="p-1.5 rounded-lg bg-[#0EA5E9]/20 text-[#38BDF8] hover:bg-[#0EA5E9]/30 transition-colors"
            >
              <Check className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setMostrarNuevo(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
              text-white/30 hover:text-white/60 border border-dashed border-white/[0.10]
              hover:border-white/[0.20] transition-colors duration-150"
          >
            <Plus className="w-3 h-3" />
            {t('adminCont.nuevoVal.' + tipo)}
          </button>
        )}
      </div>

      {/* Panel de contenido del valor seleccionado */}
      {seleccionado && (
        <AnimatePresence>
          <motion.div
            key={seleccionado}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="glass-card rounded-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className={tipo === 'area' ? 'text-teal-400' : 'text-amber-400'}>
                  {tipo === 'area' ? <FolderOpen className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white/85">{seleccionado}</h2>
                  <p className="text-xs text-white/35 mt-0.5">
                    {t('adminCont.especifico.' + tipo)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={bloquesFiltrados.length > 0 ? 'success' : 'default'}>
                  {bloquesFiltrados.length} {bloquesFiltrados.length !== 1 ? t('adminCont.bloques') : t('adminCont.bloque')}
                </Badge>
                <button
                  onClick={() => setMostrarForm(v => !v)}
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
              {/* Formulario nuevo bloque */}
              <AnimatePresence>
                {mostrarForm && (
                  <BloqueContenidoForm
                    key="nuevo-capa"
                    empresaId={empresaId}
                    modulo={modulo}
                    orden={bloquesFiltrados.length + 1}
                    area={tipo === 'area' ? seleccionado : null}
                    puesto={tipo === 'rol' ? seleccionado : null}
                    onSuccess={nuevo => {
                      onBloqueCreado(nuevo)
                      setMostrarForm(false)
                    }}
                    onCancel={() => setMostrarForm(false)}
                  />
                )}
              </AnimatePresence>

              {bloquesFiltrados.length === 0 && !mostrarForm ? (
                <EmptyState
                  label={`${etiqueta} "${seleccionado}"`}
                  onAgregar={() => setMostrarForm(true)}
                />
              ) : (
                <BloquesList
                  bloques={bloquesFiltrados}
                  empresaId={empresaId}
                  modulo={modulo}
                  area={tipo === 'area' ? seleccionado : null}
                  puesto={tipo === 'rol' ? seleccionado : null}
                  onActualizado={onBloqueActualizado}
                  onEliminar={onBloqueEliminar}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Placeholder cuando no hay nada seleccionado */}
      {!seleccionado && valoresExistentes.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-12 gap-2 text-center"
        >
          <ChevronRight className="w-5 h-5 text-white/15" />
          <p className="text-sm text-white/30">
            {t('adminCont.selecciona.' + tipo)}
          </p>
        </motion.div>
      )}

      {valoresExistentes.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-12 gap-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            {tipo === 'area' ? <FolderOpen className="w-5 h-5 text-white/20" /> : <Briefcase className="w-5 h-5 text-white/20" />}
          </div>
          <p className="text-sm text-white/40 text-center">
            {t('adminCont.noHay.' + tipo)}<br />
            <span className="text-white/25">{t('adminCont.creaUno')}</span>
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
