'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, Send, Loader2, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { Portal } from '@/components/shared/Portal'
import {
  getMensajeProactivo,
  estasilenciado,
  silenciarPor24hs,
  type AgenteParams,
  type MensajeProactivo,
} from '@/lib/agenteContexto'
import type { ChatMensaje } from '@/lib/claude'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface MensajeChat {
  id: string
  rol: 'user' | 'assistant'
  contenido: string
}

type ModuloAgente = AgenteParams['modulo']

interface AgenteFlotanteProps {
  modulo: ModuloAgente | null
  diasOnboarding: number
  progresoTotal: number
  accesosPendientes: number
  moduloCompletado: boolean
  nombreEmpleado: string
  userId?: string
}

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

const MAX_MENSAJES = 20

// Sugerencias contextuales por módulo
const SUGERENCIAS: Record<string, string[]> = {
  perfil: [
    '¿Cómo completo mi perfil?',
    '¿Qué son los accesos?',
    '¿A quién contacto si tengo dudas?',
  ],
  cultura: [
    'Contame la historia de la empresa',
    '¿Cuáles son los valores?',
    '¿Cómo es el ambiente de trabajo?',
  ],
  rol: [
    '¿Cuáles son mis primeras tareas?',
    '¿Qué se espera de mí en 30 días?',
    '¿Con quién voy a trabajar?',
  ],
  asistente: [
    '¿En qué te puedo ayudar?',
    '¿Tenés alguna duda del onboarding?',
  ],
}

// Badge de módulo para el header del panel
const MODULO_LABELS: Record<string, string> = {
  perfil:    'M1 · Perfil',
  cultura:   'M2 · Cultura',
  rol:       'M3 · Rol',
  asistente: 'M4 · Asistente',
}

// CTAs que navegan a otra ruta en lugar de abrir el panel
const CTA_NAVEGACION: Record<string, string> = {
  'Ver Cultura':    '/empleado/cultura',
  'Ver mis tareas': '/empleado/rol',
  'Responder ahora': '/empleado',
}

// ─────────────────────────────────────────────
// Componentes markdown (mismo estilo que M4)
// ─────────────────────────────────────────────

const mdComponents: Components = {
  p:      ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="text-white/90 font-medium">{children}</strong>,
  ul:     ({ children }) => <ul className="list-disc pl-4 my-1.5 space-y-0.5">{children}</ul>,
  li:     ({ children }) => <li className="text-[12px] text-white/65">{children}</li>,
  h2:     ({ children }) => (
    <h2 className="text-sm font-semibold text-white/85 mt-3 mb-1 first:mt-0">{children}</h2>
  ),
  h3:     ({ children }) => (
    <h3 className="text-xs font-medium text-white/75 mt-2 mb-0.5">{children}</h3>
  ),
  table:  ({ children }) => (
    <div className="mt-2 rounded-lg overflow-hidden border border-white/[0.08] text-xs">
      <table className="w-full border-collapse">{children}</table>
    </div>
  ),
  thead:  ({ children }) => <thead>{children}</thead>,
  tbody:  ({ children }) => <tbody>{children}</tbody>,
  tr:     ({ children }) => (
    <tr className="border-b border-white/[0.04] last:border-0">{children}</tr>
  ),
  th:     ({ children }) => (
    <th className="bg-white/[0.04] text-white/45 px-3 py-1.5 text-left font-medium">{children}</th>
  ),
  td:     ({ children }) => <td className="px-3 py-1.5 text-white/65">{children}</td>,
}

// ─────────────────────────────────────────────
// Burbuja de mensaje
// ─────────────────────────────────────────────

