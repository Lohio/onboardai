'use client'

// ─────────────────────────────────────────────
// Tab "CopilBot" (Plan 30-60-90) del detalle de empleado
// ─────────────────────────────────────────────

import type { Dispatch, SetStateAction } from 'react'
import type { PlanItem, PlanFase, PlanTipo } from '@/types'
import { FASES_CONFIG, COLOR_EXTRAS } from '@/lib/plan'
import { useLanguage } from '@/components/LanguageProvider'

// Estado del formulario de alta de ítem del plan
export interface PlanFormState {
  titulo: string
  tipo: PlanTipo
  fecha_target: string
  descripcion: string
}

export interface TabPlanProps {
  planItems: PlanItem[]
  planFase: PlanFase
  setPlanFase: Dispatch<SetStateAction<PlanFase>>
  planForm: PlanFormState
  setPlanForm: Dispatch<SetStateAction<PlanFormState>>
  planSaving: boolean
  planToggling: string | null
  handleTogglePlanItem: (item: PlanItem) => void
  handleDeletePlanItem: (itemId: string) => void
  handleAddPlanItem: () => void
}

export function TabPlan({
  planItems,
  planFase,
  setPlanFase,
  planForm,
  setPlanForm,
  planSaving,
  planToggling,
  handleTogglePlanItem,
  handleDeletePlanItem,
  handleAddPlanItem,
}: TabPlanProps) {
  const { t } = useLanguage()
  return (
    <>
      {/* Fases pills */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {(Object.keys(FASES_CONFIG) as PlanFase[]).map(fase => {
            const cfg = FASES_CONFIG[fase]
            const extras = COLOR_EXTRAS[cfg.color]
            const items = planItems.filter(p => p.fase === fase)
            const completados = items.filter(p => p.completado).length
            const isActive = planFase === fase
            return (
              <button
                key={fase}
                onClick={() => setPlanFase(fase)}
                className={[
                  'flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium transition-all duration-150',
                  isActive
                    ? `${cfg.iconBg} ${cfg.iconText} ${extras.border} border`
                    : 'bg-white/[0.04] text-white/40 hover:text-white/70 border border-white/[0.06]',
                ].join(' ')}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? extras.dot : 'bg-white/20'}`} />
                {cfg.label} · {cfg.titulo}
                <span className="opacity-60">{completados}/{items.length}</span>
              </button>
            )
          })}
        </div>

        {/* Descripción de fase */}
        <p className="text-xs text-white/40 mb-5">{FASES_CONFIG[planFase].descripcion}</p>

        {/* Ítems agrupados por tipo */}
        {(['objetivo', 'checkin', 'logro'] as PlanTipo[]).map(tipo => {
          const items = planItems.filter(p => p.fase === planFase && p.tipo === tipo)
          const tipoLabel = tipo === 'objetivo' ? t('adminEmp.plan.objectives') : tipo === 'checkin' ? t('adminEmp.plan.checkins') : t('adminEmp.plan.achievements')
          return (
            <div key={tipo} className="mb-5">
              <h3 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-2">{tipoLabel}</h3>
              {items.length === 0 ? (
                <p className="text-xs text-white/20 py-2">{t('adminEmp.plan.noItems')}</p>
              ) : (
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="flex items-start gap-3 rounded-lg bg-white/[0.02] border border-white/[0.05] p-3 group">
                      {tipo === 'objetivo' ? (
                        <button
                          onClick={() => handleTogglePlanItem(item)}
                          disabled={planToggling === item.id}
                          className={[
                            'mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all duration-150',
                            item.completado
                              ? 'bg-teal-500/30 border-teal-500/50'
                              : 'border-white/20 hover:border-white/40',
                          ].join(' ')}
                        >
                          {item.completado && <span className="text-teal-400 text-[10px] leading-none">✓</span>}
                        </button>
                      ) : (
                        <span className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] ${
                          tipo === 'checkin'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-indigo-500/20 text-indigo-400'
                        }`}>
                          {tipo === 'checkin' ? '●' : '★'}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-snug ${item.completado ? 'line-through text-white/30' : 'text-white/80'}`}>
                          {item.titulo}
                        </p>
                        {item.descripcion && (
                          <p className="text-[11px] text-white/35 mt-0.5 leading-snug">{item.descripcion}</p>
                        )}
                        {item.fecha_target && (
                          <p className="text-[10px] text-white/25 mt-1">
                            {new Date(item.fecha_target).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeletePlanItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all duration-150 text-xs px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Formulario agregar ítem */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">{t('adminEmp.plan.addItem')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            value={planForm.titulo}
            onChange={e => setPlanForm(f => ({ ...f, titulo: e.target.value }))}
            placeholder={t('adminEmp.plan.itemTitlePh')}
            className="col-span-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#3B4FD8]/50"
          />
          <select
            value={planForm.tipo}
            onChange={e => setPlanForm(f => ({ ...f, tipo: e.target.value as PlanTipo }))}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-[#3B4FD8]/50"
          >
            <option value="objetivo">{t('adminEmp.plan.objective')}</option>
            <option value="checkin">{t('adminEmp.plan.checkin')}</option>
            <option value="logro">{t('adminEmp.plan.achievement')}</option>
          </select>
          <input
            type="date"
            value={planForm.fecha_target}
            onChange={e => setPlanForm(f => ({ ...f, fecha_target: e.target.value }))}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-[#3B4FD8]/50"
          />
          <input
            value={planForm.descripcion}
            onChange={e => setPlanForm(f => ({ ...f, descripcion: e.target.value }))}
            placeholder={t('adminEmp.plan.itemDescPh')}
            className="col-span-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#3B4FD8]/50"
          />
        </div>
        <button
          onClick={handleAddPlanItem}
          disabled={planSaving || !planForm.titulo.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3B4FD8]/20 border border-[#3B4FD8]/30 text-[#818CF8] text-sm font-medium hover:bg-[#3B4FD8]/30 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {planSaving ? (
            <span className="w-3.5 h-3.5 border-2 border-[#818CF8]/30 border-t-[#818CF8] rounded-full animate-spin" />
          ) : (
            <span className="text-base leading-none">+</span>
          )}
          {t('adminEmp.plan.addToPhase')} {planFase}
        </button>
      </div>
    </>
  )
}
