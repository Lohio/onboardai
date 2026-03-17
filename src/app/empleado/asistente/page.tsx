'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Send, Bot, Loader2, AlertTriangle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { createClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface Mensaje {
  id: string
  rol: 'user' | 'assistant'
  contenido: string
  timestamp: string
  streaming?: boolean
}

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────

const msgVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
  },
}

// ─────────────────────────────────────────────
// Componentes markdown del asistente
// ─────────────────────────────────────────────

const mdComponents: Components = {
  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="text-white/90 font-medium">{children}</strong>,
  ul: ({ children }) => <ul className="list-disc pl-4 my-1.5 space-y-0.5">{children}</ul>,
  li: ({ children }) => <li className="text-[12px] text-white/65">{children}</li>,
  h2: ({ children }) => (
    <h2 className="text-sm font-semibold text-white/85 mt-3 mb-1 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs font-medium text-white/75 mt-2 mb-0.5">{children}</h3>
  ),
  table: ({ children }) => (
    <div className="mt-2 rounded-lg overflow-hidden border border-white/[0.08] text-xs">
      <table className="w-full border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-white/[0.04] last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="bg-white/[0.04] text-white/45 px-3 py-1.5 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-white/65">
      {children}
    </td>
  ),
}

// ─────────────────────────────────────────────
// Burbuja de mensaje
// ─────────────────────────────────────────────

