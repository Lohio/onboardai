'use client'

// ─────────────────────────────────────────────
// Tab "Progreso y reporte" del detalle de empleado
// ─────────────────────────────────────────────

import type { Dispatch, SetStateAction } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, MessageSquare, BookOpen, Circle, CheckSquare, Sparkles, ChevronDown,
} from 'lucide-react'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { ProgresoModuloChart, TimelineEvento, PreguntaIA, TareaPendiente } from './types'
import { tiempoRelativo, formatFechaCorta, renderLinea } from './helpers'
import { useLanguage } from '@/components/LanguageProvider'

export interface TabProgresoProps {
  progresos: ProgresoModuloChart[]
  tareasPendientes: TareaPendiente[]
  timeline: TimelineEvento[]
  preguntas: PreguntaIA[]
  resumen: string
  resumenVisible: boolean
  setResumenVisible: Dispatch<SetStateAction<boolean>>
  generandoResumen: boolean
  reporte: string
  reporteVisible: boolean
  setReporteVisible: Dispatch<SetStateAction<boolean>>
  generando: boolean
}

export function TabProgreso({
  progresos,
  tareasPendientes,
  timeline,
  preguntas,
  resumen,
  resumenVisible,
  setResumenVisible,
  generandoResumen,
  reporte,
  reporteVisible,
  setReporteVisible,
  generando,
}: TabProgresoProps) {
  const { t } = useLanguage()
  return (
    <>
      {/* Fila: Progreso módulos + Tareas pendientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-5">
          <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">
            {t('adminEmp.edit.moduleProgress')}
          </h2>
          <div className="space-y-5">
            {progresos.map(p => (
              <div key={p.modulo}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-white/30">{p.icon}</span>
                  <span className="text-sm text-white/75">{p.label}</span>
                  <span className="ml-auto text-xs font-mono text-white/45">{p.completados}/{p.total} {t('adminEmp.edit.blocks')}</span>
                </div>
                <ProgressBar value={p.pct} animated />
              </div>
            ))}
            {progresos.length === 0 && (
              <p className="text-sm text-white/30 text-center py-4">{t('adminEmp.prog.noData')}</p>
            )}
          </div>
        </div>

        <div className="glass-card rounded-xl p-5">
          <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4">
            {t('adminEmp.prog.pendingTasks')}
          </h2>
          {tareasPendientes.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-2">
              <CheckSquare className="w-6 h-6 text-teal-500/30" />
              <p className="text-xs text-white/30">{t('adminEmp.prog.allTasksDone')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tareasPendientes.map(tarea => (
                <div key={tarea.id} className="flex items-start gap-2.5 py-2 border-b border-white/[0.04] last:border-0">
                  <div className="w-4 h-4 mt-0.5 rounded border border-white/20 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 leading-snug">{tarea.titulo}</p>
                    <p className="text-[11px] text-white/30 mt-0.5">{t('adminEmp.prog.week')} {tarea.semana}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fila: Timeline + Preguntas IA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-5">
          <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            {t('adminEmp.prog.recentActivity')}
          </h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-4">{t('adminEmp.prog.noActivity')}</p>
          ) : (
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.06]" />
              {timeline.map((evento, idx) => (
                <div key={evento.id} className="flex items-start gap-3 pb-3 last:pb-0">
                  <div className="flex-shrink-0 mt-0.5 relative z-10 bg-[#111110]">
                    {evento.tipo === 'ingreso' && <Circle className="w-3.5 h-3.5 text-[#38BDF8]" />}
                    {evento.tipo === 'bloque' && <BookOpen className="w-3.5 h-3.5 text-teal-400" />}
                    {evento.tipo === 'tarea' && <CheckSquare className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/65 leading-snug">{evento.descripcion}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {idx === 0 ? tiempoRelativo(evento.fecha, t) : formatFechaCorta(evento.fecha)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-xl p-5">
          <h2 className="text-[11px] font-medium text-white/35 uppercase tracking-widest mb-4 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" />
            {t('adminEmp.prog.lastQuestions')}
          </h2>
          {preguntas.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-2">
              <MessageSquare className="w-6 h-6 text-white/10" />
              <p className="text-xs text-white/30 text-center">{t('adminEmp.prog.noQuestions')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {preguntas.map(p => (
                <div key={p.id} className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3">
                  <p className="text-xs font-medium text-white/80 leading-snug line-clamp-2">{p.pregunta}</p>
                  <p className="text-[11px] text-white/40 mt-1.5 leading-snug line-clamp-3">{p.respuesta}</p>
                  <p className="text-[10px] text-white/25 mt-1.5">{tiempoRelativo(p.fecha, t)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resumen semanal IA */}
      <AnimatePresence>
        {resumenVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/[0.04] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span className="text-xs font-semibold text-white/80">{t('adminEmp.prog.weeklySummary')}</span>
              </div>
              {resumen ? (
                <p className="text-sm text-white/70 leading-relaxed">
                  {resumen}
                  {generandoResumen && (
                    <span className="inline-block w-1 h-4 bg-[#A78BFA] animate-pulse ml-0.5 align-middle" />
                  )}
                </p>
              ) : (
                <div className="flex items-center gap-2 text-white/40 text-sm">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-[#A78BFA] rounded-full animate-spin-fast" />
                  {t('adminEmp.prog.analyzingWeek')}
                </div>
              )}
              {resumen && !generandoResumen && (
                <button
                  onClick={() => setResumenVisible(false)}
                  className="mt-3 flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors duration-150"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  {t('adminEmp.prog.hideSummary')}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reporte ejecutivo */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
          <div>
            <h2 className="text-sm font-medium text-white/80">{t('adminEmp.prog.execReport')}</h2>
            <p className="text-xs text-white/35 mt-0.5">{t('adminEmp.prog.execReportDesc')}</p>
          </div>
        </div>

        <AnimatePresence>
          {reporteVisible && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                {reporte ? (
                  <div className="space-y-1">
                    {reporte.split('\n').map((line, i) => renderLinea(line, i))}
                    {generando && <span className="inline-block w-1 h-4 bg-[#38BDF8] animate-pulse ml-0.5" />}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-white/40 text-sm">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-[#38BDF8] rounded-full animate-spin-fast" />
                    {t('adminEmp.prog.startingGeneration')}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {reporteVisible && reporte && !generando && (
          <button
            onClick={() => setReporteVisible(false)}
            className="mt-3 flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors duration-150"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            {t('adminEmp.prog.hideReport')}
          </button>
        )}

        {!reporteVisible && (
          <p className="text-xs text-white/30 mt-2">
            {t('adminEmp.prog.generateHint')}
          </p>
        )}
      </div>
    </>
  )
}
