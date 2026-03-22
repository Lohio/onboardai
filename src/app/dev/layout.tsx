'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal, LayoutDashboard, Building2, Users,
  Settings, LogOut, Menu, X, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// Navegación
// ─────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Dashboard',  href: '/dev',           icon: <LayoutDashboard className="w-4 h-4" />, exact: true },
  { label: 'Empresas',   href: '/dev/empresas',  icon: <Building2 className="w-4 h-4" />,       exact: false },
  { label: 'Usuarios',   href: '/dev/usuarios',  icon: <Users className="w-4 h-4" />,           exact: false },
  { label: 'Config',     href: '/dev/config',    icon: <Settings className="w-4 h-4" />,        exact: false },
]

// ─────────────────────────────────────────────
// SidebarContent (reutilizable desktop + drawer)
// ─────────────────────────────────────────────

function SidebarContent({
  pathname,
  devNombre,
  onLogout,
  onClose,
}: {
  pathname: string
  devNombre: string
  onLogout: () => void
  onClose?: () => void
}) {
  const initials = devNombre
    ? devNombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'DV'

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/20
          flex items-center justify-center flex-shrink-0">
          <Terminal className="w-4 h-4 text-amber-400" />
        </div>
        <span className="font-semibold text-white text-sm">Dev Tools</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto text-white/30 hover:text-white/70 transition-colors md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const activo = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                transition-colors duration-150
                ${activo
                  ? 'bg-amber-500/12 text-amber-300 border border-amber-500/20'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                }`}
            >
              <span className={activo ? 'text-amber-400' : 'text-white/35'}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {activo && <ChevronRight className="w-3 h-3 text-amber-400/50" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer: avatar + logout */}
      <div className="px-3 py-4 border-t border-white/[0.06] space-y-1">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/25
            flex items-center justify-center flex-shrink-0">
            <span className="text-amber-300 text-[11px] font-semibold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/70 truncate">{devNombre || 'Dev'}</p>
            <p className="text-[10px] text-amber-400/60">Developer</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs
            text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors duration-150"
        >
          <LogOut className="w-3.5 h-3.5" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Layout principal
// ─────────────────────────────────────────────

export default function DevLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [loading, setLoading] = useState(true)
  const [devNombre, setDevNombre] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }

        const { data: userData } = await supabase
          .from('usuarios')
          .select('nombre, rol')
          .eq('id', user.id)
          .single()

        // Doble check de rol dev en el layout (además del middleware)
        if (!userData || userData.rol !== 'dev') {
          router.push(userData?.rol === 'admin' ? '/admin' : '/empleado/perfil')
          return
        }

        setDevNombre(userData.nombre ?? '')
      } catch {
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  const handleLogout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }, [router])

  if (loading) {
    return (
      <div className="min-h-dvh gradient-bg flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin-fast" />
          <span className="text-sm text-white/40">Cargando...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh gradient-bg flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0 border-r border-white/[0.06] bg-[#111110]/40">
        <SidebarContent
          pathname={pathname}
          devNombre={devNombre}
          onLogout={handleLogout}
        />
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header mobile */}
        <header className="md:hidden h-12 border-b border-white/[0.06] flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white/40 hover:text-white/80 transition-colors p-1 -ml-1"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-white/70">Dev Tools</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>

      {/* Sidebar mobile (drawer) */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 md:hidden z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              className="fixed left-0 top-0 h-full w-56 md:hidden z-50
                border-r border-white/[0.06] bg-[#111110]/95 backdrop-blur-xl"
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <SidebarContent
                pathname={pathname}
                devNombre={devNombre}
                onLogout={handleLogout}
                onClose={() => setSidebarOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
