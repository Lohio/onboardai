'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Stepper horizontal para el wizard de setup
// ─────────────────────────────────────────────

interface Step {
  label: string
}

interface StepperProps {
  steps: Step[]
  currentStep: number // 0-based
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="flex items-center gap-0 w-full max-w-lg mx-auto mb-8">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isActive = index === currentStep
        const isLast = index === steps.length - 1

        return (
          <div key={index} className="flex items-center flex-1 last:flex-none">
            {/* Círculo del paso */}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  'text-sm font-semibold transition-all duration-300',
                  isCompleted
                    ? 'bg-teal-500 text-white'
                    : isActive
                      ? 'bg-indigo-600 text-white shadow-[0_0_16px_rgba(59,79,216,0.4)]'
                      : 'bg-white/[0.06] text-white/30'
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium tracking-wide whitespace-nowrap',
                  isCompleted
                    ? 'text-teal-400'
                    : isActive
                      ? 'text-indigo-300'
                      : 'text-white/25'
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Línea conectora (excepto después del último paso) */}
            {!isLast && (
              <div
                className={cn(
                  'h-[1px] flex-1 mx-2 mb-5 transition-all duration-300',
                  isCompleted ? 'bg-teal-500/50' : 'bg-white/[0.07]'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
