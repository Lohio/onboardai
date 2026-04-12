'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Layers,
  BarChart2,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { esTrial, TRIAL_LIMITS } from '@/lib/trial'
import AdminProductTour from '@/components/AdminProductTour'
import { ThemeProvider } from '@/components/ThemeProvider'
import { useLanguage } from '@/components/LanguageProvider'

// ─────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────

interface NavItemDef {
  labelKey: string
  label?: string
  href: string
  icon: React.ReactNode
  disabled: boolean
  tourId?: string
}

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

const sidebarContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const navItemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 26 },
  },
}

// ─────────────────────────────────────────────
// NavItem
// ─────────────────────────────────────────────

function NavItem({
  item,
  activo,
}: {
  item: NavItemDef
  activo: boolean
}) {
  const { t } = useLanguage()

  if (item.disabled) {
    return (
      <motion.div variants={navItemVariants}>
        <span
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
            text-white/25 cursor-not-allowed select-none"
        >
          <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/15">
            {item.icon}
          </span>
          <span className="flex-1 font-medium">{item.label ?? t(item.labelKey)}</span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md
              bg-white/[0.06] text-white/25 border border-white/[0.06]"
          >
            {t('nav.soon')}
          </span>
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div variants={navItemVariants}>
      <Link
        href={item.href}
        id={item.tourId}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
          font-medium transition-all duration-150 group
          ${
            activo
              ? 'bg-white/[0.05] text-white border border-white/[0.06]'
              : 'text-white/55 hover:text-white/85 hover:bg-white/[0.04] border border-transparent'
          }`}
      >
        {activo && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[#0EA5E9]" />
        )}
        <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150
          ${activo
            ? 'bg-[#0EA5E9]/15 text-[#38BDF8]'
            : 'bg-white/[0.05] text-white/40 group-hover:bg-white/[0.08] group-hover:text-white/65'
          }`}
        >
          {item.icon}
        </span>
        <span className="flex-1">{item.label ?? t(item.labelKey)}</span>
      </Link>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// SidebarContent
// ─────────────────────────────────────────────

const navItems: NavItemDef[] = [
  {
    labelKey: 'nav.dashboard',
    label: 'Inicio',
    href: '/admin',
    icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
    disabled: false,
    tourId: 'tour-nav-dashboard',
  },
  {
    labelKey: 'nav.employees',
    label: 'Colaboradores',
    href: '/admin/empleados',
    icon: <Users className="w-[18px] h-[18px]" />,
    disabled: false,
    tourId: 'tour-nav-empleados',
  },
  {
    labelKey: 'nav.knowledge',
    href: '/admin/conocimiento',
    icon: <BookOpen className="w-[18px] h-[18px]" />,
    disabled: false,
    tourId: 'tour-nav-conocimiento',
  },
  {
    labelKey: 'nav.content',
    href: '/admin/contenido',
    icon: <Layers className="w-[18px] h-[18px]" />,
    disabled: false,
  },
  {
    labelKey: 'nav.reports',
    href: '/admin/reportes',
    icon: <BarChart2 className="w-[18px] h-[18px]" />,
    disabled: false,
    tourId: 'tour-nav-reportes',
  },
  {
    labelKey: 'nav.settings',
    href: '/admin/configuracion',
    icon: <Settings className="w-[18px] h-[18px]" />,
    disabled: false,
    tourId: 'tour-nav-configuracion',
  },
]

function SidebarContent({
  adminNombre,
  pathname,
  onClose,
  onLogout,
}: {
  adminNombre: string
  pathname: string
  onClose?: () => void
  onLogout: () => void
}) {
  const { t } = useLanguage()

  return (
    <div className="flex flex-col h-full">
      {/* ── Header sidebar ── */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.05]">
        <div className="flex-1 min-w-0" />
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
              text-white/30 hover:text-white/70 hover:bg-white/[0.06]
              transition-colors duration-150 md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        <motion.div
          variants={sidebarContainerVariants}
          initial="hidden"
          animate="show"
          className="space-y-0.5"
        >
          {navItems.map(item => (
            <NavItem
              key={item.href}
              item={item}
              activo={
                !item.disabled &&
                (item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href))
              }
            />
          ))}
        </motion.div>
      </nav>

      {/* ── Footer: bienvenida + logout ── */}
      <div className="px-3 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl
          hover:bg-white/[0.04] transition-colors duration-150">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/80 truncate">
              {adminNombre ? `Bienvenido, ${adminNombre}` : 'Bienvenido'}
            </p>
            <p className="text-[11px] text-white/35 mt-0.5">{t('common.admin')}</p>
          </div>
          <button
            onClick={onLogout}
            aria-label={t('common.logout')}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
              text-white/40 hover:text-red-400 hover:bg-red-500/10
              transition-colors duration-150 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// AdminHeader
// ─────────────────────────────────────────────

function AdminHeader({
  alertasCount,
  onMenuClick,
}: {
  alertasCount: number
  onMenuClick: () => void
}) {
  return (
    <header className="h-14 flex items-center px-4 gap-3 flex-shrink-0"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      {/* Hamburger — solo mobile */}
      <button
        onClick={onMenuClick}
        className="md:hidden transition-colors duration-150 p-1 -ml-1
          text-[var(--text-muted)] hover:text-[var(--foreground)]"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      {/* Bell + badge */}
      <button
        className="relative p-2 rounded-lg transition-colors duration-150
          text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--glass-bg)]"
        aria-label="Alertas pendientes"
      >
        <Bell className="w-4.5 h-4.5" />
        {alertasCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full
              bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
          >
            {alertasCount > 99 ? '99+' : alertasCount}
          </motion.span>
        )}
      </button>
    </header>
  )
}

