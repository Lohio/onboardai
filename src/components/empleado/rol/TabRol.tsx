'use client'

// Tab "Mi rol" del módulo Rol (M3) — extraído de src/app/empleado/rol/page.tsx

import { Briefcase, AlertTriangle, Scale } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { DecisionAutonomia } from '@/types'
import { SectionHeader, SemaforoNivel, modalidadVariant } from './helpers'

interface TabRolProps {
  puesto: string
  puestoEmpleado: string
  areaEmpleado: string
  managerNombre: string
  modalidadEmpleado: string
  responsabilidadesKnowledge: string[]
  rolResponsabilidades: string[]
  rolKpis: string[]
  metricasKnowledge: string | null
  autonomia: DecisionAutonomia[]
}

export function TabRol({
  puesto,
  puestoEmpleado,
  areaEmpleado,
  managerNombre,
  modalidadEmpleado,
  responsabilidadesKnowledge,
  rolResponsabilidades,
  rolKpis,
  metricasKnowledge,
  autonomia,
}: TabRolProps) {
  return (
    <>
      {/* Descripción del rol — 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Columna izquierda: datos del puesto */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <SectionHeader
            icon={<Briefcase className="w-4 h-4" />}
            title="Descripción de mi rol"
            iconBg="bg-amber-100"
            iconText="text-amber-600"
          />

          {!puesto && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 mb-4">
              <p className="text-xs text-amber-700 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Tu admin aún no completó la descripción del rol.
              </p>
            </div>
          )}

          <div className="space-y-3 mt-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-20">Puesto</span>
              <span className="text-sm text-gray-900 font-medium">{puestoEmpleado || '—'}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-20">Área</span>
              <span className="text-sm text-gray-900 font-medium">{areaEmpleado || '—'}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-20">Reporta a</span>
              <span className="text-sm text-gray-900 font-medium">{managerNombre || '—'}</span>
            </div>
            {modalidadEmpleado && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20">Modalidad</span>
                <Badge variant={modalidadVariant(modalidadEmpleado)}>{modalidadEmpleado}</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: responsabilidades + métricas */}
        <div className="space-y-4">
          {/* Responsabilidades */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
            <h3 className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-3">
              Responsabilidades
            </h3>
            {(() => {
              const items = responsabilidadesKnowledge.length > 0 ? responsabilidadesKnowledge : rolResponsabilidades
              return items.length > 0 ? (
                <div className="space-y-2.5">
                  {items.map((r, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-600">{r}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Próximamente configuradas por tu admin</p>
              )
            })()}
          </div>

          {/* Métricas de éxito */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
            <h3 className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-3">
              Métricas de éxito
            </h3>
            {metricasKnowledge ? (
              <p className="text-sm text-gray-600">{metricasKnowledge}</p>
            ) : rolKpis.length > 0 ? (
              <div className="space-y-2.5">
                {rolKpis.map((k, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-600">{k}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Próximamente configuradas por tu manager</p>
            )}
          </div>
        </div>
      </div>

      {/* Autonomía de decisiones */}
      {autonomia.length > 0 && (
        <section>
          <SectionHeader
            icon={<Scale className="w-4 h-4" />}
            title="Autonomía de decisiones"
            subtitle="Qué podés decidir solo, qué consultar y qué escalar"
            iconBg="bg-teal-100"
            iconText="text-teal-600"
          />
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Decisión</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-teal-600 uppercase tracking-wide">Solo ✓</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-amber-600 uppercase tracking-wide">Consultar</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-red-600 uppercase tracking-wide">Escalar ▲</th>
                  </tr>
                </thead>
                <tbody>
                  {autonomia.map((dec, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm text-gray-700">{dec.decision}</td>
                      <td className="text-center px-4 py-3"><div className="flex justify-center"><SemaforoNivel nivel="solo" active={dec.nivel === 'solo'} /></div></td>
                      <td className="text-center px-4 py-3"><div className="flex justify-center"><SemaforoNivel nivel="consultar" active={dec.nivel === 'consultar'} /></div></td>
                      <td className="text-center px-4 py-3"><div className="flex justify-center"><SemaforoNivel nivel="escalar" active={dec.nivel === 'escalar'} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </>
  )
}
