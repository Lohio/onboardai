'use client'

// UpgradeGate — muestra un overlay de upgrade cuando el módulo/feature
// no está habilitado en el plan actual de la empresa.
//
// Uso:
//   <UpgradeGate plan={plan} moduloKey="M3">
//     <ContenidoProtegido />
//   </UpgradeGate>

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { moduloHabilitado, UPGRADE_MSG } from '@/lib/billing'

interface Props {
  /** Plan actual de la empresa (ej: 'trial', 'pro', 'enterprise') */
  plan: string | null | undefined
  /** Clave del módulo a verificar (ej: 'M3', 'M4') */
  moduloKey: string
  children: React.ReactNode
  /** Mensaje personalizado. Por defecto usa UPGRADE_MSG.modulo */
  mensaje?: string
}

export default function UpgradeGate({ plan, moduloKey, children, mensaje }: Props) {
  if (moduloHabilitado(plan, moduloKey)) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      {/* Contenido bloqueado — difuminado */}
      <div className="pointer-events-none select-none blur-[2px] opacity-40">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="flex flex-col items-center gap-3 p-6 rounded-2xl
          bg-[#0A1628]/90 border border-white/[0.08] backdrop-blur-sm text-center max-w-xs mx-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25
            flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white/85">Módulo bloqueado</p>
            <p className="text-xs text-white/50 leading-relaxed">
              {mensaje ?? UPGRADE_MSG.modulo}
            </p>
          </div>
          <Link
            href="/admin/suscripcion"
            className="px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-[#0284C7]
              text-white text-xs font-semibold transition-colors duration-150"
          >
            Ver planes →
          </Link>
        </div>
      </div>
    </div>
  )
}
