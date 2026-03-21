'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, LayoutDashboard, Building2, Users,
  BarChart3, Settings, LogOut, Menu, X, Bell,
  ShieldCheck, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Nav config
// ─────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Dashboard',   href: '/superadmin',              icon: LayoutDashboard, exact: true  },
  { label: 'Empresas',    href: '/superadmin/empresas',     icon: Building2,       exact: false },
  { label: 'Empleados',   href: '/superadmin/empleados',    icon: Users,           exact: false },
  { label: 'Analítica',   href: '/superadmin/analitica',    icon: BarChart3,       exact: false },
  { label: 'Config',      href: '/superadmin/configuracion',icon: Settings,        exact: false },
]

// ─────────────────────────────────────────────
// Animations
// ─────────────────────────────────────────────

const sidebarVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.055, delayChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  show:   { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 26 } },
}

// ─────────────────────────────────────────────
// NavItem
// ─────────────────────────────────────────────

function NavItem({ href, label, icon: Icon, exact, pathname }: {
  href: string; label: string; icon: React.ElementType
  exact: boolean; pathname: string
}) {
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <motion.div variants={itemVariants}>
      <Link
        href={href}
        className={cn(
          'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
          active
            ? 'bg-violet-600/25 text-white border border-violet-500/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
            : 'text-white/50 hover:text-white/85 hover:bg-white/[0.06] border border-transparent',
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-violet-400" />
        )}
        <span className={cn(
          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150',
          active
            ? 'bg-violet-500/20 text-violet-300'
            : 'bg-white/[0.05] text-white/35 group-hover:bg-white/[0.08] group-hover:text-white/60',
        )}>
          <Icon className="w-[17px] h-[17px]" />
        </span>
        <span className="flex-1">{label}</span>
        {active && <ChevronRight className="w-3.5 h-3.5 text-violet-400/60 flex-shrink-0" />}
      </Link>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// SidebarContent
// ─────────────────────────────────────────────

function SidebarContent({ nombre, pathname, onClose }: {
  nombre: string; pathname: string; onClose?: () => void
}) {
  const initials = nombre ? nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'S'
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]">
        <div className="w-9 h-9 rounded-xl bg-violet-600/30 border border-violet-500/35 flex items-center justify-center flex-shrink-0 shadow-[0_0_16px_rgba(139,92,246,0.25)]">
          <Globe className="w-[18px] h-[18px] text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white/90 leading-none">OnboardAI</p>
          <p className="text-[11px] text-violet-400/70 mt-0.5 font-medium">SuperAdmin</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors md:hidden">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Badge superadmin */}
      <div className="mx-3 mt-3 mb-1 px-3 py-2 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
        <span className="text-[11px] text-violet-300/80 font-medium">Acceso global al sistema</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold text-white/20 uppercase tracking-widest">Navegación</p>
        <motion.div variants={sidebarVariants} initial="hidden" animate="show" className="space-y-0.5">
          {NAV_ITEMS.map(item => (
            <NavItem key={item.href} {...item} pathname={pathname} />
          ))}
        </motion.div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors cursor-default">
          <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-violet-300 text-xs font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/80 truncate">{nombre || 'Superadmin'}</p>
            <p className="text-[11px] text-violet-400/60 mt-0.5">dev · superadmin</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────

function SuperHeader({ nombre, onMenu, onLogout }: {
  nombre: string; onMenu: () => void; onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const initials = nombre ? nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'S'

  return (
    <header className="h-14 border-b border-white/[0.06] flex items-center px-4 gap-3 flex-shrink-0">
      <button onClick={onMenu} className="md:hidden text-white/40 hover:text-white/80 transition-colors p-1 -ml-1">
        <Menu className="w-5 h-5" />
      </button>

      {/* Breadcrumb visual */}
      <div className="flex-1 flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-600/10 border border-violet-500/20">
          <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-semibold text-violet-300">SuperAdmin</span>
        </div>
      </div>

      {/* Bell */}
      <button className="relative p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-colors">
        <Bell className="w-4 h-4" />
      </button>

      {/* Avatar dropdown */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(p => !p)}
          className="w-7 h-7 rounded-full bg-violet-600/25 border border-violet-500/25 flex items-center justify-center hover:bg-violet-600/40 transition-colors"
        >
          <span className="text-violet-300 text-[11px] font-semibold">{initials}</span>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="absolute right-0 top-full mt-2 w-48 z-50 rounded-xl border border-white/[0.08] bg-[#0f0b1e]/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="px-3 py-3 border-b border-white/[0.06]">
                <p className="text-xs font-medium text-white/80 truncate">{nombre}</p>
                <p className="text-[11px] text-violet-400/70 mt-0.5">SuperAdmin · dev</p>
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => { setOpen(false); onLogout() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
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

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleLogout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }, [router])

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }

        const { data } = await supabase
          .from('usuarios')
          .select('nombre, rol')
          .eq('id', user.id)
          .single()

        if (!data || data.rol !== 'dev') {
          router.push('/auth/login')
          return
        }

        setNombre(data.nombre ?? '')
      } catch {
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  if (loading) return (
    <div className="min-h-dvh gradient-bg flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin-fast" />
        <span className="text-sm text-white/40">Verificando acceso...</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh gradient-bg flex" style={{ background: 'linear-gradient(135deg, #0a0614 0%, #0d0f1f 50%, #0a0a18 100%)' }}>
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 border-r border-white/[0.06]" style={{ background: 'rgba(139,92,246,0.03)' }}>
        <SidebarContent nombre={nombre} pathname={pathname} />
      </aside>

      {/* Contenido */}
      <div className="flex-1 flex flex-col min-w-0">
        <SuperHeader nombre={nombre} onMenu={() => setDrawerOpen(true)} onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>

      {/* Drawer mobile */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 md:hidden z-40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="fixed left-0 top-0 h-full w-64 md:hidden z-50 border-r border-white/[0.06]"
              style={{ background: '#0a0614' }}
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <SidebarContent nombre={nombre} pathname={pathname} onClose={() => setDrawerOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