// ─────────────────────────────────────────────
// Layout principal
// ─────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [adminNombre, setAdminNombre] = useState('')
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [alertasCount, setAlertasCount] = useState(0)
  const [sidebarAbierto, setSidebarAbierto] = useState(false)
  const [plan, setPlan]                     = useState<string>('trial')
  const [empleadosCount, setEmpleadosCount] = useState(0)

  const handleLogout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }, [router])

  // ── Refetch count de alertas ──
  const refetchAlertasCount = useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const { count } = await supabase
      .from('alertas_conocimiento')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('resuelta', false)

    setAlertasCount(count ?? 0)
  }, [empresaId])

  // ── Carga inicial ──
  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/auth/login')
          return
        }

        const { data: usuarioData } = await supabase
          .from('usuarios')
          .select('id, nombre, empresa_id, rol')
          .eq('id', user.id)
          .single()

        if (!usuarioData || usuarioData.rol !== 'admin') {
          router.push('/auth/login')
          return
        }

        setAdminNombre(usuarioData.nombre ?? '')
        setEmpresaId(usuarioData.empresa_id)

        // Cargar plan y conteo de empleados para el banner trial
        const [empresaRes, empleadosRes] = await Promise.all([
          supabase
            .from('empresas')
            .select('plan')
            .eq('id', usuarioData.empresa_id)
            .single(),
          supabase
            .from('usuarios')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', usuarioData.empresa_id)
            .eq('rol', 'empleado'),
        ])
        setPlan(empresaRes.data?.plan ?? 'trial')
        setEmpleadosCount(empleadosRes.count ?? 0)

        const { count } = await supabase
          .from('alertas_conocimiento')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', usuarioData.empresa_id)
          .eq('resuelta', false)

        setAlertasCount(count ?? 0)
      } catch (err) {
        console.error('Error en admin layout:', err)
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router])

  // ── Realtime: alertas ──
  useEffect(() => {
    if (!empresaId) return

    const supabase = createClient()
    const channel = supabase
      .channel('admin-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alertas_conocimiento',
          filter: `empresa_id=eq.${empresaId}`,
        },
        () => refetchAlertasCount()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [empresaId, refetchAlertasCount])

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-dvh gradient-bg flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#0EA5E9]/30 border-t-[#0EA5E9] rounded-full animate-spin-fast" />
          <span className="text-sm text-white/40">{t('common.loading')}</span>
        </div>
      </div>
    )
  }

  return (
    <ThemeProvider section="admin">
    <div className="min-h-dvh flex" style={{ background: 'var(--background)' }}>
      {/* ── Sidebar desktop (fijo) ── */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0"
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)' }}>
        <SidebarContent adminNombre={adminNombre} pathname={pathname} onLogout={handleLogout} />
      </aside>

      {/* ── Contenido principal ── */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--background)' }}>
        <AdminHeader
          alertasCount={alertasCount}
          onMenuClick={() => setSidebarAbierto(true)}
        />
        {/* ── Banner trial ── */}
        {esTrial(plan) && (
          <div className="flex-shrink-0 flex items-center justify-between gap-3
            px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-amber-400 text-xs flex-shrink-0">⚡ Trial</span>
              <span className="text-xs text-amber-300/70 truncate">
                {empleadosCount}/{TRIAL_LIMITS.maxEmpleados} empleados
                · M1 y M2 habilitados
              </span>
            </div>
            <a
              href="mailto:hola@onboardai.app?subject=Quiero upgradear mi plan"
              className="flex-shrink-0 text-[11px] font-semibold text-amber-400
                hover:text-amber-300 underline underline-offset-2 transition-colors"
            >
              Upgradear →
            </a>
          </div>
        )}
        {/* El overflow va en main, no en el div hijo que envuelve {children} —
            si estuviera en el div hijo, crearía un stacking context que confinaría
            los position:fixed de modales dentro del div en vez del viewport. */}
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* ── Product Tour ── */}
      {!loading && <AdminProductTour />}

      {/* ── Sidebar mobile (drawer) ── */}
      <AnimatePresence>
        {sidebarAbierto && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/60 md:hidden z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarAbierto(false)}
            />

            {/* Drawer */}
            <motion.aside
              className="fixed left-0 top-0 h-full w-64 md:hidden z-50"
              style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)' }}
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <SidebarContent
                adminNombre={adminNombre}
                pathname={pathname}
                onClose={() => setSidebarAbierto(false)}
                onLogout={handleLogout}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
    </ThemeProvider>
  )
}
