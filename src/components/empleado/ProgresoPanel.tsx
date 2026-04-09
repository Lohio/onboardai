'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Lock, ClipboardList, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface ModuloEstado {
  key: string
  label: string
  href: string
  completado: boolean
  activo: boolean
  accent: string
  accentBg: string
}

interface EncuestaPendiente {
  dia: 7 | 30 | 60
  respondida: boolean
}

// ─────────────────────────────────────────────
// Mi onboarding — gráfico radial + lista de módulos
// ─────────────────────────────────────────────

interface MiOnboardingCardProps {
  modulos: ModuloEstado[]
  progresoTotal: number
  diasOnboarding: number
}

export function MiOnboardingCard({
  modulos,
  progresoTotal,
  diasOnboarding,
}: MiOnboardingCardProps) {
  const completados = modulos.filter(m => m.completado).length
  const total = modulos.length

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">
          Mi onboarding
        </span>
        <span className="text-xs text-gray-500 font-mono">
          {completados} / {total} módulos
        </span>
      </div>

      {/* Gráfico de progreso: círculo SVG */}
      <div className="flex items-center gap-5 mb-5">
        <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="36" cy="36" r="28" fill="none"
              stroke="rgba(0,0,0,0.06)" strokeWidth="6" />
            <motion.circle
              cx="36" cy="36" r="28" fill="none"
              stroke="url(#progressGrad)" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={175.9}
              initial={{ strokeDashoffset: 175.9 }}
              animate={{ strokeDashoffset: 175.9 - (175.9 * progresoTotal / 100) }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
            <defs>
              <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B4FD8" />
                <stop offset="100%" stopColor="#0D9488" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-gray-900 leading-none">{progresoTotal}%</span>
            <span className="text-[9px] text-gray-400 mt-0.5">total</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {progresoTotal === 100
              ? '¡Onboarding completo! 🎉'
              : progresoTotal >= 66
              ? 'Casi terminás 💪'
              : progresoTotal >= 33
              ? `${completados} de ${total} módulos completados`
              : 'Recién empezás'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Día {diasOnboarding} de onboarding</p>
          <div className="mt-2 w-full h-2 bg-gray-200 rounded-full" style={{ overflow: 'hidden' }}>
            <div
              className="h-full bg-sky-500"
              style={{ width: `${progresoTotal}%`, borderRadius: '0' }}
            />
          </div>
        </div>
      </div>

      {/* Lista de módulos */}
      <div className="space-y-2">
        {modulos.map((mod, idx) => {
          const bloqueado = !mod.completado && !mod.activo
          const requisito = bloqueado
            ? [...modulos.slice(0, idx)].reverse().find(m => !m.completado)
            : undefined
          const isLast = idx === modulos.length - 1
          const segmentoCompletado = mod.completado

          const containerClass = mod.completado || mod.activo
            ? 'rounded-lg p-2 cursor-pointer hover:bg-gray-50 transition-colors block'
            : 'rounded-lg p-2 cursor-default block'

          const labelClass = mod.completado
            ? 'text-green-700'
            : mod.activo
            ? 'text-sky-700'
            : 'text-gray-400'

          return (
            <div key={mod.key} className="relative">
              <Link
                href={mod.completado || mod.activo ? mod.href : '#'}
                className={containerClass}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                    {mod.completado
                      ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                      : mod.activo
                      ? <Circle className="w-5 h-5 text-sky-600" />
                      : <Lock className="w-4 h-4 text-gray-400" />
                    }
                  </div>
                  <span className={`flex-1 text-sm font-medium ${labelClass}`}>
                    {mod.label}
                  </span>
                  <span className={`text-[10px] font-medium ${labelClass}`}>
                    {mod.completado ? 'Completado' : mod.activo ? 'En curso' : 'Bloqueado'}
                  </span>
                  {mod.activo && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-sky-600" />}
                </div>
                {bloqueado && requisito && (
                  <span className="block text-[10px] text-gray-400 pl-9 mt-1">
                    Completá {requisito.label} para desbloquear
                  </span>
                )}
              </Link>
              {!isLast && (
                <div
                  className={`absolute -bottom-2 h-2 w-0.5 ${segmentoCompletado ? 'bg-green-500' : 'bg-gray-200'}`}
                  style={{ left: '23px' }}
                  aria-hidden="true"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Encuestas de pulso
// ─────────────────────────────────────────────

interface EncuestasPulsoCardProps {
  encuestas: EncuestaPendiente[]
  diasOnboarding: number
}

export function EncuestasPulsoCard({ encuestas, diasOnboarding }: EncuestasPulsoCardProps) {
  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">
          Encuestas de pulso
        </span>
      </div>
      <div className="flex gap-2">
        {([7, 30, 60] as const).map(dia => {
          const encuesta = encuestas.find(e => e.dia === dia)
          const disponible = diasOnboarding >= dia
          const respondida = encuesta?.respondida ?? false

          const containerClass = respondida
            ? 'rounded-lg bg-green-50 border border-green-200 p-3 text-center'
            : disponible
            ? 'rounded-lg bg-sky-50 border border-sky-200 p-3 text-center'
            : 'rounded-lg bg-gray-50 border border-gray-200 p-3 text-center'

          const titleClass = respondida
            ? 'text-green-700'
            : disponible
            ? 'text-sky-700'
            : 'text-gray-400'

          const subClass = respondida
            ? 'text-green-600/80'
            : disponible
            ? 'text-sky-600/80'
            : 'text-gray-400'

          return (
            <div key={dia} className={`flex-1 ${containerClass}`}>
              <p className={`text-[11px] font-semibold ${titleClass}`}>
                Día {dia}
              </p>
              <p className={`text-[10px] mt-0.5 ${subClass}`}>
                {respondida ? '✓ Hecha' : disponible ? 'Pendiente' : `Día ${dia}`}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
