'use client'

// ─────────────────────────────────────────────
// Tab "Rol y herramientas" del detalle de empleado
// ─────────────────────────────────────────────

import type { Dispatch, SetStateAction } from 'react'
import { Plus, Trash2, Target } from 'lucide-react'
import { inputCls } from './helpers'

export interface TabRolProps {
  rolAutonomia: string
  setRolAutonomia: Dispatch<SetStateAction<string>>
  rolResponsabilidades: string[]
  setRolResponsabilidades: Dispatch<SetStateAction<string[]>>
  rolKpis: string[]
  setRolKpis: Dispatch<SetStateAction<string[]>>
  rolHerramientas: Array<{ nombre: string; uso: string }>
  setRolHerramientas: Dispatch<SetStateAction<Array<{ nombre: string; uso: string }>>>
}

export function TabRol({
  rolAutonomia, setRolAutonomia,
  rolResponsabilidades, setRolResponsabilidades,
  rolKpis, setRolKpis,
  rolHerramientas, setRolHerramientas,
}: TabRolProps) {
  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-white/70 mb-1">Descripción del rol</h2>
        <p className="text-xs text-white/30">Esta información se muestra al empleado en M3 — Rol y herramientas.</p>
      </div>

      {/* Nivel de autonomía */}
      <div>
        <label className="block text-xs font-medium text-white/40 mb-1.5">Nivel de autonomía</label>
        <textarea
          value={rolAutonomia}
          onChange={e => setRolAutonomia(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Describe el nivel de autonomía del empleado en su rol..."
          className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/[0.08] text-white/85 placeholder:text-white/20 outline-none transition-colors focus:bg-white/[0.06] focus:border-[#0EA5E9]/60 resize-none"
        />
      </div>

      {/* Responsabilidades */}
      <div>
        <label className="block text-xs font-medium text-white/40 mb-1.5">Responsabilidades</label>
        <div className="space-y-2">
          {rolResponsabilidades.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={item}
                onChange={e => {
                  const next = [...rolResponsabilidades]
                  next[idx] = e.target.value
                  setRolResponsabilidades(next)
                }}
                placeholder="Ej: Gestionar pipeline de ventas"
                className={inputCls()}
              />
              <button
                type="button"
                onClick={() => setRolResponsabilidades(prev => prev.filter((_, i) => i !== idx))}
                className="flex-shrink-0 w-8 h-9 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        {rolResponsabilidades.length < 10 && (
          <button
            type="button"
            onClick={() => setRolResponsabilidades(prev => [...prev, ''])}
            className="mt-2 flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors"
          >
            <Plus className="w-3 h-3" /> Agregar responsabilidad
          </button>
        )}
      </div>

      {/* KPIs */}
      <div>
        <label className="block text-xs font-medium text-white/40 mb-1.5 flex items-center gap-1.5">
          <Target className="w-3 h-3" /> KPIs / Métricas de éxito
        </label>
        <div className="space-y-2">
          {rolKpis.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={item}
                onChange={e => {
                  const next = [...rolKpis]
                  next[idx] = e.target.value
                  setRolKpis(next)
                }}
                placeholder="Ej: Tasa de conversión > 15%"
                className={inputCls()}
              />
              <button
                type="button"
                onClick={() => setRolKpis(prev => prev.filter((_, i) => i !== idx))}
                className="flex-shrink-0 w-8 h-9 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        {rolKpis.length < 10 && (
          <button
            type="button"
            onClick={() => setRolKpis(prev => [...prev, ''])}
            className="mt-2 flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors"
          >
            <Plus className="w-3 h-3" /> Agregar KPI
          </button>
        )}
      </div>

      {/* Herramientas del rol */}
      <div>
        <label className="block text-xs font-medium text-white/40 mb-1.5">Herramientas del rol</label>
        <div className="space-y-2">
          {rolHerramientas.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={item.nombre}
                onChange={e => {
                  const next = [...rolHerramientas]
                  next[idx] = { ...next[idx], nombre: e.target.value }
                  setRolHerramientas(next)
                }}
                placeholder="Ej: Figma"
                className={inputCls()}
                style={{ maxWidth: '140px' }}
              />
              <input
                type="text"
                value={item.uso}
                onChange={e => {
                  const next = [...rolHerramientas]
                  next[idx] = { ...next[idx], uso: e.target.value }
                  setRolHerramientas(next)
                }}
                placeholder="Ej: Diseño de interfaces y prototipos"
                className={inputCls()}
              />
              <button
                type="button"
                onClick={() => setRolHerramientas(prev => prev.filter((_, i) => i !== idx))}
                className="flex-shrink-0 w-8 h-9 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        {rolHerramientas.length < 15 && (
          <button
            type="button"
            onClick={() => setRolHerramientas(prev => [...prev, { nombre: '', uso: '' }])}
            className="mt-2 flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors"
          >
            <Plus className="w-3 h-3" /> Agregar herramienta
          </button>
        )}
      </div>
    </div>
  )
}
