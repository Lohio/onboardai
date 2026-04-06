'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut } from 'lucide-react'
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
] as const

type ModuloKey = (typeof MODULOS)[number]['key']
type EstadoModulos = Record<ModuloKey, boolean>

const MODULO_LABELS: Record<string, string> = {
  M1: 'Perfil',
  M2: 'Rol',
  M3: 'Cultura',
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
  })
  const [empleadoNombre, setEmpleadoNombre] = useState('')
  const [empleadoPuesto, setEmpleadoPuesto] = useState('')
  const [empleadoId, setEmpleadoId] = useState('')
  const [diasOnboarding, setDiasOnboarding] = useState(1)
  const [accesosPendientes, setAccesosPendientes] = useState(0)
  const [planEmpresa, setPlanEmpresa]             = useState<string>('trial')
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
    // Total siempre 5: los 5 bloques únicos de cultura (historia, mision, como_trabajamos, expectativas, hitos)
    const totalCultura = 5

    const estados = calcularEstadoModulos(progresoRows, totalCultura)
    setModulos(estados)
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
      <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0 border-r border-white/[0.06]"
        style={{ background: '#080F1E' }}
      >
        {/* Logo */}
        <div className="px-[18px] py-5 border-b border-white/[0.06] flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3B4FD8, #0D9488)' }}
          >
            H
          </div>
          <span className="text-sm font-semibold text-white/90 tracking-tight">Heero</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3">
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.08em] px-2 py-2">
            Módulos
          </p>
          {MODULOS.map((mod, idx) => {
            const completado = modulos[mod.key]
            const esActual   = pathname.startsWith(mod.href)
            const bloqueado  = esTrial(planEmpresa) && idx === 2
            if (bloqueado) {
              return (
                <div key={mod.key}
                  className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg opacity-40 cursor-not-allowed mb-0.5"
                >
                  <div className="w-[7px] h-[7px] rounded-full bg-white/15 flex-shrink-0" />
                  <span className="text-[13px] text-white/40 flex-1">
                    {mod.key} — {MODULO_LABELS[mod.key]}
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
                    : 'text-white/50 hover:text-white/90 hover:bg-white/[0.04] border-transparent'
                )}
              >
                <div className={cn(
                  'w-[7px] h-[7px] rounded-full flex-shrink-0',
                  completado ? 'bg-[#0D9488]' : esActual ? 'bg-[#818CF8]' : 'bg-white/20'
                )} />
                {mod.key} — {MODULO_LABELS[mod.key]}
              </Link>
            )
          })}
          {/* Quick access */}
          <p className="text-[10px] font-semibold text-white/25 uppercase tracking-[0.08em] px-2 pt-4 pb-2 mt-2">
            Accesos rápidos
          </p>
          <Link href="/empleado"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors border border-transparent"
          >
            <span className="text-sm leading-none">📋</span> Mi progreso
          </Link>
          <Link href="/empleado/plan"
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors border',
              pathname.startsWith('/empleado/plan')
                ? 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04] border-transparent'
            )}
          >
            <span className="text-sm leading-none">🗺️</span> Plan 30-60-90
          </Link>
        </nav>

        {/* User info */}
        <div className="px-3.5 py-3.5 border-t border-white/[0.06] flex items-center gap-2.5">
          <div
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3B4FD8, #0D9488)' }}
          >
            {empleadoNombre
              ? empleadoNombre.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
              : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-white/90 truncate">
              {empleadoNombre || 'Empleado'}
            </p>
            <p className="text-[11px] text-white/30 truncate">
              {empleadoPuesto || ''}
            </p>
          </div>
        </div>
      </aside>

      {/* ── Header + Main (flex-col wrapper) ── */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* ── Header de progreso (sticky) ── */}
      <header className="flex-shrink-0 sticky top-0 z-30 border-b border-white/[0.06] bg-[#0A1628]/90 backdrop-blur-xl h-12 relative">
        <div className="flex items-center gap-3 px-4 h-full">

          {/* Logo — IZQUIERDA */}
          <Link
            href="/empleado/perfil"
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <HeeroLogo size="sm" />
          </Link>

          {nombreEmpresa && (
            <>
              <div className="h-4 w-px bg-white/10 flex-shrink-0" />
              <span className="text-xs font-medium text-white/40 truncate max-w-[160px]">
                {nombreEmpresa}
              </span>
            </>
          )}

          <div className="flex-1" />

          {/* Barra de progreso global — DERECHA */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:block w-28 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #3B4FD8, #0D9488)' }}
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
                  ? empleadoNombre.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
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
                  <div className="px-3 py-3 border-b border-white/[0.06]">
                    <p className="text-xs font-medium text-white/80 truncate">
                      {empleadoNombre || 'Empleado'}
                    </p>
                    <p className="text-[11px] text-white/35 mt-0.5 truncate">
                      {empleadoPuesto || 'Empleado'}
                    </p>
                  </div>
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
