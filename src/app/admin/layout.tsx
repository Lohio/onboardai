'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
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

// ─────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────

interface NavItemDef {
  label: string
  href: string
  icon: React.ReactNode
  disabled: boolean
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
          <span className="flex-1 font-medium">{item.label}</span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md
              bg-white/[0.06] text-white/25 border border-white/[0.06]"
          >
            Pronto
          </span>
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div variants={navItemVariants}>
      <Link
        href={item.href}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
          font-medium transition-all duration-150 group
          ${
            activo
              ? 'bg-indigo-600/25 text-white border border-indigo-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
              : 'text-white/55 hover:text-white/85 hover:bg-white/[0.06] border border-transparent'
          }`}
      >
        {/* Indicador lateral para item activo */}
        {activo && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-indigo-400" />
        )}

        {/* Ícono con fondo */}
        <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150
          ${activo
            ? 'bg-indigo-500/20 text-indigo-300'
            : 'bg-white/[0.05] text-white/40 group-hover:bg-white/[0.08] group-hover:text-white/65'
          }`}
        >
          {item.icon}
        </span>

        <span className="flex-1">{item.label}</span>
      </Link>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// SidebarContent
// ─────────────────────────────────────────────

const navItems: NavItemDef[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
    disabled: false,
  },
  {
    label: 'Empleados',
    href: '/admin/empleados',
    icon: <Users className="w-[18px] h-[18px]" />,
    disabled: false,
  },
  {
    label: 'Conocimiento',
    href: '/admin/conocimiento',
    icon: <BookOpen className="w-[18px] h-[18px]" />,
    disabled: false,
  },
  {
    label: 'Contenido IA',
    href: '/admin/contenido',
    icon: <Layers className="w-[18px] h-[18px]" />,
    disabled: false,
  },
  {
    label: 'Reportes',
    href: '/admin/reportes',
    icon: <BarChart2 className="w-[18px] h-[18px]" />,
    disabled: false,
  },
  {
    label: 'Configuración',
    href: '/admin/configuracion',
    icon: <Settings className="w-[18px] h-[18px]" />,
    disabled: false,
  },
]

function SidebarContent({
  adminNombre,
  pathname,
  onClose,
}: {
  adminNombre: string
  pathname: string
  onClose?: () => void
}) {
  const initials = adminNombre
    ? adminNombre
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'A'

  return (
    <div className="flex flex-col h-full">
      {/* ── Logo / marca ── */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]">
        <div className="w-9 h-9 rounded-xl bg-indigo-600/25 border border-indigo-500/30
          flex items-center justify-center flex-shrink-0
          shadow-[0_0_16px_rgba(59,79,216,0.2)]">
          <Bot className="w-[18px] h-[18px] text-indigo-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white/90 leading-none">OnboardAI</p>
          <p className="text-[11px] text-white/35 mt-0.5">Panel de administración</p>
        </div>
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
        {/* Etiqueta de sección */}
        <p className="px-3 mb-1.5 text-[10px] font-semibold text-white/25 uppercase tracking-widest">
          Navegación
        </p>
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

      {/* ── Footer: avatar del admin ── */}
      <div className="px-3 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl
          hover:bg-white/[0.04] transition-colors duration-150 cursor-default">
          <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30
            flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-300 text-xs font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/80 truncate">{adminNombre || 'Admin'}</p>
            <p className="text-[11px] text-white/35 mt-0.5">Administrador</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// AdminHeader
// ─────────────────────────────────────────────

function AdminHeader({
  adminNombre,
  alertasCount,
  onMenuClick,
  onLogout,
}: {
  adminNombre: string
  alertasCount: number
  onMenuClick: () => void
  onLogout: () => void
}) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = adminNombre
    ? adminNombre
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'A'

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false)
      }
    }
    if (menuAbierto) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuAbierto])

  return (
    <header className="h-14 border-b border-white/[0.06] flex items-center px-4 gap-3 flex-shrink-0">
      {/* Hamburger — solo mobile */}
      <button
        onClick={onMenuClick}
        className="md:hidden text-white/40 hover:text-white/80 transition-colors duration-150 p-1 -ml-1"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Título */}
      <h1 className="text-sm font-semibold text-white/80 flex-1">Dashboard</h1>

      {/* Bell + badge */}
      <button
        className="relative p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.04]
          transition-colors duration-150"
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

      {/* Avatar + dropdown */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuAbierto(prev => !prev)}
          className="w-7 h-7 rounded-full bg-indigo-600/25 border border-indigo-500/25
            flex items-center justify-center hover:bg-indigo-600/40 hover:border-indigo-500/50
            transition-colors duration-150 cursor-pointer"
          aria-label="Menú de usuario"
        >
          <span className="text-indigo-300 text-[11px] font-semibold">{initials}</span>
        </button>

        <AnimatePresence>
          {menuAbierto && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="absolute right-0 top-full mt-2 w-48 z-50
                rounded-xl border border-white/[0.08] bg-[#0f1f3d]/95 backdrop-blur-xl
                shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden"
            >
              {/* Info del usuario */}
              <div className="px-3 py-3 border-b border-white/[0.06]">
                <p className="text-xs font-medium text-white/80 truncate">{adminNombre || 'Admin'}</p>
                <p className="text-[11px] text-white/35 mt-0.5">Administrador</p>
              </div>

              {/* Cerrar sesión */}
              <div className="p-1.5">
                <button
                  onClick={() => { setMenuAbierto(false); onLogout() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
                    text-red-400/80 hover:text-red-400 hover:bg-red-500/10
                    transition-colors duration-150 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
                  Cerrar sesión
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────
// Layout principal
// ─────────────────────────────────────────────

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [loading, setLoading] = useState(true)
  const [adminNombre, setAdminNombre] = useState('')
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [alertasCount, setAlertasCount] = useState(0)
  const [sidebarAbierto, setSidebarAbierto] = useState(false)

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
          <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin-fast" />
          <span className="text-sm text-white/40">Cargando...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh gradient-bg flex">
      {/* ── Sidebar desktop (fijo) ── */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 border-r border-white/[0.07] bg-white/[0.02]">
        <SidebarContent adminNombre={adminNombre} pathname={pathname} />
      </aside>

      {/* ── Contenido principal ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          adminNombre={adminNombre}
          alertasCount={alertasCount}
          onMenuClick={() => setSidebarAbierto(true)}
          onLogout={handleLogout}
        />
        {/* El overflow va en main, no en el div hijo que envuelve {children} —
            si estuviera en el div hijo, crearía un stacking context que confinaría
            los position:fixed de modales dentro del div en vez del viewport. */}
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>

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
              className="fixed left-0 top-0 h-full w-64 md:hidden z-50
                border-r border-white/[0.06] bg-surface-900/95 backdrop-blur-xl"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <SidebarContent
                adminNombre={adminNombre}
                pathname={pathname}
                onClose={() => setSidebarAbierto(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
