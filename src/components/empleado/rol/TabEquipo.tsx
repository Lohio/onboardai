'use client'

// Tab "Mi equipo" del módulo Rol (M3) — extraído de src/app/empleado/rol/page.tsx

import { GitBranch } from 'lucide-react'
import { useLanguage } from '@/components/LanguageProvider'
import Organigrama from '@/components/empleado/Organigrama'
import OrgChart from '@/components/shared/OrgChart'
import type { OrgNodo } from '@/types'
import { SectionHeader } from './helpers'

interface TabEquipoProps {
  userId: string
  empresaId: string
  orgDescripcion: string
  orgArbol: OrgNodo[]
}

export function TabEquipo({ userId, empresaId, orgDescripcion, orgArbol }: TabEquipoProps) {
  const { t } = useLanguage()

  return (
    <section>
      <SectionHeader
        icon={<GitBranch className="w-4 h-4" />}
        title={t('rol.organigrama')}
        subtitle={t('rol.organigrama.subtitle')}
        iconBg="bg-sky-100"
        iconText="text-sky-600"
      />
      {orgDescripcion && (
        <p className="text-sm text-gray-500 mb-4">{orgDescripcion}</p>
      )}
      {orgArbol.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm p-2">
          <OrgChart
            raices={orgArbol}
            usuarioActualId={userId}
            modo="lectura"
          />
        </div>
      ) : (
        <Organigrama
          usuarioId={userId}
          empresaId={empresaId}
          descripcion={orgDescripcion}
        />
      )}
    </section>
  )
}
