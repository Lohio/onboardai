'use client'

// Tab "Tareas" del módulo Rol (M3): tareas por semana, objetivos y CTA al chat
// Extraído de src/app/empleado/rol/page.tsx

import { motion, AnimatePresence } from 'framer-motion'
import { CheckSquare, Target, Check, MessageSquare, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/components/LanguageProvider'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/utils'
import type { TareaOnboarding, ObjetivoRol } from '@/types'
import { SectionHeader, containerVariants, sectionVariants, itemVariants } from './helpers'
import type { EstadoObjetivoConfig } from './types'

// ─────────────────────────────────────────────
// TareaItem
// ─────────────────────────────────────────────

function TareaItem({
  tarea,
  onToggle,
}: {
  tarea: TareaOnboarding
  onToggle: (id: string, completada: boolean) => void
}) {
  return (
    <motion.div variants={itemVariants} layout>
      <button
        onClick={() => onToggle(tarea.id, !tarea.completada)}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 text-left group',
          tarea.completada
            ? 'bg-teal-50 border border-teal-200'
            : 'border border-transparent hover:bg-gray-50 hover:border-gray-200',
        )}
      >
        {/* Checkbox */}
        <div className="flex-shrink-0 relative w-5 h-5">
          <AnimatePresence>
            {tarea.completada ? (
              <motion.div
                key="checked"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-5 h-5 rounded-md bg-teal-500 shadow-sm flex items-center justify-center"
              >
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </motion.div>
            ) : (
              <motion.div
                key="unchecked"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-5 h-5 rounded-md border-2 border-gray-300 group-hover:border-gray-400 transition-colors"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Texto */}
        <motion.span
          animate={{ opacity: tarea.completada ? 0.5 : 1 }}
          transition={{ duration: 0.2 }}
          className={cn('text-sm flex-1 text-gray-900', tarea.completada && 'line-through text-gray-400')}
        >
          {tarea.titulo}
        </motion.span>

        {tarea.completada && (
          <Badge variant="success" className="flex-shrink-0 text-[10px]">✓</Badge>
        )}
      </button>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// SemanaTareas
// ─────────────────────────────────────────────

function SemanaTareas({
  semana,
  tareas,
  onToggle,
}: {
  semana: number
  tareas: TareaOnboarding[]
  onToggle: (id: string, completada: boolean) => void
}) {
  const { t } = useLanguage()
  const completadas = tareas.filter(tarea => tarea.completada).length
  const total = tareas.length
  const pct = total > 0 ? Math.round(completadas / total * 100) : 0
  const todoCompleto = completadas === total

  return (
    <motion.div
      variants={sectionVariants}
      className={cn(
        'rounded-xl border overflow-hidden transition-all duration-300 bg-white shadow-sm',
        todoCompleto ? 'border-teal-200' : 'border-gray-200',
      )}
    >
      {/* Header semana */}
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-300',
            todoCompleto ? 'bg-teal-100' : 'bg-amber-100',
          )}>
            <span className={cn('text-xs font-mono font-bold', todoCompleto ? 'text-teal-600' : 'text-amber-600')}>
              {semana}
            </span>
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-900">Semana {semana}</span>
            <span className="text-xs text-gray-500 ml-2">{completadas}/{total} tareas</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {todoCompleto && <Badge variant="success">{t('rol.estado.completada')}</Badge>}
          <div className="w-20">
            <ProgressBar value={pct} showPercentage={false} animated />
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 pb-3 border-t border-gray-200">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="pt-2 space-y-1">
          {tareas.map(tarea => (
            <TareaItem key={tarea.id} tarea={tarea} onToggle={onToggle} />
          ))}
        </motion.div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// ObjetivoItem — timeline
// ─────────────────────────────────────────────

function ObjetivoItem({ objetivo, isLast, estadoConfig }: { objetivo: ObjetivoRol; isLast: boolean; estadoConfig: EstadoObjetivoConfig }) {
  const cfg = estadoConfig[objetivo.estado]

  return (
    <motion.div variants={itemVariants} className="flex gap-4">
      {/* Círculo + línea */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn(
          'w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-mono font-bold transition-all duration-300',
          cfg.border, cfg.color, cfg.bg,
        )}>
          {String(objetivo.semana).padStart(2, '0')}
        </div>
        {!isLast && <div className="flex-1 w-px bg-gray-200 my-1.5 min-h-[1.5rem]" />}
      </div>

      {/* Contenido */}
      <div className={cn('pb-5 flex-1 min-w-0', isLast && 'pb-0')}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className={cn(
            'text-sm font-medium',
            objetivo.estado === 'completado' ? 'text-gray-400' : 'text-gray-900',
          )}>
            {objetivo.titulo}
          </p>
          <Badge variant={cfg.variant} className="flex-shrink-0 text-[10px]">
            <cfg.Icon className="w-3 h-3 mr-1" />
            {cfg.label}
          </Badge>
        </div>
        {objetivo.descripcion && (
          <p className="text-xs text-gray-500 leading-relaxed">{objetivo.descripcion}</p>
        )}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Tab Tareas
// ─────────────────────────────────────────────

interface TabTareasProps {
  tareas: TareaOnboarding[]
  objetivos: ObjetivoRol[]
  onToggle: (id: string, completada: boolean) => void
  estadoConfig: EstadoObjetivoConfig
}

export function TabTareas({ tareas, objetivos, onToggle, estadoConfig }: TabTareasProps) {
  const { t } = useLanguage()

  const semanas = [1, 2, 3, 4].filter(s => tareas.some(t => t.semana === s))

  return (
    <>
      <section>
        <div className="flex items-center justify-between mb-4">
          <SectionHeader
            icon={<CheckSquare className="w-4 h-4" />}
            title={t('rol.tareas.title')}
            subtitle={tareas.length > 0 ? t('rol.tareas.completadas').replace('{done}', String(tareas.filter(tarea => tarea.completada).length)).replace('{total}', String(tareas.length)) : undefined}
            iconBg="bg-teal-100"
            iconText="text-teal-600"
          />
        </div>
        {semanas.length > 0 ? (
          <div className="space-y-3">
            {semanas.map(s => (
              <SemanaTareas
                key={s}
                semana={s}
                tareas={tareas.filter(t => t.semana === s)}
                onToggle={onToggle}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-8 text-center">
            <CheckSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Tu empresa aún no ha asignado tareas para tu onboarding.</p>
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          icon={<Target className="w-4 h-4" />}
          title={t('rol.objetivos.title')}
          subtitle={t('rol.objetivos.subtitle')}
          iconBg="bg-rose-100"
          iconText="text-rose-600"
        />
        {objetivos.length > 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <motion.div variants={containerVariants} initial="hidden" animate="show">
              {objetivos.map((obj, i) => (
                <ObjetivoItem key={obj.id} objetivo={obj} isLast={i === objetivos.length - 1} estadoConfig={estadoConfig} />
              ))}
            </motion.div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-8 text-center">
            <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Tu empresa aún no ha definido los objetivos del mes.</p>
          </div>
        )}
      </section>

      {/* CTA al chat */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-sky-200 bg-sky-50">
        <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-sky-600" />
        </div>
        <p className="text-xs text-gray-500 flex-1">
          ¿Tenés dudas sobre tu rol? Preguntale al asistente de onboarding.
        </p>
        <a href="/empleado/asistente"
          className="flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700 transition-colors flex-shrink-0">
          Ir al chat <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </>
  )
}
