'use client'

// ─────────────────────────────────────────────
// Sección "Accesos y herramientas" del tab Edición
// ─────────────────────────────────────────────

import type { Dispatch, SetStateAction } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Save, ChevronDown, Plus, Trash2, Eye, EyeOff, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { AccesoRow, AccesoEditDraft, ChipDraft } from './types'
import { inputCls, isConfigured } from './helpers'

export interface SeccionAccesosProps {
  accesos: AccesoRow[]
  chipDraft: ChipDraft | null
  setChipDraft: Dispatch<SetStateAction<ChipDraft | null>>
  expandedAccesoId: string | null
  setExpandedAccesoId: Dispatch<SetStateAction<string | null>>
  accesoEdits: Record<string, AccesoEditDraft>
  showPassAcceso: Record<string, boolean>
  setShowPassAcceso: Dispatch<SetStateAction<Record<string, boolean>>>
  confirmDeleteId: string | null
  setConfirmDeleteId: Dispatch<SetStateAction<string | null>>
  toggleAcceso: (accesoId: string) => void
  setAccesoField: <K extends keyof AccesoEditDraft>(accesoId: string, campo: K, valor: AccesoEditDraft[K]) => void
  guardarAcceso: (accesoId: string) => void
  guardarChipDraft: () => void
  agregarAcceso: (nombreHerramienta?: string) => void
  eliminarAcceso: (accesoId: string) => void
}

