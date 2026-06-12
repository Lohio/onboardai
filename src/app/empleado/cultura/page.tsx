'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2, ArrowRight, Star, GitBranch } from 'lucide-react'
import confetti from 'canvas-confetti'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { ErrorState } from '@/components/shared/ErrorState'
import { cn } from '@/lib/utils'
import { construirArbol } from '@/lib/organigrama'
import type { ContenidoBloque, ProgresoModulo, OrgNodo } from '@/types'
import type { BloqueKey } from '@/components/empleado/cultura/types'
import { BLOQUES_ORDEN, BLOQUES_CONFIG, PREGUNTAS } from '@/components/empleado/cultura/helpers'
import { BloqueCard } from '@/components/empleado/cultura/BloqueCard'
import { OrgBloqueCard } from '@/components/empleado/cultura/OrgBloqueCard'

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function SkeletonCultura() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="shimmer rounded-xl w-11 h-11 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="shimmer rounded-md h-4 w-40" />
              <div className="shimmer rounded-full h-1.5 w-full" />
            </div>
            <div className="shimmer rounded-full h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Barra de scroll global (sticky top)
// ─────────────────────────────────────────────

function ScrollProgressBar() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-50 h-[3px] origin-left"
      style={{
        scaleX,
        background: 'linear-gradient(90deg, #6366f1, #3b82f6, #14b8a6)',
      }}
    />
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function CulturaPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [contenidos, setContenidos] = useState<Partial<Record<BloqueKey, ContenidoBloque>>>({})
  const [progreso, setProgreso] = useState<Partial<Record<BloqueKey, ProgresoModulo>>>({})
  const [readProgress, setReadProgress] = useState<Record<BloqueKey, number>>({
    historia: 0, mision: 0, como_trabajamos: 0, expectativas: 0, hitos: 0,
  })
  const [respuestas, setRespuestas] = useState<Record<BloqueKey, (number | null)[]>>({
    historia: [null, null],
    mision: [null, null],
    como_trabajamos: [null, null],
    expectativas: [null, null],
    hitos: [null, null],
  })
  const [completando, setCompletando] = useState<BloqueKey | null>(null)
  const [hasError, setHasError] = useState(false)
  const [bloqueActivo, setBloqueActivo] = useState<BloqueKey | null>(null)
  const initialSelectDoneRef = useRef(false)

  // Bloque organigrama (opcional)
  const [orgArbol, setOrgArbol] = useState<OrgNodo[]>([])
  const [orgCompletado, setOrgCompletado] = useState(false)
  const [orgCompletando, setOrgCompletando] = useState(false)
  const [orgActivo, setOrgActivo] = useState(false)

  // Cuando se selecciona un bloque normal, desactivar org
  useEffect(() => {
    if (bloqueActivo) setOrgActivo(false)
  }, [bloqueActivo])

  // ── Carga de datos ──
  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setHasError(false)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: perfil, error: perfilError } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()

      if (perfilError || !perfil) throw new Error(perfilError?.message ?? 'Perfil no encontrado')

      const eid = perfil.empresa_id
      setEmpresaId(eid)

      const [contenidosRes, progresoRes, orgNodosRes] = await Promise.all([
        supabase
          .from('conocimiento')
          .select('*')
          .eq('empresa_id', eid)
          .eq('modulo', 'cultura'),
        supabase
          .from('progreso_modulos')
          .select('*')
          .eq('usuario_id', user.id)
          .eq('modulo', 'cultura'),
        supabase
          .from('organigrama_nodos')
          .select('*')
          .eq('empresa_id', eid)
          .eq('visible', true)
          .order('orden'),
      ])

      if (contenidosRes.data) {
        const mapa: Partial<Record<BloqueKey, ContenidoBloque>> = {}
        for (const c of contenidosRes.data) {
          mapa[c.bloque as BloqueKey] = c as ContenidoBloque
        }
        setContenidos(mapa)
      }

      if (progresoRes.data) {
        const mapa: Partial<Record<BloqueKey, ProgresoModulo>> = {}
        for (const p of progresoRes.data) {
          if (p.bloque === 'organigrama') {
            setOrgCompletado(true)
          } else {
            mapa[p.bloque as BloqueKey] = p as ProgresoModulo
          }
        }
        setProgreso(mapa)
      }

      if (orgNodosRes.data && orgNodosRes.data.length > 0) {
        setOrgArbol(construirArbol(orgNodosRes.data as OrgNodo[]))
      }
    } catch (err) {
      console.error('Error cargando cultura:', err)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Seleccionar primer bloque no completado al cargar ──
  useEffect(() => {
    if (loading || initialSelectDoneRef.current) return
    initialSelectDoneRef.current = true
    const first = BLOQUES_ORDEN.find(b => !progreso[b]?.completado) ?? BLOQUES_ORDEN[0]
    setBloqueActivo(first)
    setReadProgress(prev => ({ ...prev, [first]: 100 }))
  }, [loading, progreso])

  // ── Handlers quiz ──
  const handleRespuesta = (bloqueKey: BloqueKey, qIdx: number, opIdx: number) => {
    setRespuestas(prev => ({
      ...prev,
      [bloqueKey]: prev[bloqueKey].map((r, i) => (i === qIdx ? opIdx : r)),
    }))
  }

  const handleReset = (bloqueKey: BloqueKey) => {
    const preguntas = PREGUNTAS[bloqueKey]
    setRespuestas(prev => ({
      ...prev,
      [bloqueKey]: prev[bloqueKey].map((r, i) =>
        r === preguntas[i].correcta ? r : null
      ),
    }))
  }

  const handleComplete = async (bloqueKey: BloqueKey) => {
    if (!userId || completando) return
    setCompletando(bloqueKey)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('progreso_modulos').upsert(
        {
          usuario_id: userId,
          modulo: 'cultura',
          bloque: bloqueKey,
          completado: true,
          completado_at: new Date().toISOString(),
        },
        { onConflict: 'usuario_id,modulo,bloque' },
      )
      if (error) throw error

      setProgreso(prev => ({
        ...prev,
        [bloqueKey]: {
          usuario_id: userId,
          modulo: 'cultura',
          bloque: bloqueKey,
          completado: true,
          completado_at: new Date().toISOString(),
        } as ProgresoModulo,
      }))

      confetti({
        particleCount: 100,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#0EA5E9', '#0D9488', '#38BDF8', '#2DD4BF', '#ffffff'],
      })
      toast.success('¡Bloque completado! 🎉')
      window.dispatchEvent(new CustomEvent('progreso-actualizado'))
    } catch (err) {
      console.error('Error guardando progreso:', err)
      toast.error('No se pudo guardar el progreso')
    } finally {
      setCompletando(null)
    }
  }

  // ── Selección de bloque activo ──
  const handleSelectBloque = (key: BloqueKey) => {
    const idx = BLOQUES_ORDEN.indexOf(key)
    const unlocked = idx === 0 || progreso[BLOQUES_ORDEN[idx - 1]]?.completado === true
    if (!unlocked) return
    setOrgActivo(false)
    setBloqueActivo(key)
    setReadProgress(prev => ({ ...prev, [key]: 100 }))
  }

  // ── Completar bloque organigrama (auto tras 3s de visualización) ──
  const completarOrgBloque = useCallback(async () => {
    if (orgCompletado || orgCompletando || !userId) return
    setOrgCompletando(true)
    try {
      const supabase = createClient()
      await supabase.from('progreso_modulos').upsert({
        usuario_id: userId,
        modulo: 'cultura',
        bloque: 'organigrama',
        completado: true,
        completado_at: new Date().toISOString(),
      })
      setOrgCompletado(true)
    } catch (err) {
      console.warn('[Cultura] completar organigrama:', err)
    } finally {
      setOrgCompletando(false)
    }
  }, [userId, orgCompletado, orgCompletando])

  // ── Derivados ──
  const { totalCompletados, porcentajeGlobal, todoCompleto } = useMemo(() => {
    const total = BLOQUES_ORDEN.filter(b => progreso[b]?.completado).length
    return {
      totalCompletados: total,
      porcentajeGlobal: (total / BLOQUES_ORDEN.length) * 100,
      todoCompleto: total === BLOQUES_ORDEN.length,
    }
  }, [progreso])

  const isUnlocked = (bloque: BloqueKey): boolean => {
    const idx = BLOQUES_ORDEN.indexOf(bloque)
    if (idx === 0) return true
    return progreso[BLOQUES_ORDEN[idx - 1]]?.completado === true
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="shimmer rounded-md h-8 w-52 mb-2" />
          <div className="shimmer rounded-md h-4 w-36 mb-6" />
          <div className="shimmer rounded-full h-1.5 w-full mb-8" />
          <SkeletonCultura />
        </div>
      </div>
    )
  }

  // ── Error ──
  if (hasError) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-6">
        <ErrorState mensaje="No se pudo cargar el módulo de cultura." onRetry={cargarDatos} />
      </div>
    )
  }

  // ── Render principal ──
  return (
    <>
      <ScrollProgressBar />

      <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8 pt-6">
        <div className="max-w-6xl mx-auto">

          {/* ── Page header ── */}
          <div className="flex items-center gap-4 mb-6">
            <Image src="/heero-icons1.svg" alt="" width={45} height={45} />
            <div>
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-1">Módulo 2</p>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">Cultura</h1>
              <p className="text-sm text-gray-500 mt-0.5">Historia, misión, valores y reglas de trabajo</p>
            </div>
          </div>

          {/* Pills navegación */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {BLOQUES_ORDEN.map((bKey, idx) => {
              const completado = progreso[bKey]?.completado
              const activo = bloqueActivo === bKey
              const desbloqueado = idx === 0 || progreso[BLOQUES_ORDEN[idx - 1]]?.completado === true
              const cfg = BLOQUES_CONFIG[bKey]
              return (
                <button
                  key={bKey}
                  onClick={() => handleSelectBloque(bKey)}
                  disabled={!desbloqueado}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                    activo && !completado
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                      : activo && completado
                      ? 'bg-teal-100 text-teal-700 border border-teal-300'
                      : completado
                      ? 'bg-teal-50 text-teal-600 border border-teal-200'
                      : desbloqueado
                      ? 'bg-white border border-gray-200 text-gray-600 hover:text-gray-800 hover:border-gray-300 hover:shadow-sm'
                      : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed opacity-50',
                  )}
                >
                  {completado ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-current opacity-60" />
                  )}
                  {cfg.label}
                </button>
              )
            })}

            {/* Pill organigrama */}
            {orgArbol.length > 0 && (
              <button
                onClick={() => { setOrgActivo(v => !v); setBloqueActivo(null) }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                  orgActivo && !orgCompletado
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                    : orgActivo && orgCompletado
                    ? 'bg-teal-100 text-teal-700 border border-teal-300'
                    : orgCompletado
                    ? 'bg-teal-50 text-teal-600 border border-teal-200'
                    : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-800 hover:border-gray-300 hover:shadow-sm',
                )}
              >
                {orgCompletado ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <GitBranch className="w-3 h-3 opacity-60" />
                )}
                Organigrama
              </button>
            )}
          </div>

          {/* Card de progreso */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">
                Mi progreso en Cultura
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {totalCompletados} / {BLOQUES_ORDEN.length} bloques
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
                <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                  <motion.circle
                    cx="28" cy="28" r="22" fill="none"
                    stroke="url(#culturaProgressGrad)" strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={138.2}
                    animate={{ strokeDashoffset: 138.2 - (138.2 * porcentajeGlobal / 100) }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                  />
                  <defs>
                    <linearGradient id="culturaProgressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3B4FD8" />
                      <stop offset="100%" stopColor="#0D9488" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-gray-900 leading-none">{Math.round(porcentajeGlobal)}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Progreso del módulo</p>
                <p className="text-xs text-gray-500">Completá los bloques para avanzar</p>
              </div>
            </div>
          </div>

          {/* Bloque activo */}
          <AnimatePresence>
            {bloqueActivo && (
              <motion.div
                key={bloqueActivo}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              >
                <BloqueCard
                  bloqueKey={bloqueActivo}
                  numero={BLOQUES_ORDEN.indexOf(bloqueActivo) + 1}
                  contenido={contenidos[bloqueActivo] ?? null}
                  unlocked={isUnlocked(bloqueActivo)}
                  completado={progreso[bloqueActivo]?.completado === true}
                  readProgress={readProgress[bloqueActivo]}
                  respuestas={respuestas[bloqueActivo]}
                  completando={completando === bloqueActivo}
                  onRespuesta={(qIdx, opIdx) => handleRespuesta(bloqueActivo, qIdx, opIdx)}
                  onComplete={() => handleComplete(bloqueActivo)}
                  onReset={() => handleReset(bloqueActivo)}
                  contentRef={() => {}}
                  isActive
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bloque organigrama */}
          <AnimatePresence>
            {orgActivo && orgArbol.length > 0 && (
              <motion.div
                key="organigrama"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              >
                <OrgBloqueCard
                  arbol={orgArbol}
                  completado={orgCompletado}
                  onAutoComplete={completarOrgBloque}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Banner de módulo completado */}
          <AnimatePresence>
            {todoCompleto && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 24, delay: 0.2 }}
                className="mt-6 bg-teal-50 border border-teal-200 rounded-xl overflow-hidden"
              >
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <Star className="w-5 h-5 text-teal-600 fill-teal-200" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-teal-800">
                        ¡Completaste Cultura e identidad!
                      </p>
                      <p className="text-xs text-teal-600 mt-0.5">
                        Conocés la empresa y sus valores. Ahora es el momento de conocer tu rol.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/empleado/rol"
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold
                      bg-teal-100 text-teal-700 hover:bg-teal-200 hover:text-teal-800
                      border border-teal-300 transition-all duration-150"
                  >
                    Ir a mi Rol
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}
