'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Bell, Settings } from 'lucide-react'
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
      <main className="flex-1 flex flex-col pb-24">
        {children}
      </main>

      {/* ── Bottom Navigation Bar ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t"
        style={{
          background: 'rgba(10, 22, 40, 0.96)',
          borderColor: 'rgba(255, 255, 255, 0.06)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="max-w-lg mx-auto flex items-stretch px-4 py-2 gap-1">
          {MODULOS.map((mod, idx) => {
            const completado = modulos[mod.key]
            const esActual   = pathname.startsWith(mod.href)
            const bloqueado  = esTrial(planEmpresa) && idx === 2

            const labelClass = bloqueado
              ? 'text-white/25'
              : esActual
              ? 'text-[#38BDF8] font-semibold'
              : completado
              ? 'text-teal-400'
              : 'text-white/40'

            const iconWrapClass = cn(
              'flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-colors',
              bloqueado && 'opacity-50 cursor-not-allowed',
              esActual && !bloqueado && 'bg-[#0EA5E9]/15',
            )

            const inner = (
              <div className={iconWrapClass}>
                <div className="relative">
                  <Image
                    src={MODULO_ICONS[mod.key]}
                    alt=""
                    width={24}
                    height={24}
                    className={cn(
                      'w-6 h-6',
                      bloqueado || (!esActual && !completado) ? 'opacity-60' : '',
                    )}
                  />
                  {completado && !esActual && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-teal-400 border border-[#0A1628]" />
                  )}
                </div>
                <span className={cn('text-[10px] leading-none mt-0.5', labelClass)}>
                  {MODULO_LABELS[mod.key]}
                </span>
              </div>
            )

            return bloqueado ? (
              <div key={mod.key} className="w-16" title={`${MODULO_LABELS[mod.key]} (Pro)`}>
                {inner}
              </div>
            ) : (
              <Link key={mod.key} href={mod.href} className="w-16" title={MODULO_LABELS[mod.key]}>
                {inner}
              </Link>
            )
          })}

          {/* Botón configuración con dropdown */}
          <div className="w-12 flex items-center justify-center border-l border-white/[0.08] ml-2 pl-2">
            <SettingsDropdown />
          </div>
        </div>
      </nav>

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
