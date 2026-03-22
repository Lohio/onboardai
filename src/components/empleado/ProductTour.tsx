'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface PasoTour {
  elementId: string | null
  titulo: string
  descripcion: string
  posicion: 'top' | 'bottom' | 'center' | 'right'
}

interface SpotlightRect {
  x: number
  y: number
  w: number
  h: number
  radius: number
}

interface ConfettiParticula {
  id: number
  color: string
  left: number
  delay: number
  duration: number
  size: number
}

// ─────────────────────────────────────────────
// Configuración del tour
// ─────────────────────────────────────────────

const PASOS: PasoTour[] = [
  {
    elementId: null,
    posicion: 'center',
    titulo: '¡Bienvenido/a a tu onboarding! 👋',
    descripcion:
      'En los próximos minutos te voy a mostrar cómo funciona Heero para que tu primer día sea lo más fácil posible.',
  },
  {
    elementId: 'tour-navbar-modulos',
    posicion: 'bottom',
    titulo: 'Tu camino de onboarding',
    descripcion:
      'Estos son tus 3 módulos. Se desbloquean en orden. Dot verde = completado, azul = en curso.',
  },
  {
    elementId: 'tour-hero-card',
    posicion: 'right',
    titulo: 'Tu perfil',
    descripcion:
      'Acá encontrás tus datos, tu fecha de ingreso y los contactos clave: tu manager, buddy, IT y RRHH.',
  },
  {
    elementId: 'tour-onboarding-tracker',
    posicion: 'right',
    titulo: 'Tu progreso',
    descripcion:
      'Este tracker te muestra en qué módulo estás y cuánto te falta para completar el onboarding.',
  },
  {
    elementId: 'tour-agente-btn',
    posicion: 'top',
    titulo: 'Tu asistente IA 🤖',
    descripcion:
      'Este botón abre tu guía personal. Podés preguntarle cualquier cosa sobre la empresa en cualquier momento.',
  },
  {
    elementId: null,
    posicion: 'center',
    titulo: '¡Todo listo! 🎉',
    descripcion:
      'Ya conocés la app. Tu primer paso es completar el módulo M1 — Perfil. ¡Empecemos!',
  },
]

const CLAVE_TOUR_LS   = 'tour_completado' // clave localStorage (fallback)
const SPOTLIGHT_PAD   = 8
const TOOLTIP_WIDTH   = 280
const TOOLTIP_MARGIN  = 14
const TOOLTIP_H_EST   = 190 // altura estimada del tooltip para cálculo 'top'

// Colores confetti
const CONFETTI_COLORS = ['#0EA5E9', '#0D9488', '#F59E0B', '#EC4899', '#8B5CF6', '#10B981']

// ─────────────────────────────────────────────
// Generador de confetti (estable entre renders)
// ─────────────────────────────────────────────

function generarConfetti(n: number): ConfettiParticula[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: (i / n) * 100 + (Math.sin(i * 37) * 8),
    delay: (i * 0.08) % 2,
    duration: 2 + (i % 3) * 0.6,
    size: 5 + (i % 4),
  }))
}

const CONFETTI_PARTICULAS = generarConfetti(24)

// ─────────────────────────────────────────────
// Contenido del tooltip (compartido)
// ─────────────────────────────────────────────

interface TooltipContenidoProps {
  paso: PasoTour
  pasoActual: number
  total: number
  nombreEmpleado: string
  onSaltar: () => void
  onAvanzar: () => void
}

