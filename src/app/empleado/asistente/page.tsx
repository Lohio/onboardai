'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User, Loader2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface Mensaje {
  id: string
  rol: 'user' | 'assistant'
  contenido: string
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
// Burbuja de mensaje
// ─────────────────────────────────────────────

function BurbujaMensaje({ msg }: { msg: Mensaje }) {
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
        className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center
          ${esUsuario
            ? 'bg-indigo-600/25 border border-indigo-500/25'
            : 'bg-teal-500/15 border border-teal-500/20'
          }`}
      >
        {esUsuario
          ? <User className="w-3.5 h-3.5 text-indigo-300" />
          : <Bot className="w-3.5 h-3.5 text-teal-400" />
        }
      </div>

      {/* Burbuja */}
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${esUsuario
            ? 'bg-indigo-600/20 border border-indigo-500/20 text-white/85 rounded-tr-sm'
            : 'bg-white/[0.04] border border-white/[0.07] text-white/75 rounded-tl-sm'
          }`}
      >
        {msg.contenido}
        {msg.streaming && (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-teal-400/70 rounded-sm animate-pulse align-middle" />
        )}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Estado vacío
// ─────────────────────────────────────────────

function EstadoVacio({ nombre }: { nombre: string }) {
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

    const idUser = `msg-${Date.now()}-u`
    const idAssistant = `msg-${Date.now()}-a`

    setMensajes(prev => [
      ...prev,
      { id: idUser, rol: 'user', contenido: texto },
      { id: idAssistant, rol: 'assistant', contenido: '', streaming: true },
    ])

    try {
      const res = await fetch('/api/empleado/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: texto, conversacionId }),
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
    <div className="flex flex-col h-[calc(100dvh-3rem)]"> {/* 3rem = header del layout */}
      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/15 flex items-center justify-center">
          <Bot className="w-4 h-4 text-teal-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white/80">Asistente de onboarding</p>
          <p className="text-[11px] text-white/30">Powered by Claude</p>
        </div>
      </div>

      {/* ── Mensajes ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {mensajes.length === 0 ? (
          <EstadoVacio nombre={nombreUsuario} />
        ) : (
          <>
            {mensajes.map(msg => (
              <BurbujaMensaje key={msg.id} msg={msg} />
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