function BurbujaMensaje({ mensaje }: { mensaje: MensajeChat }) {
  const esUser = mensaje.rol === 'user'
  return (
    <div className={cn('flex gap-2', esUser ? 'justify-end' : 'justify-start')}>
      {!esUser && (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0EA5E9] to-teal-600
          flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3 h-3 text-white" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
          esUser
            ? 'bg-[#0EA5E9] text-white rounded-tr-sm'
            : 'bg-white/[0.07] text-white/85 rounded-tl-sm border border-white/[0.06]'
        )}
      >
        {esUser ? (
          mensaje.contenido || (
            <span className="flex gap-1 items-center py-0.5">
              <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          )
        ) : mensaje.contenido ? (
          <ReactMarkdown components={mdComponents}>{mensaje.contenido}</ReactMarkdown>
        ) : (
          <span className="flex gap-1 items-center py-0.5">
            <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:300ms]" />
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export default function AgenteFlotante({
  modulo,
  diasOnboarding,
  progresoTotal,
  accesosPendientes,
  moduloCompletado,
  nombreEmpleado,
  userId,
}: AgenteFlotanteProps) {
  const router = useRouter()

  // ── Estado del panel ──────────────────────────────────────────
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<MensajeChat[]>([])
  const [inputValue, setInputValue] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [persistenciaLista, setPersistenciaLista] = useState(false)

  // ── Estado del hint proactivo ─────────────────────────────────
  const [hintVisible, setHintVisible] = useState(false)
  const [hintActivo, setHintActivo] = useState<MensajeProactivo | null>(null)
  const [hayMensajeNuevo, setHayMensajeNuevo] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Clave de localStorage ─────────────────────────────────────
  const storageKey = userId ? `agente_chat_${userId}` : null

  // ── Cargar historial desde localStorage ──────────────────────
  useEffect(() => {
    if (!storageKey) {
      setPersistenciaLista(true)
      return
    }
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as MensajeChat[]
        if (Array.isArray(parsed)) {
          setMensajes(parsed.slice(-MAX_MENSAJES))
        }
      }
    } catch {
      // ignorar errores de parse
    }
    setPersistenciaLista(true)
  }, [storageKey])

  // ── Persistir mensajes en localStorage ───────────────────────
  useEffect(() => {
    if (!storageKey || !persistenciaLista) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(mensajes.slice(-MAX_MENSAJES)))
    } catch {
      // ignorar errores de quota
    }
  }, [mensajes, storageKey, persistenciaLista])

  // ── Scroll automático al último mensaje ───────────────────────
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [mensajes])

  // ── Focus al abrir el panel ───────────────────────────────────
  useEffect(() => {
    if (panelAbierto) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [panelAbierto])

  // ── Hint proactivo: montar → esperar 2s → evaluar condiciones ─
  useEffect(() => {
    if (!modulo || panelAbierto) return

    if (hintTimer.current) clearTimeout(hintTimer.current)

    hintTimer.current = setTimeout(() => {
      if (estasilenciado()) return

      const msg = getMensajeProactivo({
        modulo,
        diasOnboarding,
        progresoTotal,
        accesosPendientes,
        moduloCompletado,
        nombreEmpleado,
      })

      if (msg) {
        setHintActivo(msg)
        setHintVisible(true)
        setHayMensajeNuevo(true)
      }
    }, 2000)

    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current)
    }
  }, [modulo, diasOnboarding, progresoTotal, accesosPendientes, moduloCompletado, nombreEmpleado, panelAbierto])

  // ── Ocultar dot verde al abrir el panel ──────────────────────
  useEffect(() => {
    if (panelAbierto) setHayMensajeNuevo(false)
  }, [panelAbierto])

  // ── Enviar mensaje al agente ──────────────────────────────────
  const enviarMensaje = useCallback(async (texto: string) => {
    const textoLimpio = texto.trim()
    if (!textoLimpio || enviando) return

    const idUser      = `u-${Date.now()}`
    const idAssistant = `a-${Date.now() + 1}`

    const nuevoUser:      MensajeChat = { id: idUser,      rol: 'user',      contenido: textoLimpio }
    const nuevoAssistant: MensajeChat = { id: idAssistant, rol: 'assistant', contenido: '' }

    setMensajes(prev => [...prev, nuevoUser, nuevoAssistant].slice(-MAX_MENSAJES))
    setInputValue('')
    setEnviando(true)

    try {
      // Construir historial previo (sin el mensaje recién agregado)
      const historialPrevio: ChatMensaje[] = mensajes.map(m => ({
        role: m.rol as 'user' | 'assistant',
        content: m.contenido,
      }))

      const contextoStr = [
        diasOnboarding ? `El empleado lleva ${diasOnboarding} días de onboarding.` : '',
        progresoTotal !== undefined ? `Progreso general: ${progresoTotal}%.` : '',
        accesosPendientes > 0 ? `Tiene ${accesosPendientes} acceso(s) pendiente(s).` : '',
      ].filter(Boolean).join(' ')

      const res = await fetch('/api/empleado/agente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: textoLimpio,
          modulo: modulo ?? undefined,
          contexto: contextoStr,
          historial: historialPrevio,
        }),
      })

      if (!res.ok || !res.body) throw new Error('Error en la respuesta del agente')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let respuesta = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        respuesta += decoder.decode(value, { stream: true })
        setMensajes(prev =>
          prev.map(m => m.id === idAssistant ? { ...m, contenido: respuesta } : m)
        )
      }
    } catch {
      setMensajes(prev =>
        prev.map(m =>
          m.id === idAssistant
            ? { ...m, contenido: 'No pude conectar con el asistente. Intentá de nuevo.' }
            : m
        )
      )
    } finally {
      setEnviando(false)
    }
  }, [enviando, mensajes, modulo, diasOnboarding, progresoTotal, accesosPendientes])

  // ── Manejar CTA primario del hint ─────────────────────────────
  const handleCtaPrimario = useCallback((cta: string) => {
    setHintVisible(false)
    setHintActivo(null)

    const ruta = CTA_NAVEGACION[cta]
    if (ruta) {
      router.push(ruta)
      return
    }

    // Para CTAs conversacionales: abrir panel y auto-enviar
    setPanelAbierto(true)
    if (cta !== 'Hacer una pregunta') {
      // Mensaje contextual genérico para CTAs sin texto fijo
      const mensajeAuto = cta === 'Sí, empecemos'
        ? '¡Hola! Acabo de empezar, ¿por dónde arranco?'
        : cta === 'Empezar ahora'
        ? '¡Hola! Quiero empezar con el módulo de Cultura. ¿Por dónde arranco?'
        : cta === 'Continuar'
        ? 'Quiero continuar con el módulo actual. ¿Qué me falta completar?'
        : null

      if (mensajeAuto) {
        setTimeout(() => enviarMensaje(mensajeAuto), 300)
      }
    }
  }, [router, enviarMensaje])

  // ── Manejar CTA secundario del hint ──────────────────────────
  const handleCtaSecundario = useCallback((cta: string) => {
    setHintVisible(false)
    setHintActivo(null)

    const silenciar = ['Recordarme mañana', 'Más tarde', 'Lo hago después', 'Ahora no']
    if (silenciar.includes(cta)) {
      silenciarPor24hs()
    }
    // '¡Gracias!', 'Entendido' → solo cerrar
  }, [])

  // ── Submit con Enter (sin Shift) ──────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensaje(inputValue)
    }
  }

  const sugerencias   = modulo ? (SUGERENCIAS[modulo] ?? []) : []
  const moduloBadge   = modulo ? MODULO_LABELS[modulo] : null

  return (
    <Portal>

      {/* ── Hint proactivo ─────────────────────────────────────── */}
      <AnimatePresence>
        {hintVisible && hintActivo && !panelAbierto && (
          <motion.div
            key="hint"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 8,  scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="fixed bottom-[88px] right-4 z-50 w-72"
            style={{ transformOrigin: 'bottom right' }}
          >
            <div
              className="relative rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
              style={{
                background: '#111110',
                border: '0.5px solid rgba(255,255,255,0.12)',
              }}
            >
              {/* Flecha decorativa hacia el botón flotante */}
              <div
                className="absolute bottom-[-6px] right-5 w-3 h-3 rotate-45"
                style={{
                  background: '#111110',
                  border: '0.5px solid rgba(255,255,255,0.12)',
                  borderTop: 'none',
                  borderLeft: 'none',
                }}
              />

              {/* Botón X para cerrar sin silenciar */}
              <button
                onClick={() => { setHintVisible(false); setHintActivo(null) }}
                className="absolute top-2.5 right-2.5 w-5 h-5 rounded-md flex items-center justify-center
                  text-white/30 hover:text-white/60 hover:bg-white/[0.06]
                  transition-colors duration-150 cursor-pointer"
                aria-label="Cerrar sugerencia"
              >
                <X className="w-3 h-3" />
              </button>

              <p className="text-sm text-white/80 leading-relaxed mb-3 pr-5">
                {hintActivo.mensaje}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCtaPrimario(hintActivo.ctaPrimario)}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium
                    bg-[#0EA5E9] hover:bg-[#38BDF8] text-white
                    transition-colors duration-150 cursor-pointer"
                >
                  {hintActivo.ctaPrimario}
                </button>
                <button
                  onClick={() => handleCtaSecundario(hintActivo.ctaSecundario)}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium
                    bg-white/[0.07] hover:bg-white/[0.12] text-white/60
                    border border-white/[0.08] transition-colors duration-150 cursor-pointer"
                >
                  {hintActivo.ctaSecundario}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Panel de chat ──────────────────────────────────────── */}
      <AnimatePresence>
        {panelAbierto && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1,   y: 0  }}
            exit={{    opacity: 0, scale: 0.9, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed bottom-[80px] right-4 z-50 flex flex-col
              w-[calc(100vw-32px)] sm:w-80 max-h-[500px]"
            style={{
              transformOrigin: 'bottom right',
              background: '#111110',
              border: '0.5px solid rgba(255,255,255,0.12)',
              borderRadius: '16px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* ── Header ── */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07] flex-shrink-0">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0EA5E9] to-teal-600
                  flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                {/* Dot verde animado "En línea" */}
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-teal-400 rounded-full
                  border-2 border-[#111e38] animate-pulse" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-white/90 leading-none">Asistente</p>
                  {/* Badge del módulo actual */}
                  {moduloBadge && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md
                      bg-[#0EA5E9]/15 text-[#38BDF8]/80 border border-[#0EA5E9]/20 leading-none">
                      {moduloBadge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-teal-400/70 mt-0.5">En línea</p>
              </div>

              {/* Ir al historial completo */}
              <button
                onClick={() => { setPanelAbierto(false); router.push('/empleado/asistente') }}
                className="w-7 h-7 rounded-lg flex items-center justify-center
                  text-white/30 hover:text-white/60 hover:bg-white/[0.07]
                  transition-colors duration-150 cursor-pointer flex-shrink-0"
                aria-label="Ver historial completo"
                title="Ver historial completo"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              {/* Cerrar panel */}
              <button
                onClick={() => setPanelAbierto(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center
                  text-white/35 hover:text-white/70 hover:bg-white/[0.07]
                  transition-colors duration-150 cursor-pointer flex-shrink-0"
                aria-label="Cerrar chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Mensajes ── */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0"
            >
              {mensajes.length === 0 ? (
                /* Estado vacío con sugerencias contextuales */
                <div className="flex flex-col items-center justify-center h-full py-6 gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0EA5E9]/30 to-teal-600/30
                    flex items-center justify-center border border-[#0EA5E9]/20">
                    <Bot className="w-5 h-5 text-[#38BDF8]" />
                  </div>
                  <p className="text-xs text-white/35 text-center leading-relaxed max-w-[200px]">
                    Hola, soy tu guía de onboarding. ¿En qué te puedo ayudar?
                  </p>

                  {/* Chips de sugerencias */}
                  {sugerencias.length > 0 && (
                    <div className="w-full flex flex-col gap-1.5 mt-1">
                      {sugerencias.map(s => (
                        <button
                          key={s}
                          onClick={() => enviarMensaje(s)}
                          className="w-full text-left text-xs text-teal-400/75
                            px-3 py-2 rounded-lg cursor-pointer
                            bg-teal-500/[0.07] border border-teal-500/20
                            hover:bg-teal-500/15 transition-colors duration-150
                            leading-snug"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                mensajes.map(m => <BurbujaMensaje key={m.id} mensaje={m} />)
              )}
            </div>

            {/* ── Input ── */}
            <div className="flex-shrink-0 border-t border-white/[0.07] p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribí tu pregunta..."
                  rows={1}
                  disabled={enviando}
                  className="flex-1 resize-none bg-white/[0.06] border border-white/[0.08]
                    rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25
                    focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/40 focus:border-[#0EA5E9]/40
                    transition-all duration-150 max-h-24 leading-relaxed disabled:opacity-50"
                  style={{ scrollbarWidth: 'none' }}
                />
                <button
                  onClick={() => enviarMensaje(inputValue)}
                  disabled={!inputValue.trim() || enviando}
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
                    bg-[#0EA5E9] hover:bg-[#38BDF8]
                    disabled:opacity-40 disabled:cursor-not-allowed
                    transition-colors duration-150 cursor-pointer"
                  aria-label="Enviar mensaje"
                >
                  {enviando
                    ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    : <Send className="w-3.5 h-3.5 text-white" />
                  }
                </button>
              </div>
            </div>

            {/* ── Link al historial completo ── */}
            <button
              onClick={() => { setPanelAbierto(false); router.push('/empleado/asistente') }}
              className="flex-shrink-0 border-t border-white/[0.05] py-2 text-center
                text-[10px] text-white/25 hover:text-white/45
                transition-colors duration-150 cursor-pointer w-full"
            >
              Ver historial completo →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Botón flotante ─────────────────────────────────────── */}
      <motion.button
        id="tour-agente-btn"
        onClick={() => {
          setPanelAbierto(prev => !prev)
          setHintVisible(false)
          setHintActivo(null)
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full
          flex items-center justify-center cursor-pointer border-2 border-white/20"
        style={{
          background: 'linear-gradient(135deg, #0EA5E9 0%, #0D9488 100%)',
          boxShadow: '0 4px 20px rgba(14,165,233,0.4)',
        }}
        aria-label={panelAbierto ? 'Cerrar asistente' : 'Abrir asistente'}
      >
        <Bot className="w-5 h-5 text-white" />

        {/* Dot verde: hay hint o hay mensajes nuevos */}
        <AnimatePresence>
          {(hayMensajeNuevo || hintVisible) && !panelAbierto && (
            <motion.span
              key="dot"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-teal-400 rounded-full
                border-2 border-[#111110] animate-pulse"
            />
          )}
        </AnimatePresence>
      </motion.button>

    </Portal>
  )
}
