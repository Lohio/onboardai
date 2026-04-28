'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { LogOut, Bell, Menu, X } from 'lucide-react'
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
  {
    key: 'M1',
    href: '/empleado/perfil',
    label: 'Perfil',
    icon: '/heero-icons2.svg',
    color: '#2DD4BF',
    activeBg: 'rgba(45,212,191,0.14)',
    glow: 'drop-shadow(0 0 5px rgba(45,212,191,0.55))',
  },
  {
    key: 'M2',
    href: '/empleado/rol',
    label: 'Rol',
    icon: '/heero-icons4.svg',
    color: '#FCD34D',
    activeBg: 'rgba(252,211,77,0.14)',
    glow: 'drop-shadow(0 0 5px rgba(252,211,77,0.55))',
  },
  {
    key: 'M3',
    href: '/empleado/cultura',
    label: 'Cultura',
    icon: '/heero-icons1.svg',
    color: '#FDE047',
    activeBg: 'rgba(253,224,71,0.14)',
    glow: 'drop-shadow(0 0 5px rgba(253,224,71,0.45))',
  },
  {
    key: 'plan',
    href: '/empleado/plan',
    label: 'CopilBot',
    icon: '/heero-icons3.svg',
    color: '#38BDF8',
    activeBg: 'rgba(56,189,248,0.14)',
    glow: 'drop-shadow(0 0 5px rgba(56,189,248,0.55))',
  },
] as const

type ModuloKey = (typeof MODULOS)[number]['key']
type EstadoModulos = Record<ModuloKey, boolean>

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
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { t } = useLanguage()

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      const supabase = createClient()
      await supabase.auth.signOut()
    }
    window.location.href = '/auth/login'
  }, [])

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

  // Click fuera cierra el menú de usuario
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Iniciales del usuario
  const iniciales = empleadoNombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('')

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

  // ── Nav colapsable — persiste en localStorage para sobrevivir remounts ──────
  const [navAbierto, setNavAbiertoState] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  // Leer estado guardado al montar
  useEffect(() => {
    const saved = localStorage.getItem('heero_nav_abierto')
    if (saved === 'true') setNavAbiertoState(true)
  }, [])

  const setNavAbierto = (v: boolean) => {
    setNavAbiertoState(v)
    localStorage.setItem('heero_nav_abierto', String(v))
  }

  return (
    <ThemeProvider section="empleado">
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--background)' }}>

      {/* ── Header simplificado (sticky) ── */}
      <header className="flex-shrink-0 sticky top-0 z-30 border-b h-12 px-4 sm:px-6 lg:px-8"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between">
          {/* Avatar con dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowUserMenu(v => !v)}
              className="w-8 h-8 rounded-full bg-[#0EA5E9]/20 text-[#38BDF8] font-semibold text-sm flex items-center justify-center hover:bg-[#0EA5E9]/30 transition-colors"
              aria-label="Menú de usuario"
            >
              {iniciales || '?'}
            </button>
            {showUserMenu && (
              <div className="absolute top-full left-0 mt-2 rounded-lg shadow-xl p-1 min-w-[160px] z-50"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors"
                  style={{ color: 'var(--foreground)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>

          {/* Campanita */}
          <button
            type="button"
            aria-label="Notificaciones"
            className="transition-colors" style={{ color: 'var(--text-muted)' }}
          >
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Contenido de la página */}
      <main className="flex-1 flex flex-col pb-6">
        {children}
      </main>

      {/* ── Bottom Navigation (colapsable) ── */}
      <div
        ref={navRef}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <AnimatePresence mode="wait">
          {navAbierto ? (
            <motion.div
              key="nav-expanded"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="flex items-center gap-0.5 px-3 py-2 rounded-2xl backdrop-blur-xl shadow-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              {MODULOS.map((mod, idx) => {
                const completado = modulos[mod.key]
                const esActual   = pathname.startsWith(mod.href)
                const bloqueado  = esTrial(planEmpresa) && idx === 2

                const inner = (
                  <div
                    className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150"
                    style={{
                      background: esActual && !bloqueado ? mod.activeBg : 'transparent',
                    }}
                  >
                    <div className="relative">
                      <Image
                        src={mod.icon}
                        alt=""
                        width={22}
                        height={22}
                        className="w-[22px] h-[22px] transition-all duration-150"
                        style={{
                          opacity: bloqueado ? 0.3 : esActual ? 1 : completado ? 1 : 0.85,
                          filter: esActual && !bloqueado ? mod.glow : 'none',
                        }}
                      />
                      {completado && !esActual && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: mod.color }} />
                      )}
                    </div>
                    <span
                      className="text-[10px] leading-none transition-all duration-150"
                      style={{
                        fontWeight: esActual ? 600 : 500,
                        color: bloqueado
                          ? 'var(--text-muted)'
                          : esActual
                          ? mod.color
                          : completado
                          ? mod.color + 'b3'
                          : 'var(--text-muted)',
                      }}
                    >
                      {mod.label}
                    </span>
                  </div>
                )

                return bloqueado ? (
                  <div key={mod.key} className="opacity-50 cursor-not-allowed" title={`${mod.label} (Pro)`}>
                    {inner}
                  </div>
                ) : (
                  <Link
                    key={mod.key}
                    href={mod.href}
                    title={mod.label}
                  >
                    {inner}
                  </Link>
                )
              })}

              {/* Separator + Settings + Close */}
              <div className="w-px self-stretch mx-1" style={{ background: 'var(--border)' }} />
              <div className="px-1">
                <SettingsDropdown />
              </div>
              <button
                type="button"
                onClick={() => setNavAbierto(false)}
                aria-label="Cerrar menú"
                className="ml-1 w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-150"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="nav-collapsed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              onClick={() => setNavAbierto(true)}
              className="w-11 h-11 rounded-full backdrop-blur-xl flex items-center justify-center"
              style={{
                background: 'var(--surface)',
                border: '1px solid rgba(56,189,248,0.35)',
                color: '#38BDF8',
                boxShadow: '0 0 0 3px rgba(56,189,248,0.08), 0 4px 20px rgba(0,0,0,0.45)',
              }}
              aria-label="Abrir navegación"
            >
              <Menu className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
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
