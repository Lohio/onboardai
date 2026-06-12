'use client'

// ─────────────────────────────────────────────
// OrgBloqueCard
// ─────────────────────────────────────────────

import { useEffect } from 'react'
import { CheckCircle2, GitBranch } from 'lucide-react'
import OrgChart from '@/components/shared/OrgChart'
import type { OrgNodo } from '@/types'

export function OrgBloqueCard({
  arbol,
  completado,
  onAutoComplete,
}: {
  arbol: OrgNodo[]
  completado: boolean
  onAutoComplete: () => void
}) {
  useEffect(() => {
    if (completado) return
    const timer = setTimeout(onAutoComplete, 3000)
    return () => clearTimeout(timer)
  }, [completado, onAutoComplete])

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-100 text-indigo-600 flex-shrink-0">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Organigrama de la empresa</h3>
            {completado ? (
              <p className="text-xs text-teal-600 mt-0.5">Completado ✓</p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">Se marcará como visto en unos segundos</p>
            )}
          </div>
          {completado && <CheckCircle2 className="w-4 h-4 text-teal-500 ml-auto flex-shrink-0" />}
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50">
          <OrgChart raices={arbol} modo="lectura" />
        </div>
      </div>
    </div>
  )
}