function BurbujaMensaje({ msg, initials }: { msg: Mensaje; initials: string }) {
  const esUsuario = msg.rol === 'user'

  return (
    <motion.div
      variants={msgVariants}
      initial="hidden"
      animate="show"
      className={`flex gap-3 ${esUsuario ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center self-end mb-5
          ${esUsuario
            ? 'bg-indigo-600/20 border border-indigo-500/30'
            : 'bg-teal-500/15 border border-teal-500/20'
          }`}
      >
        {esUsuario
          ? <span className="text-[10px] font-semibold text-indigo-300">{initials}</span>
          : <Bot className="w-3.5 h-3.5 text-teal-400" />
        }
      </div>

      {/* Contenido: burbuja + timestamp */}
      <div className={`flex flex-col max-w-[78%] ${esUsuario ? 'items-end' : 'items-start'}`}>
        {/* Burbuja */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed
            ${esUsuario
              ? 'bg-[#1e2e6e] border border-indigo-500/40 text-white/88 rounded-tr-sm'
              : 'bg-white/[0.04] border border-white/[0.08] text-white/78 rounded-tl-sm'
            }`}
        >
          {esUsuario ? (
            // Mensajes del usuario: texto plano
            <span>{msg.contenido}</span>
          ) : (
            // Respuestas del asistente: markdown con componentes tipados
            <ReactMarkdown components={mdComponents}>
              {msg.contenido}
            </ReactMarkdown>
          )}
          {msg.streaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-teal-400/70 rounded-sm animate-pulse align-middle" />
          )}
        </div>

        {/* Timestamp */}
        <p className={`text-[10px] text-white/20 mt-1 px-1 ${esUsuario ? 'text-right' : 'text-left'}`}>
          {msg.timestamp}
        </p>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Estado vacío
// ─────────────────────────────────────────────

function EstadoVacio({ nombre, onSugerencia }: { nombre: string; onSugerencia: (texto: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
      <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/15 flex items-center justify-center">
        <Bot className="w-7 h-7 text-teal-400/70" />
      </div>
      <div className="text-center space-y-1 max-w-sm">
        <p className="text-sm font-medium text-white/60">
          Hola{nombre ? `, ${nombre.split(' ')[0]}` : ''}! Soy tu asistente de onboarding.
        </p>
        <p className="text-xs text-white/30">
          Preguntame sobre la empresa, tus tareas, procesos o cualquier duda que tengas.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
        {[
          '¿Cuál es la misión de la empresa?',
          '¿Cuáles son mis primeras tareas?',
          '¿Cómo funciona el proceso de trabajo?',
          '¿Qué herramientas voy a usar?',
        ].map(sugerencia => (
          <button
            key={sugerencia}
            onClick={() => onSugerencia(sugerencia)}
            className="text-[11px] text-white/40 border border-white/[0.07] rounded-lg px-3 py-2
              hover:border-teal-500/30 hover:text-teal-400/70 hover:bg-teal-500/5
              transition-colors duration-150 text-left"
          >
            {sugerencia}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function AsistentePage() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [conversacionId, setConversacionId] = useState<string | null>(null)
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [errorRed, setErrorRed] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Iniciales del usuario para el avatar
  const initials = nombreUsuario
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'TU'

  // ── Cancelar stream al desmontar ──
  useEffect(() => {
    return () => { abortControllerRef.current?.abort() }
  }, [])

  // ── Cargar nombre del usuario ──
  const cargarUsuario = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('usuarios')
      .select('nombre')
      .eq('id', user.id)
      .single()
    setNombreUsuario(data?.nombre ?? '')
  }, [])

  useEffect(() => {
    cargarUsuario()
  }, [cargarUsuario])

  // ── Auto-scroll al último mensaje ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  // ── Ajustar altura del textarea ──
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  // ── Enviar mensaje ──
  const enviar = async (textoOverride?: string) => {
    const texto = (textoOverride ?? input).trim()
    if (!texto || enviando) return

    setInput('')
    setErrorRed(false)
    setEnviando(true)

    const ahora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    const idUser = `msg-${Date.now()}-u`
    const idAssistant = `msg-${Date.now()}-a`

    setMensajes(prev => [
      ...prev,
      { id: idUser, rol: 'user', contenido: texto, timestamp: ahora },
      { id: idAssistant, rol: 'assistant', contenido: '', timestamp: ahora, streaming: true },
    ])

    try {
      // Cancelar request anterior si aún está en curso
      if (abortControllerRef.current) abortControllerRef.current.abort()
      abortControllerRef.current = new AbortController()

      const res = await fetch('/api/empleado/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: texto, conversacionId }),
        signal: abortControllerRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error('Error en la respuesta')

      // Leer conversacionId del header (el servidor lo envía en X-Conversation-Id)
      const convIdHeader = res.headers.get('X-Conversation-Id')
      if (convIdHeader) setConversacionId(convIdHeader)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })

        // Filtrar el separador legacy |--| por compatibilidad (ya no debería llegar)
        if (chunk.includes('|--|')) {
          acumulado += chunk.split('|--|')[0]
        } else {
          acumulado += chunk
        }

        const contenidoActual = acumulado
        setMensajes(prev =>
          prev.map(m =>
            m.id === idAssistant
              ? { ...m, contenido: contenidoActual, streaming: true }
              : m
          )
        )
      }

      // Finalizar streaming
      setMensajes(prev =>
        prev.map(m =>
          m.id === idAssistant ? { ...m, streaming: false } : m
        )
      )
    } catch (err) {
      // AbortError es intencional (navegación o nuevo mensaje) — no mostrar error al usuario
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Error en chat:', err)
      setErrorRed(true)
      setMensajes(prev => prev.filter(m => m.id !== idAssistant))
    } finally {
      setEnviando(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0"> {/* h-full toma el flex-1 del layout */}
      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/15 flex items-center justify-center">
          <Bot className="w-4 h-4 text-teal-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white/80">Asistente de onboarding</p>
          <p className="text-[11px] text-white/30">Powered by Claude</p>
        </div>
        {/* Dot de estado activo */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(13,148,136,0.7)] animate-pulse" />
          <span className="text-[10px] text-white/30">Activo</span>
        </div>
      </div>

      {/* ── Mensajes ── */}
      <div
        className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        {mensajes.length === 0 ? (
          <EstadoVacio nombre={nombreUsuario} onSugerencia={enviar} />
        ) : (
          <>
            {mensajes.map(msg => (
              <BurbujaMensaje key={msg.id} msg={msg} initials={initials} />
            ))}
            {errorRed && (
              <motion.div
                variants={msgVariants}
                initial="hidden"
                animate="show"
                className="flex items-center gap-2 text-xs text-red-400/70 px-1"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                No se pudo enviar. Intentá de nuevo.
              </motion.div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="flex-shrink-0 border-t border-white/[0.06] p-3">
        <div className="flex items-end gap-2 glass-card rounded-xl px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu pregunta..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/25
              resize-none outline-none py-1.5 leading-relaxed max-h-[120px]"
          />
          <button
            onClick={() => enviar()}
            disabled={!input.trim() || enviando}
            className="w-8 h-8 rounded-lg bg-indigo-600/80 hover:bg-indigo-600
              disabled:opacity-30 disabled:cursor-not-allowed
              flex items-center justify-center flex-shrink-0
              transition-colors duration-150 mb-0.5"
          >
            {enviando
              ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              : <Send className="w-3.5 h-3.5 text-white" />
            }
          </button>
        </div>
        <p className="text-[10px] text-white/20 text-center mt-1.5">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  )
}
