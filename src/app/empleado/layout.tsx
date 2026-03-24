'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut } from 'lucide-react'
import HeeroLogo from '@/components/shared/HeeroLogo'
import { createClient } from '@/lib/supabase'
import { calcularEstadoModulos, calcularProgresoPct } from '@/lib/progreso'
import AgenteFlotante from '@/components/empleado/AgenteFlotante'
import { ThemeProvider } from '@/components/ThemeProvider'
import { SettingsDropdown } from '@/components/shared/SettingsDropdown'
import { useLanguage } from '@/components/LanguageProvider'

// ─────────────────────────────────────────────
// Configuración de módulos
// ─────────────────────────────────────────────

const MODULOS = [
  { key: 'M1', href: '/empleado/perfil' },
  { key: 'M2', href: '/empleado/cultura' },
  { key: 'M3', href: '/empleado/rol' },
] as const

type ModuloKey = (typeof MODULOS)[number]['key']
type EstadoModulos = Record<ModuloKey, boolean>

// ─────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────

export default function EmpleadoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [progreso, setProgreso] = useState(0)
  const [modulos, setModulos] = useState<EstadoModulos>({
    M1: false,
    M2: false,
    M3: false,
  })
  const [empleadoNombre, setEmpleadoNombre] = useState('')
  const [empleadoPuesto, setEmpleadoPuesto] = useState('')
  const [empleadoId, setEmpleadoId] = useState('')
  const [diasOnboarding, setDiasOnboarding] = useState(1)
  const [accesosPendientes, setAccesosPendientes] = useState(0)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { t } = useLanguage()

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false)
      }
    }
    if (menuAbierto) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuAbierto])

  const handleLogout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }, [router])

  useEffect(() => {
    async function cargarProgreso() {
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
      }

      // Consultar progreso, cultura y accesos pendientes en paralelo
      const [progresoRes, culturaCountRes, accesosRes] = await Promise.all([
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
      ])

      const progresoRows = progresoRes.data ?? []
      const totalCultura = (culturaCountRes as { count: number | null }).count ?? 5

      const estados = calcularEstadoModulos(progresoRows, totalCultura)
      setModulos(estados)
      setProgreso(calcularProgresoPct(estados))

      // Accesos pendientes para el agente
      const pendientes = (accesosRes as { count: number | null }).count ?? 0
      setAccesosPendientes(pendientes)
    }

    cargarProgreso()
  }, [router, pathname]) // re-evalúa al cambiar de ruta

  return (
    <ThemeProvider section="empleado">
    <div className="min-h-dvh flex flex-col">
      {/* ── Header de progreso (sticky) ── */}
      <header className="flex-shrink-0 sticky top-0 z-30 border-b border-white/[0.06] bg-[#111110]/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 h-12">
          {/* Logo */}
          <Link
            href="/empleado/perfil"
            className="flex-shrink-0 hover:opacity-75 transition-opacity duration-150"
          >
            <HeeroLogo size="sm" />
          </Link>

          <div className="h-4 w-px bg-white/[0.07] hidden sm:block flex-shrink-0" />

          {/* Indicadores de módulos */}
          <div id="tour-navbar-modulos" className="flex items-center gap-0.5 flex-shrink-0">
            {MODULOS.map((mod, idx) => {
              const completado = modulos[mod.key]
              const esActual = pathname.startsWith(mod.href)

              return (
                <Link
                  key={mod.key}
                  href={mod.href}
                  className={`flex items-center gap-1.5 px-2 min-h-[36px] rounded-md
                    transition-colors duration-150 ${
                      esActual
                        ? 'bg-[#0EA5E9]/10'
                        : 'hover:bg-white/[0.04]'
                    }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                      completado
                        ? 'bg-[#22c55e]'
                        : esActual
                        ? 'bg-[#0EA5E9]'
                        : 'bg-white/15'
                    }`}
                  />
                  <span
                    className={`text-[11px] font-medium ${
                      esActual
                        ? 'text-[#38BDF8]'
                        : completado
                        ? 'text-[#22c55e]/60'
                        : 'text-white/30'
                    }`}
                  >
                    M{idx + 1}
                  </span>
                </Link>
              )
            })}
          </div>

          <div className="flex-1" />

          {/* Barra de progreso global */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-20 sm:w-28 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#0EA5E9] to-[#38BDF8]"
                initial={{ width: '0%' }}
                animate={{ width: `${progreso}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="text-[11px] font-mono text-white/40 tabular-nums w-7 text-right">
              {progreso}%
            </span>
          </div>

          {/* Settings */}
          <SettingsDropdown />

          {/* Avatar + dropdown */}
          <div ref={menuRef} className="relative flex-shrink-0">
            <button
              onClick={() => setMenuAbierto(prev => !prev)}
              className="w-7 h-7 rounded-full bg-[#0EA5E9]/15 border border-[#0EA5E9]/25
                flex items-center justify-center hover:bg-[#0EA5E9]/25 hover:border-[#0EA5E9]/40
                transition-colors duration-150 cursor-pointer"
              aria-label="Menú de usuario"
            >
              <span className="text-[#38BDF8] text-[11px] font-semibold">
                {empleadoNombre
                  ? empleadoNombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                  : 'U'}
              </span>
            </button>

            <AnimatePresence>
              {menuAbierto && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute right-0 top-full mt-2 w-48 z-50
                    rounded-xl border border-white/[0.08] bg-[#111110]/95 backdrop-blur-xl
                    shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
                >
                  {/* Info del usuario */}
                  <div className="px-3 py-3 border-b border-white/[0.06]">
                    <p className="text-xs font-medium text-white/80 truncate">
                      {empleadoNombre || 'Empleado'}
                    </p>
                    <p className="text-[11px] text-white/35 mt-0.5 truncate">
                      {empleadoPuesto || 'Empleado'}
                    </p>
                  </div>

                  {/* Cerrar sesión */}
                  <div className="p-1.5">
                    <button
                      onClick={() => { setMenuAbierto(false); handleLogout() }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
                        text-red-400/80 hover:text-red-400 hover:bg-red-500/10
                        transition-colors duration-150 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
                      {t('common.logout')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Contenido de la página */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>

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
          : moduloActual === 'cultura' ? 'M2' as const
          : moduloActual === 'rol' ? 'M3' as const
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
