'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { LogOut } from 'lucide-react'
import Image from 'next/image'
import HeeroLogo from '@/components/shared/HeeroLogo'
import { createClient } from '@/lib/supabase'
import { esTrial } from '@/lib/trial'
import { calcularEstadoModulos, calcularProgresoPct } from '@/lib/progreso'
import AgenteFlotante from '@/components/empleado/AgenteFlotante'
import { ThemeProvider } from '@/components/ThemeProvider'
import { SettingsDropdown } from '@/components/shared/SettingsDropdown'
import { useLanguage } from '@/components/LanguageProvider'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Configuración de módulos
// ─────────────────────────────────────────────

const MODULOS = [
  { key: 'M1', href: '/empleado/perfil' },
  { key: 'M2', href: '/empleado/rol' },
  { key: 'M3', href: '/empleado/cultura' },
  { key: 'plan', href: '/empleado/plan' },
] as const

type ModuloKey = (typeof MODULOS)[number]['key']
type EstadoModulos = Record<ModuloKey, boolean>

const MODULO_LABELS: Record<string, string> = {
  M1: 'Perfil',
  M2: 'Rol',
  M3: 'Cultura',
  plan: 'CopilBot',
}

const MODULO_ICONS: Record<string, string> = {
  M1: '/heero-icons2.svg',
  M2: '/heero-icons4.svg',
  M3: '/heero-icons1.svg',
  plan: '/heero-icons3.svg',
}

// ─────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────