export function SeccionAccesos({
  accesos,
  chipDraft,
  setChipDraft,
  expandedAccesoId,
  setExpandedAccesoId,
  accesoEdits,
  showPassAcceso,
  setShowPassAcceso,
  confirmDeleteId,
  setConfirmDeleteId,
  toggleAcceso,
  setAccesoField,
  guardarAcceso,
  guardarChipDraft,
  agregarAcceso,
  eliminarAcceso,
}: SeccionAccesosProps) {
  return (
    <div className="pt-1">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-sm font-semibold text-white/70 whitespace-nowrap">Accesos y herramientas</h3>
        <div className="flex-1 h-px bg-white/[0.06]" />
        {accesos.length > 0 && (
          <span className="text-[10px] text-white/30 flex-shrink-0">
            {accesos.filter(a => a.estado === 'activo').length} activos · {accesos.filter(a => a.estado === 'pendiente').length} pendientes
          </span>
        )}
      </div>

      {/* Chips de herramientas populares — siempre visibles */}
      <div className="mb-4">
        <p className="text-[11px] text-white/30 mb-2 uppercase tracking-widest font-medium">Herramientas comunes</p>
        <div className="flex flex-wrap gap-2">
          {['Gmail', 'Slack', 'Notion', 'GitHub', 'Jira', 'Teams', 'Figma', 'Drive', 'Zoom', 'HubSpot'].map(nombre => {
            const acceso = accesos.find(a => a.herramienta?.toLowerCase() === nombre.toLowerCase())
            const existe = !!acceso
            const configurado = existe && isConfigured(acceso!)
            const esteChipAbierto = chipDraft?.nombre === nombre
            return (
              <button
                key={nombre}
                onClick={() => {
                  if (esteChipAbierto) {
                    setChipDraft(null)
                  } else if (existe) {
                    // Ya existe → expandir su card de edición
                    setChipDraft(null)
                    toggleAcceso(acceso!.id)
                  } else {
                    // Nuevo → abrir panel local sin tocar DB
                    setChipDraft({ nombre, usuario: '', password: '', showPass: false })
                    setExpandedAccesoId(null)
                  }
                }}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
                  esteChipAbierto
                    ? 'bg-[#0EA5E9]/20 border-[#38BDF8]/50 text-[#BAE6FD] shadow-[0_0_10px_rgba(14,165,233,0.2)]'
                    : configurado
                    ? 'bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-[0_0_10px_rgba(20,184,166,0.12)]'
                    : existe
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-white/[0.03] border-white/[0.08] text-white/45 hover:bg-white/[0.07] hover:border-white/[0.18] hover:text-white/70',
                )}
              >
                {configurado && !esteChipAbierto && (
                  <span className="w-3.5 h-3.5 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                    <Check className="w-2 h-2 text-white" strokeWidth={3} />
                  </span>
                )}
                {existe && !configurado && !esteChipAbierto && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
                )}
                {nombre}
              </button>
            )
          })}
        </div>

        {/* Panel inline del chip seleccionado */}
        <AnimatePresence>
          {chipDraft && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-xl border border-[#0EA5E9]/25 bg-[#0EA5E9]/[0.06] p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#7DD3FC]">
                    Configurar acceso: <span className="text-white">{chipDraft.nombre}</span>
                  </p>
                  <button
                    onClick={() => setChipDraft(null)}
                    className="text-white/30 hover:text-white/60 text-xs transition-colors"
                  >✕</button>
                </div>

                {/* Toggle ON/OFF */}
                <div className="flex gap-2">
                  <div className="flex-1 py-2 rounded-lg border text-center text-xs font-semibold bg-teal-500/15 border-teal-500/40 text-teal-300">
                    ON — Activo al guardar
                  </div>
                </div>

                {/* Usuario y contraseña */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-white/40 mb-1">
                      👤 Usuario
                    </label>
                    <input
                      type="text"
                      value={chipDraft.usuario}
                      onChange={e => setChipDraft(d => d ? { ...d, usuario: e.target.value } : d)}
                      placeholder="usuario@empresa.com"
                      className={inputCls()}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-white/40 mb-1">
                      🔑 Contraseña <span className="text-white/20 font-normal">(solo admins)</span>
                    </label>
                    <div className="relative">
                      <input
                        type={chipDraft.showPass ? 'text' : 'password'}
                        value={chipDraft.password}
                        onChange={e => setChipDraft(d => d ? { ...d, password: e.target.value } : d)}
                        placeholder="Contraseña de acceso"
                        className={inputCls() + ' pr-9'}
                      />
                      <button
                        type="button"
                        onClick={() => setChipDraft(d => d ? { ...d, showPass: !d.showPass } : d)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {chipDraft.showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-3 pt-1">
                  <Button variant="primary" size="sm" onClick={guardarChipDraft}>
                    <Check className="w-3.5 h-3.5" />
                    Guardar y activar
                  </Button>
                  <button
                    onClick={() => setChipDraft(null)}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-[10px] text-white/20 mt-2">
          🟢 Verde = Configurado · 🟡 Amarillo = Pendiente · Click para agregar o editar
        </p>
      </div>


      {/* Cards expandibles de accesos */}
      <div className="space-y-2 mb-3">
        <AnimatePresence initial={false}>
          {accesos.map(acceso => {
            const configurado = isConfigured(acceso)
            const expandido = expandedAccesoId === acceso.id
            const draft = accesoEdits[acceso.id]
            return (
              <motion.div key={acceso.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              >
                {/* Chip / encabezado */}
                <button onClick={() => toggleAcceso(acceso.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all duration-150',
                    expandido
                      ? 'rounded-xl rounded-b-none bg-[#0EA5E9]/10 border border-b-0 border-[#0EA5E9]/30'
                      : configurado
                      ? 'rounded-xl bg-teal-500/10 border border-teal-500/25 hover:bg-teal-500/15'
                      : 'rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.05]',
                  )}>
                  {/* Indicador de estado */}
                  <span className={cn(
                    'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200',
                    configurado ? 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.4)]'
                      : acceso.estado === 'pendiente' ? 'bg-amber-500/30 border border-amber-500/40'
                      : 'bg-white/10 border border-white/15',
                  )}>
                    {configurado
                      ? <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      : acceso.estado === 'pendiente'
                      ? <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      : <span className="w-1 h-1 rounded-full bg-white/30" />
                    }
                  </span>

                  <span className={cn(
                    'text-xs font-medium flex-1 truncate',
                    configurado ? 'text-teal-300/90'
                      : acceso.estado === 'pendiente' ? 'text-amber-300/80'
                      : 'text-white/60',
                  )}>
                    {acceso.herramienta || 'Sin nombre'}
                  </span>

                  {/* Badge de estado */}
                  <span className={cn(
                    'text-[10px] flex-shrink-0 px-2 py-0.5 rounded-full font-medium',
                    configurado ? 'text-teal-400 bg-teal-500/10'
                      : acceso.estado === 'pendiente' ? 'text-amber-400 bg-amber-500/10'
                      : 'text-white/25 bg-white/[0.04]',
                  )}>
                    {configurado ? 'Configurado' : acceso.estado === 'pendiente' ? 'Pendiente' : 'Sin acceso'}
                  </span>

                  <ChevronDown className={cn(
                    'w-3.5 h-3.5 text-white/30 flex-shrink-0 transition-transform duration-200',
                    expandido && 'rotate-180',
                  )} />
                </button>

                {/* Panel expandible on/off */}
                <AnimatePresence>
                  {expandido && draft && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="border border-t-0 border-[#0EA5E9]/20 rounded-b-xl bg-[#0EA5E9]/[0.04]">
                        {/* Toggle ON/OFF de estado — prominente */}
                        <div className="px-4 pt-4 pb-3 border-b border-white/[0.05]">
                          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Estado del acceso</p>
                          <div className="flex gap-2">
                            {([
                              { key: 'activo',     label: 'ON — Activo',     active: 'bg-teal-500/20 border-teal-500/50 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.2)]' },
                              { key: 'pendiente',  label: 'Pendiente',       active: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
                              { key: 'sin_acceso', label: 'OFF — Sin acceso', active: 'bg-red-500/15 border-red-500/35 text-red-300' },
                            ] as const).map(opt => (
                              <button
                                key={opt.key}
                                onClick={() => setAccesoField(acceso.id, 'estado', opt.key)}
                                className={cn(
                                  'flex-1 py-2 rounded-lg text-xs font-semibold border transition-all duration-150',
                                  draft.estado === opt.key
                                    ? opt.active
                                    : 'bg-white/[0.02] border-white/[0.06] text-white/25 hover:text-white/45 hover:bg-white/[0.04]',
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="px-4 py-4 space-y-3">
                          {/* Nombre de herramienta */}
                          <div>
                            <label className="block text-[11px] font-medium text-white/40 mb-1">Herramienta</label>
                            <input type="text" value={draft.herramienta}
                              onChange={e => setAccesoField(acceso.id, 'herramienta', e.target.value)}
                              placeholder="Nombre de la herramienta" className={inputCls()} />
                          </div>

                          {/* Usuario y Contraseña — juntos */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-white/40 mb-1 flex items-center gap-1">
                                <span>👤</span> Usuario
                              </label>
                              <input type="text" value={draft.usuario_acceso}
                                onChange={e => setAccesoField(acceso.id, 'usuario_acceso', e.target.value)}
                                placeholder="usuario@empresa.com"
                                className={inputCls()} />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-white/40 mb-1 flex items-center gap-1">
                                <span>🔑</span> Contraseña <span className="text-white/20 font-normal">(solo admins)</span>
                              </label>
                              <div className="relative">
                                <input
                                  type={showPassAcceso[acceso.id] ? 'text' : 'password'}
                                  value={draft.password_acceso}
                                  onChange={e => setAccesoField(acceso.id, 'password_acceso', e.target.value)}
                                  placeholder="Contraseña de acceso"
                                  className={inputCls() + ' pr-9'}
                                />
                                <button type="button"
                                  onClick={() => setShowPassAcceso(prev => ({ ...prev, [acceso.id]: !prev[acceso.id] }))}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                                  {showPassAcceso[acceso.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* URL y Notas */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-white/40 mb-1">URL <span className="text-white/20 font-normal">(opcional)</span></label>
                              <input type="url" value={draft.url}
                                onChange={e => setAccesoField(acceso.id, 'url', e.target.value)}
                                placeholder="https://app.herramienta.com" className={inputCls()} />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-white/40 mb-1">Notas <span className="text-white/20 font-normal">(opcional)</span></label>
                              <input type="text" value={draft.notas}
                                onChange={e => setAccesoField(acceso.id, 'notas', e.target.value)}
                                placeholder="Ej: usar VPN primero" className={inputCls()} />
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center justify-between pt-1">
                            <Button variant="primary" size="sm" onClick={() => guardarAcceso(acceso.id)}>
                              <Save className="w-3.5 h-3.5" />
                              Guardar
                            </Button>
                            {confirmDeleteId === acceso.id ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-white/40">¿Eliminar?</span>
                                <button onClick={() => eliminarAcceso(acceso.id)}
                                  className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors duration-150">Sí</button>
                                <button onClick={() => setConfirmDeleteId(null)}
                                  className="text-xs px-2 py-0.5 rounded bg-white/[0.04] text-white/40 hover:bg-white/[0.08] transition-colors duration-150">No</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteId(acceso.id)}
                                className="flex items-center gap-1.5 text-xs text-white/25 hover:text-red-400 transition-colors duration-150">
                                <Trash2 className="w-3.5 h-3.5" />
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Botón agregar herramienta custom */}
      <Button variant="ghost" size="sm" onClick={() => agregarAcceso()}>
        <Plus className="w-3.5 h-3.5" />
        Agregar herramienta
      </Button>
    </div>
  )
}