function TooltipContenido({
  paso,
  pasoActual,
  total,
  nombreEmpleado,
  onSaltar,
  onAvanzar,
}: TooltipContenidoProps) {
  const esUltimo = pasoActual === total - 1

  // Personalizar el título del primer paso con el nombre
  const titulo =
    pasoActual === 0 && nombreEmpleado
      ? paso.titulo.replace('¡Bienvenido/a', `¡Bienvenido/a, ${nombreEmpleado}`)
      : paso.titulo

  return (
    <>
      {/* Número de paso */}
      <p style={{ color: 'rgba(14,165,233,0.65)', fontSize: '11px', marginBottom: '6px' }}>
        Paso {pasoActual + 1} de {total}
      </p>

      {/* Título */}
      <p style={{
        color: 'rgba(255,255,255,0.9)',
        fontSize: '14px',
        fontWeight: 500,
        marginBottom: '8px',
        lineHeight: '1.4',
      }}>
        {titulo}
      </p>

      {/* Descripción */}
      <p style={{
        color: 'rgba(255,255,255,0.55)',
        fontSize: '12px',
        lineHeight: '1.65',
        marginBottom: '18px',
      }}>
        {paso.descripcion}
      </p>

      {/* Dots de progreso */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        marginBottom: '14px',
      }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              width:  i === pasoActual ? '18px' : '6px',
              height: '6px',
              borderRadius: '9999px',
              background:
                i === pasoActual
                  ? 'rgba(14,165,233,1)'
                  : i < pasoActual
                  ? 'rgba(14,165,233,0.35)'
                  : 'rgba(255,255,255,0.1)',
              transition: 'width 0.25s ease, background 0.25s ease',
            }}
          />
        ))}
      </div>

      {/* Botones */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {!esUltimo && (
          <button
            onClick={onSaltar}
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.35)',
              background: 'rgba(255,255,255,0.05)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
            }}
          >
            Saltar tour
          </button>
        )}
        <button
          onClick={onAvanzar}
          style={{
            flex: esUltimo ? 1 : 'none',
            padding: '7px 18px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#fff',
            background: '#0EA5E9',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {esUltimo ? '¡Empezar!' : 'Siguiente →'}
        </button>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export default function ProductTour({ nombreEmpleado }: { nombreEmpleado: string }) {
  const router = useRouter()

  const [mounted,       setMounted      ] = useState(false)
  const [activo,        setActivo       ] = useState(false)
  const [pasoActual,    setPasoActual   ] = useState(0)
  const [spotlight,     setSpotlight    ] = useState<SpotlightRect | null>(null)
  const [tooltipPos,    setTooltipPos   ] = useState<{ top: number; left: number } | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Hidratar solo en cliente ──────────────────────────────────
  useEffect(() => { setMounted(true) }, [])

  // ── Iniciar tour si no fue completado (Supabase + localStorage fallback) ──
  useEffect(() => {
    if (!mounted) return

    // Fallback rápido: si localStorage ya lo tiene, no mostrar
    if (localStorage.getItem(CLAVE_TOUR_LS)) return

    // Si el hint fue silenciado recientemente → esperar más
    const silenciadoHasta = localStorage.getItem('agente_silenciado_hasta')
    const hintReciente = silenciadoHasta && new Date(silenciadoHasta) > new Date()
    const delay = hintReciente ? 3000 : 800

    async function verificarTourEnSupabase() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          // Sin sesión: usar solo localStorage
          timerRef.current = setTimeout(() => setActivo(true), delay)
          return
        }

        const { data } = await supabase
          .from('usuarios')
          .select('tour_completado')
          .eq('id', user.id)
          .single()

        if (data?.tour_completado) {
          // Sincronizar localStorage para evitar consultas futuras
          localStorage.setItem(CLAVE_TOUR_LS, 'true')
          return
        }

        // Tour no completado → activar con delay
        timerRef.current = setTimeout(() => setActivo(true), delay)
      } catch {
        // Error de red/DB: mostrar tour igual (mejor UX que no mostrarlo)
        timerRef.current = setTimeout(() => setActivo(true), delay)
      }
    }

    verificarTourEnSupabase()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [mounted])

  // ── Calcular spotlight y posición del tooltip ─────────────────
  const calcularPosiciones = useCallback(() => {
    const paso = PASOS[pasoActual]

    if (!paso.elementId) {
      setSpotlight(null)
      setTooltipPos(null)
      return
    }

    const el = document.getElementById(paso.elementId)
    if (!el) {
      setSpotlight(null)
      setTooltipPos(null)
      return
    }

    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      setSpotlight(null)
      setTooltipPos(null)
      return
    }

    // Detectar border-radius del elemento para el spotlight
    const br = parseFloat(window.getComputedStyle(el).borderRadius) || 8

    setSpotlight({
      x:      rect.left  - SPOTLIGHT_PAD,
      y:      rect.top   - SPOTLIGHT_PAD,
      w:      rect.width  + SPOTLIGHT_PAD * 2,
      h:      rect.height + SPOTLIGHT_PAD * 2,
      radius: br + SPOTLIGHT_PAD,
    })

    // Calcular posición del tooltip
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top  = 0
    let left = 0

    switch (paso.posicion) {
      case 'bottom': {
        // Tooltip debajo del elemento (navbar)
        top  = rect.bottom + SPOTLIGHT_PAD + TOOLTIP_MARGIN
        left = Math.max(8, Math.min(
          rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2,
          vw - TOOLTIP_WIDTH - 8
        ))
        break
      }
      case 'top': {
        // Tooltip encima del elemento (botón flotante)
        top  = rect.top - SPOTLIGHT_PAD - TOOLTIP_MARGIN - TOOLTIP_H_EST
        left = Math.max(8, Math.min(
          rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2,
          vw - TOOLTIP_WIDTH - 8
        ))
        // Si se sale por arriba, mostrar debajo
        if (top < 8) {
          top = rect.bottom + SPOTLIGHT_PAD + TOOLTIP_MARGIN
        }
        break
      }
      case 'right': {
        // Tooltip a la derecha si hay espacio; sino debajo
        const espacioDerecha = vw - rect.right
        if (espacioDerecha >= TOOLTIP_WIDTH + TOOLTIP_MARGIN + SPOTLIGHT_PAD * 2) {
          top  = Math.max(8, Math.min(
            rect.top + rect.height / 2 - TOOLTIP_H_EST / 2,
            vh - TOOLTIP_H_EST - 8
          ))
          left = rect.right + SPOTLIGHT_PAD + TOOLTIP_MARGIN
        } else {
          // Fallback: debajo centrado
          top  = rect.bottom + SPOTLIGHT_PAD + TOOLTIP_MARGIN
          left = Math.max(8, Math.min(
            rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2,
            vw - TOOLTIP_WIDTH - 8
          ))
        }
        break
      }
    }

    // Clamp vertical
    top = Math.max(8, Math.min(top, vh - TOOLTIP_H_EST - 8))

    setTooltipPos({ top, left })
  }, [pasoActual])

  useEffect(() => {
    if (!activo) return

    calcularPosiciones()

    window.addEventListener('resize',  calcularPosiciones)
    window.addEventListener('scroll',  calcularPosiciones)
    return () => {
      window.removeEventListener('resize', calcularPosiciones)
      window.removeEventListener('scroll', calcularPosiciones)
    }
  }, [activo, pasoActual, calcularPosiciones])

  // ── Marcar tour como completado en Supabase + localStorage ───
  const completarTour = useCallback(async () => {
    // Guardar en localStorage inmediatamente (respuesta rápida)
    localStorage.setItem(CLAVE_TOUR_LS, 'true')
    setActivo(false)

    // Persistir en Supabase de forma asíncrona (no bloquea la UI)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('usuarios')
          .update({ tour_completado: true })
          .eq('id', user.id)
      }
    } catch {
      // Silencioso: localStorage ya fue guardado como fallback
    }
  }, [])

  const avanzar = useCallback(() => {
    if (pasoActual < PASOS.length - 1) {
      setPasoActual(p => p + 1)
    } else {
      completarTour().then(() => router.push('/empleado/perfil'))
    }
  }, [pasoActual, completarTour, router])

  const saltar = useCallback(() => {
    completarTour()
  }, [completarTour])

  if (!mounted || !activo) return null

  const paso       = PASOS[pasoActual]
  const esCentrado = paso.posicion === 'center'
  const esUltimo   = pasoActual === PASOS.length - 1
  const nombreCorto = nombreEmpleado.split(' ')[0] || nombreEmpleado

  // Estilos reutilizables del tooltip/modal
  const estiloContenedor = {
    background:   '#111110',
    border:       '0.5px solid rgba(14,165,233,0.45)',
    borderRadius: '14px',
    padding:      '20px',
    boxShadow:    '0 8px 32px rgba(0,0,0,0.5)',
  } as const

  return createPortal(
    <AnimatePresence>
      {activo && (
        <div key="tour-root">

          {/* ── Overlay con spotlight recortado (SVG mask) ─────── */}
          {!esCentrado && spotlight ? (
            <motion.svg
              key="svg-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                inset: 0,
                width: '100%',
                height: '100%',
                zIndex: 9996,
                pointerEvents: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              <defs>
                <mask id="tour-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <motion.rect
                    initial={{
                      x:      spotlight.x,
                      y:      spotlight.y,
                      width:  spotlight.w,
                      height: spotlight.h,
                      rx:     spotlight.radius,
                    }}
                    animate={{
                      x:      spotlight.x,
                      y:      spotlight.y,
                      width:  spotlight.w,
                      height: spotlight.h,
                      rx:     spotlight.radius,
                    }}
                    transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.75)"
                mask="url(#tour-mask)"
              />
            </motion.svg>
          ) : (
            /* Overlay sólido para pasos centrados */
            <motion.div
              key="overlay-solido"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.80)',
                zIndex: 9996,
                pointerEvents: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            />
          )}

          {/* ── Borde brillante del spotlight ─────────────────── */}
          {!esCentrado && spotlight && (
            <motion.div
              key="spotlight-borde"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: 'fixed', top: 0, left: 0, zIndex: 9997, pointerEvents: 'none' }}
            >
              <motion.div
                initial={{
                  left:         spotlight.x,
                  top:          spotlight.y,
                  width:        spotlight.w,
                  height:       spotlight.h,
                  borderRadius: spotlight.radius,
                }}
                animate={{
                  left:         spotlight.x,
                  top:          spotlight.y,
                  width:        spotlight.w,
                  height:       spotlight.h,
                  borderRadius: spotlight.radius,
                }}
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                style={{
                  position: 'absolute',
                  border:      '2px solid rgba(14,165,233,0.8)',
                  boxShadow:   '0 0 0 4px rgba(14,165,233,0.15)',
                  pointerEvents: 'none',
                }}
              />
            </motion.div>
          )}

          {/* ── Tooltip / modal ───────────────────────────────── */}
          <AnimatePresence mode="wait">
            {esCentrado ? (
              /* Modal centrado (pasos 1 y 6) */
              <motion.div
                key={`modal-${pasoActual}`}
                initial={{ opacity: 0, scale: 0.92, y: 8  }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{    opacity: 0, scale: 0.92, y: 8  }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    ...estiloContenedor,
                    maxWidth: '320px',
                    width: '100%',
                    pointerEvents: 'auto',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Confetti para el último paso */}
                  {esUltimo && (
                    <>
                      <style>{`
                        @keyframes tourConfettiFall {
                          0%   { transform: translateY(-10px) rotate(0deg);    opacity: 1; }
                          80%  { opacity: 0.7; }
                          100% { transform: translateY(320px) rotate(540deg);  opacity: 0; }
                        }
                      `}</style>
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        overflow: 'hidden',
                      }}>
                        {CONFETTI_PARTICULAS.map(p => (
                          <div
                            key={p.id}
                            style={{
                              position: 'absolute',
                              top: '-10px',
                              left: `${p.left}%`,
                              width:  `${p.size}px`,
                              height: `${p.size}px`,
                              backgroundColor: p.color,
                              borderRadius: p.id % 3 === 0 ? '50%' : '2px',
                              animation: `tourConfettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
                              opacity: 0,
                            }}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  <TooltipContenido
                    paso={paso}
                    pasoActual={pasoActual}
                    total={PASOS.length}
                    nombreEmpleado={nombreCorto}
                    onSaltar={saltar}
                    onAvanzar={avanzar}
                  />
                </div>
              </motion.div>
            ) : tooltipPos ? (
              /* Tooltip flotante posicionado */
              <motion.div
                key={`tooltip-${pasoActual}`}
                initial={{
                  opacity: 0,
                  y: paso.posicion === 'top' ? 6 : -6,
                  x: paso.posicion === 'right' ? -6 : 0,
                }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{
                  opacity: 0,
                  y: paso.posicion === 'top' ? 6 : -6,
                }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                style={{
                  position: 'fixed',
                  top:     tooltipPos.top,
                  left:    tooltipPos.left,
                  zIndex:  9999,
                  width:   TOOLTIP_WIDTH,
                  ...estiloContenedor,
                  pointerEvents: 'auto',
                }}
              >
                <TooltipContenido
                  paso={paso}
                  pasoActual={pasoActual}
                  total={PASOS.length}
                  nombreEmpleado={nombreCorto}
                  onSaltar={saltar}
                  onAvanzar={avanzar}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
