'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  Pencil,
  ImagePlus,
  ChevronDown,
  CreditCard,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { esTrial, UPGRADE_MSG } from '@/lib/billing'
import type { PlanId } from '@/types'
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
  const [hover, setHover] = useState(false)

  // Colores forzados inline (sobreescriben cualquier override de tema)
  const textColor = activo || hover ? 'white' : 'rgba(255,255,255,0.6)'
  const iconColor = activo
    ? 'white'
    : hover
      ? 'rgba(255,255,255,0.8)'
      : 'rgba(255,255,255,0.5)'

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
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
          font-medium transition-all duration-150
          ${
            activo
              ? 'bg-white/10 border border-white/[0.08]'
              : hover
                ? 'bg-white/[0.05] border border-transparent'
                : 'border border-transparent'
          }`}
        style={{ color: textColor }}
      >
        {activo && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[#0EA5E9]" />
        )}
        <span
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150"
          style={{ color: iconColor }}
        >
          {item.icon}
        </span>
        <span className="flex-1">{item.label ?? t(item.labelKey)}</span>
      </Link>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Nav items
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
    label: 'Equipo',
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
  {
    labelKey: 'nav.subscription',
    label: 'Suscripción',
    href: '/admin/suscripcion',
    icon: <CreditCard className="w-[18px] h-[18px]" />,
    disabled: false,
  },
]

// ─────────────────────────────────────────────
// SidebarContent
// ─────────────────────────────────────────────

function SidebarContent({
  adminNombre,
  empresaNombre,
  logoUrl,
  pathname,
  onClose,
  onLogout,
  onLogoUpload,
}: {
  adminNombre: string
  empresaNombre: string
  logoUrl: string
  pathname: string
  onClose?: () => void
  onLogout: () => void
  onLogoUpload: (url: string) => void
}) {
  const { t } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showLogoMenu, setShowLogoMenu] = useState(false)
  const logoDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (logoDropdownRef.current && !logoDropdownRef.current.contains(e.target as Node)) {
        setShowLogoMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const iniciales = adminNombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('') || 'A'

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      onLogoUpload(url)
      setShowLogoMenu(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Logo empresa (arriba izquierda) — dropdown ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="relative" ref={logoDropdownRef}>
          <button
            type="button"
            onClick={() => setShowLogoMenu(v => !v)}
            className="group flex items-center gap-1.5 min-w-0 rounded-lg px-1.5 py-1
              hover:bg-white/[0.05] transition-colors duration-150"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo empresa" className="h-7 w-auto object-contain max-w-[100px]" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#0EA5E9]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#38BDF8] text-xs font-bold">
                    {(empresaNombre || 'E')[0].toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-semibold text-[#38BDF8]/80 truncate max-w-[90px]">
                  {empresaNombre || 'Mi empresa'}
                </span>
              </div>
            )}
            <ChevronDown className={`w-3 h-3 text-[#38BDF8]/50 group-hover:text-[#38BDF8] flex-shrink-0 transition-all duration-150 ${showLogoMenu ? 'rotate-180' : ''}`} />
          </button>

          {showLogoMenu && (
            <div
              className="absolute top-full left-0 mt-1.5 w-44 rounded-xl
                border border-white/[0.08] bg-gray-900 shadow-2xl z-50 overflow-hidden py-1"
              style={{ backgroundColor: '#111827', color: 'white' }}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs
                  hover:bg-white/[0.08] transition-colors duration-150"
                style={{ color: 'white' }}
              >
                <ImagePlus className="w-3.5 h-3.5 flex-shrink-0" />
                {logoUrl ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => { onLogoUpload(''); setShowLogoMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs
                    hover:bg-red-500/[0.12] transition-colors duration-150"
                  style={{ color: '#fca5a5' }}
                >
                  <X className="w-3.5 h-3.5 flex-shrink-0" />
                  Quitar logo
                </button>
              )}
            </div>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
              text-white/70 hover:text-white hover:bg-white/[0.06]
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

      {/* ── Footer: perfil admin + logout ── */}
      <div className="px-3 py-3 border-t border-white/[0.06] space-y-1">
        {/* Perfil editable */}
        <div className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl">
          {/* Avatar */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0EA5E9]/20 border border-[#0EA5E9]/25
            flex items-center justify-center">
            <span className="text-[#7DD3FC] text-xs font-bold">{iniciales}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#38BDF8]/80 truncate">
              {adminNombre || 'Admin'}
            </p>
            <p className="text-[11px] text-[#38BDF8]/50">{t('common.admin')}</p>
          </div>
          {/* Editar perfil */}
          <Link
            href="/admin/perfil"
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
              text-[#38BDF8]/50 hover:text-[#38BDF8] hover:bg-[#0EA5E9]/10
              transition-colors duration-150"
            title="Editar perfil"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Link>
          {/* Logout */}
          <button
            onClick={onLogout}
            aria-label={t('common.logout')}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
              text-[#38BDF8]/50 hover:text-[#38BDF8] hover:bg-[#0EA5E9]/10
              transition-colors duration-150 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// AdminHeader
// ─────────────────────────────────────────────

function AdminHeader({
  alertasCount,
  adminNombre,
  onMenuClick,
}: {
  alertasCount: number
  adminNombre: string
  onMenuClick: () => void
}) {
  const iniciales = adminNombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('') || 'A'

  return (
    <header className="h-14 flex-shrink-0 px-4 sm:px-6"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto h-full flex items-center gap-3">
        {/* Hamburger — solo mobile */}
        <button
          onClick={onMenuClick}
          className="md:hidden transition-colors duration-150 p-1 -ml-1
            text-[var(--text-muted)] hover:text-[var(--foreground)]"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Avatar admin — solo iniciales, sin nombre */}
        <div className="w-8 h-8 rounded-full bg-[#0EA5E9]/20 border border-[#0EA5E9]/25
          flex items-center justify-center flex-shrink-0">
          <span className="text-[#7DD3FC] text-[11px] font-bold">{iniciales}</span>
        </div>

        <div className="flex-1" />

        {/* Bell + badge — derecha */}
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
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────
// Layout principal
// ─────────────────────────────────────────────

const LOGO_STORAGE_KEY = 'heero_empresa_logo'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [adminNombre, setAdminNombre] = useState('')
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [alertasCount, setAlertasCount] = useState(0)
  const [sidebarAbierto, setSidebarAbierto] = useState(false)
  const [plan, setPlan] = useState<PlanId>('trial')
  const [empleadosCount, setEmpleadosCount] = useState(0)
  const [logoUrl, setLogoUrl] = useState('')

  // Cargar logo guardado en localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LOGO_STORAGE_KEY)
    if (saved) setLogoUrl(saved)
  }, [])

  const handleLogoUpload = (url: string) => {
    setLogoUrl(url)
    if (url) {
      localStorage.setItem(LOGO_STORAGE_KEY, url)
    } else {
      localStorage.removeItem(LOGO_STORAGE_KEY)
    }
  }

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      const supabase = createClient()
      await supabase.auth.signOut()
    }
    window.location.href = '/auth/login'
  }, [])

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

        // Cargar plan, nombre empresa y conteo de empleados
        const [empresaRes, empleadosRes] = await Promise.all([
          supabase
            .from('empresas')
            .select('plan, nombre')
            .eq('id', usuarioData.empresa_id)
            .single(),
          supabase
            .from('usuarios')
            .select('*', { count: 'exact', head: true })
            .eq('empresa_id', usuarioData.empresa_id)
            .eq('rol', 'empleado'),
        ])
        setPlan(empresaRes.data?.plan ?? 'trial')
        setEmpresaNombre(empresaRes.data?.nombre ?? '')
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
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 sticky top-0 h-dvh"
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)' }}>
        <SidebarContent
          adminNombre={adminNombre}
          empresaNombre={empresaNombre}
          logoUrl={logoUrl}
          pathname={pathname}
          onLogout={handleLogout}
          onLogoUpload={handleLogoUpload}
        />
      </aside>

      {/* ── Contenido principal ── */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--background)' }}>
        <AdminHeader
          alertasCount={alertasCount}
          adminNombre={adminNombre}
          onMenuClick={() => setSidebarAbierto(true)}
        />
        {/* ── Banner trial ── */}
        {esTrial(plan) && (
          <div className="flex-shrink-0 flex items-center justify-between gap-3
            px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-amber-400 text-xs flex-shrink-0">⚡ Trial</span>
              <span className="text-xs text-amber-300/70 truncate">
                {UPGRADE_MSG.empleados(3).replace('Upgradeá para agregar más.', '')}
              </span>
            </div>
            <a
              href="/admin/suscripcion"
              className="flex-shrink-0 text-[11px] font-semibold text-amber-400
                hover:text-amber-300 underline underline-offset-2 transition-colors"
            >
              Ver planes →
            </a>
          </div>
        )}
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
            <motion.div
              className="fixed inset-0 bg-black/60 md:hidden z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarAbierto(false)}
            />
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
                empresaNombre={empresaNombre}
                logoUrl={logoUrl}
                pathname={pathname}
                onClose={() => setSidebarAbierto(false)}
                onLogout={handleLogout}
                onLogoUpload={handleLogoUpload}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
    </ThemeProvider>
  )
}
