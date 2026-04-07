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

interface PropiedadesProgresoPanel {
  modulos: ModuloEstado[]
  progresoTotal: number
  encuestas: EncuestaPendiente[]
  diasOnboarding: number
}

export function ProgresoPanel({
  modulos,
  progresoTotal,
  encuestas,
  diasOnboarding,
}: PropiedadesProgresoPanel) {

  const completados = modulos.filter(m => m.completado).length
  const total = modulos.length

  return (
    <div className="space-y-3">

      {/* ── Card principal: gráfico radial + módulos ── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
            Mi onboarding
          </span>
          <span className="text-xs text-white/40 font-mono">
            {completados} / {total} módulos
          </span>
        </div>

        {/* Gráfico de progreso: círculo SVG */}
        <div className="flex items-center gap-5 mb-5">
          <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
            <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="36" cy="36" r="28" fill="none"
                stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
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
              <span className="text-sm font-bold text-white leading-none">{progresoTotal}%</span>
              <span className="text-[9px] text-white/30 mt-0.5">total</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">
              {progresoTotal === 100
                ? '¡Onboarding completo! 🎉'
                : progresoTotal >= 66
                ? 'Casi terminás 💪'
                : progresoTotal >= 33
                ? `${completados} de ${total} módulos completados`
                : 'Recién empezás'}
            </p>
            <p className="text-xs text-white/40 mt-0.5">Día {diasOnboarding} de onboarding</p>
            <div className="mt-2 w-32 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #3B4FD8, #0D9488)' }}
                initial={{ width: '0%' }}
                animate={{ width: `${progresoTotal}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        </div>

        {/* Lista de módulos */}
        <div className="space-y-2">
          {modulos.map((mod, idx) => {
            const bloqueado = !mod.completado && !mod.activo
            // Para módulos bloqueados, buscar el módulo previo no completado (el que hay que terminar para desbloquear este)
            const requisito = bloqueado
              ? [...modulos.slice(0, idx)].reverse().find(m => !m.completado)
              : undefined
            return (
              <Link key={mod.key} href={mod.completado || mod.activo ? mod.href : '#'}
                className={[
                  'flex flex-col gap-0.5 rounded-xl px-3 py-2.5 transition-all duration-150',
                  mod.activo ? 'cursor-pointer hover:opacity-90' : mod.completado ? 'cursor-pointer' : 'cursor-default opacity-50',
                ].join(' ')}
                style={mod.activo ? { background: mod.accentBg, border: `1px solid ${mod.accent}33` } : { border: '1px solid transparent' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                    {mod.completado
                      ? <CheckCircle2 className="w-5 h-5" style={{ color: '#22c55e' }} />
                      : mod.activo
                      ? <Circle className="w-5 h-5" style={{ color: mod.accent }} />
                      : <Lock className="w-4 h-4 text-white/20" />
                    }
                  </div>
                  <span className="flex-1 text-sm font-medium"
                    style={{ color: mod.completado ? 'rgba(255,255,255,0.6)' : mod.activo ? mod.accent : 'rgba(255,255,255,0.25)' }}>
                    {mod.label}
                  </span>
                  <span className="text-[10px] font-medium"
                    style={{ color: mod.completado ? '#22c55e' : mod.activo ? mod.accent : 'rgba(255,255,255,0.2)' }}>
                    {mod.completado ? 'Completado' : mod.activo ? 'En curso' : 'Bloqueado'}
                  </span>
                  {mod.activo && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: mod.accent }} />}
                </div>
                {bloqueado && requisito && (
                  <span className="text-[10px] text-white/30 pl-9">
                    Completá {requisito.label} para desbloquear
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Card de encuestas de pulso ── */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-3.5 h-3.5 text-white/30" />
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
            Encuestas de pulso
          </span>
        </div>
        <div className="flex gap-2">
          {([7, 30, 60] as const).map(dia => {
            const encuesta = encuestas.find(e => e.dia === dia)
            const disponible = diasOnboarding >= dia
            const respondida = encuesta?.respondida ?? false
            return (
              <div key={dia}
                className="flex-1 rounded-lg p-2.5 text-center"
                style={{
                  background: respondida
                    ? 'rgba(34,197,94,0.08)'
                    : disponible
                    ? 'rgba(59,79,216,0.10)'
                    : 'rgba(255,255,255,0.03)',
                  border: respondida
                    ? '1px solid rgba(34,197,94,0.20)'
                    : disponible
                    ? '1px solid rgba(59,79,216,0.20)'
                    : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <p className="text-[10px] font-bold"
                  style={{ color: respondida ? '#22c55e' : disponible ? '#818CF8' : 'rgba(255,255,255,0.2)' }}>
                  Día {dia}
                </p>
                <p className="text-[9px] mt-0.5"
                  style={{ color: respondida ? 'rgba(34,197,94,0.7)' : disponible ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)' }}>
                  {respondida ? '✓ Hecha' : disponible ? 'Pendiente' : `Día ${dia}`}
                </p>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