export default function EmpleadoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [progreso, setProgreso] = useState(0)
  const [modulos, setModulos] = useState<EstadoModulos>({
    M1: false,
    M2: false,
    M3: false,
    plan: false,
  })
  const [empleadoNombre, setEmpleadoNombre] = useState('')
  const [empleadoPuesto, setEmpleadoPuesto] = useState('')
  const [empleadoId, setEmpleadoId] = useState('')
  const [diasOnboarding, setDiasOnboarding] = useState(1)
  const [accesosPendientes, setAccesosPendientes] = useState(0)
  const [planEmpresa, setPlanEmpresa]             = useState<string>('trial')
  const { t } = useLanguage()

  const handleLogout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }, [router])

  const cargarProgreso = useCallback(async () => {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    setEmpleadoId(user.id)

    // Datos del empleado para el avatar
    const { data: usuarioData } = await supabase
      .from('usuarios')
      .select('nombre, puesto, empresa_id, fecha_ingreso')
      .eq('id', user.id)
      .single()

    if (usuarioData) {
      setEmpleadoNombre(usuarioData.nombre ?? '')
      setEmpleadoPuesto(usuarioData.puesto ?? '')

      // Calcular días de onboarding desde fecha_ingreso
      if (usuarioData.fecha_ingreso) {
        const dias = Math.max(1, Math.ceil(
          (Date.now() - new Date(usuarioData.fecha_ingreso).getTime()) / (1000 * 60 * 60 * 24)
        ))
        setDiasOnboarding(dias)
      }

      // Cargar plan de la empresa
      if (usuarioData.empresa_id) {
        const { data: empresaData } = await supabase
          .from('empresas')
          .select('plan, nombre')
          .eq('id', usuarioData.empresa_id)
          .single()
        setPlanEmpresa(empresaData?.plan ?? 'trial')
        setNombreEmpresa(empresaData?.nombre ?? '')
      }
    }

    // Consultar progreso, cultura, accesos y plan en paralelo
    const [progresoRes, culturaCountRes, accesosRes, planRes] = await Promise.all([
      supabase
        .from('progreso_modulos')
        .select('modulo, bloque, completado')
        .eq('usuario_id', user.id),
      usuarioData?.empresa_id
        ? supabase
            .from('conocimiento')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', usuarioData.empresa_id)
            .eq('modulo', 'cultura')
        : Promise.resolve({ count: 0 }),
      supabase
        .from('accesos')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', user.id)
        .eq('estado', 'pendiente'),
      supabase
        .from('plan_30_60_90')
        .select('completado')
        .eq('usuario_id', user.id),
    ])

    const progresoRows = progresoRes.data ?? []
    // Total siempre 5: los 5 bloques únicos de cultura (historia, mision, como_trabajamos, expectativas, hitos)
    const totalCultura = 5

    const estados = calcularEstadoModulos(progresoRows, totalCultura)
    const planRows = planRes.data ?? []
    const planCompletado = planRows.length > 0 && planRows.every(r => r.completado)
    setModulos({ ...estados, plan: planCompletado })
    setProgreso(calcularProgresoPct(estados))

    // Accesos pendientes para el agente
    const pendientes = (accesosRes as { count: number | null }).count ?? 0
    setAccesosPendientes(pendientes)
  }, [router])

  // Re-evalúa al cambiar de ruta
  useEffect(() => {
    void cargarProgreso()
  }, [cargarProgreso, pathname])

  // Actualizar progreso cuando el empleado completa un bloque sin cambiar de ruta
  useEffect(() => {
    const handler = () => void cargarProgreso()
    window.addEventListener('progreso-actualizado', handler)
    return () => window.removeEventListener('progreso-actualizado', handler)
  }, [cargarProgreso])

  return (
    <ThemeProvider section="empleado">
    <div className="min-h-dvh flex">
      {/* ── Sidebar (desktop only) ── */}
      <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0 border-r border-white/[0.06] bg-[#000000]">
        {/* Logo */}
        <div className="px-[18px] py-5 border-b border-white/[0.06] flex items-center">
          <HeeroLogo size="sm" />
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3">
          {MODULOS.map((mod, idx) => {
            const completado = modulos[mod.key]
            const esActual   = pathname.startsWith(mod.href)
            const bloqueado  = esTrial(planEmpresa) && idx === 2
            if (bloqueado) {
              return (
                <div key={mod.key}
                  className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg opacity-40 cursor-not-allowed mb-0.5"
                >
                  <Image src={MODULO_ICONS[mod.key]} alt="" width={20} height={20} className="w-5 h-5 flex-shrink-0 opacity-60" />
                  <span className="text-[13px] text-white/40 flex-1">
                    {MODULO_LABELS[mod.key]}
                  </span>
                  <span className="text-[9px] text-amber-500/60 font-semibold">Pro</span>
                </div>
              )
            }
            return (
              <Link key={mod.key} href={mod.href}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg transition-colors duration-150 text-[13px] mb-0.5 border',
                  esActual
                    ? 'bg-[#3B4FD8]/15 text-[#818CF8] border-[#3B4FD8]/25'
                    : 'text-white/55 hover:text-white/90 hover:bg-white/[0.04] border-transparent'
                )}
              >
                <Image src={MODULO_ICONS[mod.key]} alt="" width={20} height={20} className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{MODULO_LABELS[mod.key]}</span>
                {completado && (
                  <span className="w-[7px] h-[7px] rounded-full bg-[#0D9488] flex-shrink-0" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* User info + logout */}
        <div className="px-3 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors duration-150">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white/80 truncate">
                {empleadoNombre ? `Bienvenido, ${empleadoNombre}` : 'Bienvenido'}
              </p>
              <p className="text-[11px] text-white/35 mt-0.5 truncate">
                {empleadoPuesto || 'Empleado'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              aria-label={t('common.logout')}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                text-white/40 hover:text-red-400 hover:bg-red-500/10
                transition-colors duration-150 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Header + Main (flex-col wrapper) ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
      {/* ── Header de progreso (sticky) ── */}
      <header className="flex-shrink-0 sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur-xl h-14 relative">
        <div className="flex items-center gap-3 px-4 h-full">

          {nombreEmpresa && (
            <span className="text-xs font-medium text-gray-500 truncate max-w-[160px]">
              {nombreEmpresa}
            </span>
          )}

          {/* Módulos — centro */}
          <div className="hidden md:flex items-center gap-1.5 flex-1 justify-center">
            {MODULOS.map(mod => {
              const completado = modulos[mod.key]
              const esActual = pathname.startsWith(mod.href)
              return (
                <Link key={mod.key} href={mod.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150 border',
                    esActual
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'text-gray-500 hover:text-gray-900 border-transparent hover:border-gray-200 hover:bg-gray-100'
                  )}
                >
                  <Image src={MODULO_ICONS[mod.key]} alt="" width={20} height={20} className="w-5 h-5 flex-shrink-0" />
                  <span>{MODULO_LABELS[mod.key]}</span>
                  {completado && (
                    <span className="w-[5px] h-[5px] rounded-full bg-teal-500 flex-shrink-0" />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Barra de progreso global — DERECHA */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            <div className="hidden sm:block w-28 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #3B4FD8, #0D9488)' }}
                initial={{ width: '0%' }}
                animate={{ width: `${progreso}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="text-[11px] font-mono text-gray-500 tabular-nums w-7 text-right">
              {progreso}%
            </span>
          </div>

          {/* Settings */}
          <SettingsDropdown />

        </div>
        {/* Línea de progreso al fondo del header */}
        <motion.div
          className="absolute bottom-0 left-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, #3B4FD8, #0D9488)' }}
          initial={{ width: '0%' }}
          animate={{ width: `${progreso}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </header>

      {/* Contenido de la página */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      </div>{/* end flex-col wrapper */}

      {/* Agente flotante proactivo (M1–M4) */}
      {(() => {
        const moduloActual =
          pathname.startsWith('/empleado/perfil') ? 'perfil' as const
          : pathname.startsWith('/empleado/cultura') ? 'cultura' as const
          : pathname.startsWith('/empleado/rol') ? 'rol' as const
          : pathname.startsWith('/empleado/asistente') ? 'asistente' as const
          : null

        const moduloKey =
          moduloActual === 'perfil' ? 'M1' as const
          : moduloActual === 'rol' ? 'M2' as const
          : moduloActual === 'cultura' ? 'M3' as const
          : null

        return (
          <AgenteFlotante
            modulo={moduloActual}
            diasOnboarding={diasOnboarding}
            progresoTotal={progreso}
            accesosPendientes={accesosPendientes}
            moduloCompletado={moduloKey ? modulos[moduloKey] : false}
            nombreEmpleado={empleadoNombre}
            userId={empleadoId}
          />
        )
      })()}

    </div>
    </ThemeProvider>
  )
}
