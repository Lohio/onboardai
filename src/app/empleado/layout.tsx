'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// Configuración de módulos
// ─────────────────────────────────────────────

const MODULOS = [
  { key: 'M1', href: '/empleado/perfil' },
  { key: 'M2', href: '/empleado/cultura' },
  { key: 'M3', href: '/empleado/rol' },
  { key: 'M4', href: '/empleado/asistente' },
] as const

// M2: requiere 5 bloques de cultura completados
const CULTURA_TOTAL = 5

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
    M4: false,
  })
  const [empleadoNombre, setEmpleadoNombre] = useState('')
  const [empleadoPuesto, setEmpleadoPuesto] = useState('')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

      // Datos del empleado para el avatar
      const { data: usuarioData } = await supabase
        .from('usuarios')
        .select('nombre, puesto')
        .eq('id', user.id)
        .single()

      if (usuarioData) {
        setEmpleadoNombre(usuarioData.nombre ?? '')
        setEmpleadoPuesto(usuarioData.puesto ?? '')
      }

      // M1: el usuario existe y llegó aquí → siempre completado
      const m1 = true

      // M2 y M3: leer progreso_modulos
      const { data: rows } = await supabase
        .from('progreso_modulos')
        .select('modulo, bloque, completado')
        .eq('usuario_id', user.id)

      const progresoRows = rows ?? []
      const culturaCompletados = progresoRows.filter(
        r => r.modulo === 'cultura' && r.completado
      ).length
      const m2 = culturaCompletados >= CULTURA_TOTAL
      const m3 = progresoRows.some(r => r.modulo === 'rol' && r.completado)

      // M4: tiene al menos una conversación de IA
      let m4 = false
      try {
        const { count } = await supabase
          .from('conversaciones_ia')
          .select('*', { count: 'exact', head: true })
          .eq('usuario_id', user.id)
        m4 = (count ?? 0) > 0
      } catch {
        // tabla puede no existir si M4 no está implementado aún
      }

      const estados: EstadoModulos = { M1: m1, M2: m2, M3: m3, M4: m4 }
      setModulos(estados)
      const completados = Object.values(estados).filter(Boolean).length
      setProgreso(Math.round((completados / 4) * 100))
    }

    cargarProgreso()
  }, [router, pathname]) // re-evalúa al cambiar de ruta

  return (
    <div className="flex flex-col h-dvh">
      {/* ── Header de progreso (sticky) ── */}
      <header className="flex-shrink-0 sticky top-0 z-30 border-b border-white/[0.06] bg-[#0f1f3d]/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 h-12">
          {/* Logo */}
          <Link
            href="/empleado/perfil"
            className="flex items-center gap-2 flex-shrink-0 hover:opacity-75 transition-opacity duration-150"
          >
            <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <span className="text-xs font-semibold text-white/55 hidden sm:block">OnboardAI</span>
          </Link>

          <div className="h-4 w-px bg-white/[0.07] hidden sm:block flex-shrink-0" />

          {/* Indicadores de módulos */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
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
                        ? 'bg-indigo-600/15'
                        : 'hover:bg-white/[0.04]'
                    }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                      completado
                        ? 'bg-teal-500'
                        : esActual
                        ? 'bg-indigo-400'
                        : 'bg-white/15'
                    }`}
                  />
                  <span
                    className={`text-[11px] font-medium ${
                      esActual
                        ? 'text-indigo-300'
                        : completado
                        ? 'text-teal-400/60'
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
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-teal-500"
                initial={{ width: '0%' }}
                animate={{ width: `${progreso}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="text-[11px] font-mono text-white/40 tabular-nums w-7 text-right">
              {progreso}%
            </span>
          </div>

          {/* Avatar + dropdown */}
          <div ref={menuRef} className="relative flex-shrink-0">
            <button
              onClick={() => setMenuAbierto(prev => !prev)}
              className="w-7 h-7 rounded-full bg-indigo-600/25 border border-indigo-500/25
                flex items-center justify-center hover:bg-indigo-600/40 hover:border-indigo-500/50
                transition-colors duration-150 cursor-pointer"
              aria-label="Menú de usuario"
            >
              <span className="text-indigo-300 text-[11px] font-semibold">
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
                    rounded-xl border border-white/[0.08] bg-[#0f1f3d]/95 backdrop-blur-xl
                    shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden"
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
                      Cerrar sesión
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Contenido de la página — flex-1 para que el chat pueda usar h-full */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
