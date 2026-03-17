'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Wrench, AlertTriangle, Plus, Edit3, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Portal } from '@/components/shared/Portal'
import type { ContenidoBloque } from '@/types'

// ─────────────────────────────────────────────
// Constantes: módulos y bloques del producto
// ─────────────────────────────────────────────

const MODULOS = [
  {
    key: 'cultura',
    label: 'Cultura e Identidad',
    icon: <BookOpen className="w-4 h-4" />,
    bloques: [
      { key: 'historia', label: 'Historia de la empresa' },
      { key: 'mision', label: 'Misión, visión y valores' },
      { key: 'como_trabajamos', label: 'Cómo trabajamos' },
      { key: 'expectativas', label: 'Expectativas' },
      { key: 'hitos', label: 'Hitos y logros' },
    ],
  },
  {
    key: 'rol',
    label: 'Rol y Herramientas',
    icon: <Wrench className="w-4 h-4" />,
    bloques: [
      { key: 'puesto', label: 'Descripción del puesto' },
      { key: 'autonomia', label: 'Tabla de autonomía' },
    ],
  },
]

// Lista plana de todos los bloques para el select
const TODOS_LOS_BLOQUES = MODULOS.flatMap(m =>
  m.bloques.map(b => ({ modulo: m.key, bloque: b.key, label: `${m.label} — ${b.label}` }))
)

// ─────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────

interface AlertaRow {
  id: string
  pregunta: string
  usuario_id: string
  created_at: string
  usuarios: { nombre: string }[] | null
}

type EstadoBloque = 'vacio' | 'parcial' | 'completo'

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function estadoBloque(contenido?: ContenidoBloque): EstadoBloque {
  if (!contenido) return 'vacio'
  if (contenido.contenido.length < 100) return 'parcial'
  return 'completo'
}

function tiempoRelativo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutos = Math.floor(diffMs / 60000)
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas}h`
  return `hace ${Math.floor(horas / 24)}d`
}

// ─────────────────────────────────────────────
// Mini Markdown Preview (sin librerías externas)
// ─────────────────────────────────────────────

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={i} className="text-white/90 font-semibold">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <em key={i} className="text-white/70">{part.slice(1, -1)}</em>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function MiniMarkdownPreview({ text }: { text: string }) {
  if (!text.trim()) {
    return <p className="text-white/25 text-sm italic">El preview aparecerá aquí...</p>
  }

  const lines = text.split('\n')
  const elementos: React.ReactNode[] = []
  let listBuffer: React.ReactNode[] = []

  const flushList = (key: string) => {
    if (listBuffer.length > 0) {
      elementos.push(
        <ul key={key} className="list-disc ml-4 space-y-0.5 text-sm text-white/65">
          {listBuffer}
        </ul>
      )
      listBuffer = []
    }
  }

  lines.forEach((line, i) => {
    if (line.startsWith('# ')) {
      flushList(`list-${i}`)
      elementos.push(<h2 key={i} className="text-base font-bold text-white/90 mt-3 mb-1 first:mt-0">{formatInline(line.slice(2))}</h2>)
    } else if (line.startsWith('## ')) {
      flushList(`list-${i}`)
      elementos.push(<h3 key={i} className="text-sm font-semibold text-white/80 mt-3 mb-1 first:mt-0">{formatInline(line.slice(3))}</h3>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listBuffer.push(<li key={i}>{formatInline(line.slice(2))}</li>)
    } else if (line.trim() === '') {
      flushList(`list-${i}`)
      elementos.push(<br key={i} />)
    } else {
      flushList(`list-${i}`)
      elementos.push(<p key={i} className="text-sm text-white/65 leading-relaxed">{formatInline(line)}</p>)
    }
  })

  flushList('final')

  return <div className="space-y-1">{elementos}</div>
}

// ─────────────────────────────────────────────
// Indicador de estado del bloque
// ─────────────────────────────────────────────

function EstadoDot({ estado }: { estado: EstadoBloque }) {
  if (estado === 'completo') return <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
  if (estado === 'parcial') return <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
  return <span className="w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function ConocimientoPage() {
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [alertas, setAlertas] = useState<AlertaRow[]>([])
  const [conocimientoMap, setConocimientoMap] = useState<Record<string, ContenidoBloque>>({})

  // Modal contenido: agregar/editar un bloque
  const [modalContenido, setModalContenido] = useState<{
    modulo: string
    bloque: string
    label: string
  } | null>(null)
  const [editTitulo, setEditTitulo] = useState('')
  const [editContenido, setEditContenido] = useState('')

  // Modal alerta: responder pregunta sin respuesta
  const [alertaActiva, setAlertaActiva] = useState<AlertaRow | null>(null)
  const [alertaBloqueKey, setAlertaBloqueKey] = useState('')
  const [alertaContenido, setAlertaContenido] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [guardadoFeedback, setGuardadoFeedback] = useState(false)

  // ── Carga de datos ──
  const cargarDatos = useCallback(async (empId: string) => {
    const supabase = createClient()

    const [alertasRes, conocimientoRes] = await Promise.all([
      supabase
        .from('alertas_conocimiento')
        .select('id, pregunta, usuario_id, created_at, usuarios(nombre)')
        .eq('empresa_id', empId)
        .eq('resuelta', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('conocimiento')
        .select('*')
        .eq('empresa_id', empId),
    ])

    setAlertas((alertasRes.data ?? []) as AlertaRow[])

    const mapa: Record<string, ContenidoBloque> = {}
    for (const item of conocimientoRes.data ?? []) {
      mapa[`${item.modulo}-${item.bloque}`] = item as ContenidoBloque
    }
    setConocimientoMap(mapa)
  }, [])

  // ── Inicialización ──
  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data: adminData } = await supabase
          .from('usuarios')
          .select('empresa_id')
          .eq('id', user.id)
          .single()

        if (!adminData?.empresa_id) return

        setEmpresaId(adminData.empresa_id)
        await cargarDatos(adminData.empresa_id)
      } catch (err) {
        console.error('Error cargando conocimiento:', err)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [cargarDatos])

  // ── Abrir modal contenido ──
  const abrirModalContenido = (modulo: string, bloque: string, label: string) => {
    const existing = conocimientoMap[`${modulo}-${bloque}`]
    setEditTitulo(existing?.titulo ?? label)
    setEditContenido(existing?.contenido ?? '')
    setModalContenido({ modulo, bloque, label })
  }

  // ── Guardar contenido ──
  const guardarContenido = async () => {
    if (!empresaId || !modalContenido || !editContenido.trim()) return
    setGuardando(true)

    try {
      const supabase = createClient()
      const key = `${modalContenido.modulo}-${modalContenido.bloque}`
      const existing = conocimientoMap[key]

      let savedRow: ContenidoBloque

      if (existing) {
        await supabase
          .from('conocimiento')
          .update({ titulo: editTitulo, contenido: editContenido })
          .eq('id', existing.id)
        savedRow = { ...existing, titulo: editTitulo, contenido: editContenido }
      } else {
        const { data } = await supabase
          .from('conocimiento')
          .insert({
            empresa_id: empresaId,
            modulo: modalContenido.modulo,
            bloque: modalContenido.bloque,
            titulo: editTitulo,
            contenido: editContenido,
          })
          .select()
          .single()
        savedRow = data as ContenidoBloque
      }

      setConocimientoMap(prev => ({ ...prev, [key]: savedRow }))
      setGuardadoFeedback(true)
      setTimeout(() => {
        setGuardadoFeedback(false)
        setModalContenido(null)
      }, 800)
    } catch (err) {
      console.error('Error guardando conocimiento:', err)
    } finally {
      setGuardando(false)
    }
  }

  // ── Guardar respuesta a alerta ──
  const guardarRespuestaAlerta = async () => {
    if (!empresaId || !alertaActiva || !alertaBloqueKey || !alertaContenido.trim()) return
    setGuardando(true)

    try {
      const supabase = createClient()
      const [modulo, bloque] = alertaBloqueKey.split('-')
      const key = alertaBloqueKey
      const existing = conocimientoMap[key]
      const bloqueLabel =
        TODOS_LOS_BLOQUES.find(b => `${b.modulo}-${b.bloque}` === key)?.label.split(' — ')[1] ?? bloque

      const nuevoContenido = existing
        ? `${existing.contenido}\n\n---\n\n${alertaContenido}`
        : alertaContenido

      let savedRow: ContenidoBloque

      if (existing) {
        await supabase
          .from('conocimiento')
          .update({ contenido: nuevoContenido })
          .eq('id', existing.id)
        savedRow = { ...existing, contenido: nuevoContenido }
      } else {
        const { data } = await supabase
          .from('conocimiento')
          .insert({
            empresa_id: empresaId,
            modulo,
            bloque,
            titulo: bloqueLabel,
            contenido: nuevoContenido,
          })
          .select()
          .single()
        savedRow = data as ContenidoBloque
      }

      // Marcar alerta como resuelta
      await supabase
        .from('alertas_conocimiento')
        .update({ resuelta: true })
        .eq('id', alertaActiva.id)

      // Actualizar estado local
      setAlertas(prev => prev.filter(a => a.id !== alertaActiva.id))
      setConocimientoMap(prev => ({ ...prev, [key]: savedRow }))

      setAlertaActiva(null)
      setAlertaBloqueKey('')
      setAlertaContenido('')
    } catch (err) {
      console.error('Error guardando respuesta:', err)
    } finally {
      setGuardando(false)
    }
  }

  // ─────────────────────────────────────────────
  // Loading skeleton
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="shimmer rounded-xl h-24" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="shimmer rounded-xl h-48" />
          <div className="shimmer rounded-xl h-48" />
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────
  // Render principal
  // ─────────────────────────────────────────────

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-5xl mx-auto space-y-6"
      >
        {/* ── Alertas de conocimiento faltante ── */}
        {alertas.length > 0 && (
          <motion.div variants={cardVariants} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-medium text-white/80">
                Alertas de conocimiento faltante
              </h2>
              <span className="ml-auto text-[11px] font-mono text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                {alertas.length} sin resolver
              </span>
            </div>

            <div className="space-y-2">
              {alertas.map(alerta => (
                <motion.div
                  key={alerta.id}
                  layout
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="flex items-start gap-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/15 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/75 leading-snug line-clamp-2">
                      &ldquo;{alerta.pregunta}&rdquo;
                    </p>
                    <p className="text-[11px] text-white/35 mt-1">
                      {alerta.usuarios?.[0]?.nombre ?? 'Empleado'} · {tiempoRelativo(alerta.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setAlertaActiva(alerta)
                      setAlertaBloqueKey('')
                      setAlertaContenido('')
                    }}
                    className="flex-shrink-0 text-xs font-medium text-amber-400/80 hover:text-amber-300
                      border border-amber-500/25 hover:border-amber-400/40
                      px-2.5 py-1.5 rounded-lg transition-colors duration-150 whitespace-nowrap"
                  >
                    Responder
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Módulos de conocimiento ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {MODULOS.map(modulo => (
            <motion.div key={modulo.key} variants={cardVariants} className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-white/35">{modulo.icon}</span>
                <h2 className="text-sm font-medium text-white/80">{modulo.label}</h2>
              </div>

              <div className="space-y-1.5">
                {modulo.bloques.map(bloque => {
                  const key = `${modulo.key}-${bloque.key}`
                  const contenido = conocimientoMap[key]
                  const estado = estadoBloque(contenido)

                  return (
                    <div
                      key={bloque.key}
                      className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0"
                    >
                      <EstadoDot estado={estado} />
                      <span className="flex-1 text-sm text-white/65 truncate">{bloque.label}</span>
                      {contenido && (
                        <span className="text-[10px] text-white/25 font-mono mr-2">
                          {contenido.contenido.length} chars
                        </span>
                      )}
                      <button
                        onClick={() => abrirModalContenido(modulo.key, bloque.key, bloque.label)}
                        className={cn(
                          'flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md',
                          'transition-colors duration-150',
                          estado === 'vacio'
                            ? 'text-indigo-400/80 hover:text-indigo-300 border border-indigo-500/25 hover:border-indigo-400/40'
                            : 'text-white/35 hover:text-white/70 border border-white/[0.08] hover:border-white/[0.15]'
                        )}
                      >
                        {estado === 'vacio' ? (
                          <><Plus className="w-3 h-3" /> Agregar</>
                        ) : (
                          <><Edit3 className="w-3 h-3" /> Editar</>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════
          Modal: Editar/Agregar contenido
      ═══════════════════════════════════════ */}
      <Portal>
      <AnimatePresence>
        {modalContenido && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/70 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => !guardando && setModalContenido(null)}
            />

            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <div
                className="glass-card rounded-xl w-full max-w-3xl flex flex-col"
                style={{ maxHeight: 'min(85vh, 680px)' }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/[0.06] flex-shrink-0">
                  <div>
                    <p className="text-[11px] text-white/35 uppercase tracking-widest">
                      {conocimientoMap[`${modalContenido.modulo}-${modalContenido.bloque}`]
                        ? 'Editar contenido'
                        : 'Agregar contenido'}
                    </p>
                    <h3 className="text-sm font-medium text-white mt-0.5">{modalContenido.label}</h3>
                  </div>
                  <button
                    onClick={() => !guardando && setModalContenido(null)}
                    className="text-white/30 hover:text-white/70 transition-colors duration-150 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body: split editor / preview */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 sm:grid-cols-2 min-h-0">
                  {/* Editor */}
                  <div className="flex flex-col gap-3 p-4 border-r border-white/[0.06] min-h-0">
                    <div>
                      <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">
                        Título
                      </label>
                      <input
                        value={editTitulo}
                        onChange={e => setEditTitulo(e.target.value)}
                        className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2
                          text-white outline-none focus:border-indigo-500/40 transition-colors"
                        placeholder="Título de la sección"
                      />
                    </div>
                    <div className="flex-1 flex flex-col min-h-0">
                      <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">
                        Contenido (Markdown)
                      </label>
                      <textarea
                        value={editContenido}
                        onChange={e => setEditContenido(e.target.value)}
                        className="flex-1 w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg
                          px-3 py-2 text-white/80 outline-none focus:border-indigo-500/40
                          resize-none font-mono transition-colors placeholder:text-white/20"
                        placeholder={'# Título\n\nEscribí el contenido acá...\n\n**negrita** *itálica*\n- lista'}
                        style={{ minHeight: '200px' }}
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="hidden sm:flex flex-col p-4 overflow-y-auto min-h-0">
                    <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-2 flex-shrink-0">
                      Preview
                    </label>
                    <MiniMarkdownPreview text={editContenido} />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-white/[0.06] flex-shrink-0">
                  <button
                    onClick={() => !guardando && setModalContenido(null)}
                    className="text-sm text-white/40 hover:text-white/70 px-4 py-2 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarContenido}
                    disabled={guardando || !editContenido.trim()}
                    className={cn(
                      'flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-lg transition-all duration-150',
                      'bg-indigo-600 hover:bg-indigo-500 text-white',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {guardadoFeedback ? (
                      <><Check className="w-3.5 h-3.5 text-teal-300" /> Guardado</>
                    ) : guardando ? (
                      <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" /> Guardando...</>
                    ) : (
                      'Guardar'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </Portal>

      {/* ═══════════════════════════════════════
          Modal: Responder alerta
      ═══════════════════════════════════════ */}
      <Portal>
      <AnimatePresence>
        {alertaActiva && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/70 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => !guardando && setAlertaActiva(null)}
            />

            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <div
                className="glass-card rounded-xl w-full max-w-2xl flex flex-col"
                style={{ maxHeight: 'min(85vh, 640px)' }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="p-4 border-b border-white/[0.06] flex-shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] text-amber-400/70 uppercase tracking-widest mb-1">
                        Pregunta sin respuesta
                      </p>
                      <p className="text-sm text-white/80 leading-snug">
                        &ldquo;{alertaActiva.pregunta}&rdquo;
                      </p>
                      <p className="text-[11px] text-white/30 mt-1">
                        {alertaActiva.usuarios?.[0]?.nombre ?? 'Empleado'} · {tiempoRelativo(alertaActiva.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => !guardando && setAlertaActiva(null)}
                      className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
                  {/* Selector de bloque */}
                  <div>
                    <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1.5">
                      ¿A qué sección pertenece esta respuesta?
                    </label>
                    <select
                      value={alertaBloqueKey}
                      onChange={e => setAlertaBloqueKey(e.target.value)}
                      className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5
                        text-white outline-none focus:border-indigo-500/40 transition-colors"
                    >
                      <option value="" disabled className="bg-[#0f1f3d]">
                        Seleccioná una sección...
                      </option>
                      {TODOS_LOS_BLOQUES.map(b => (
                        <option key={`${b.modulo}-${b.bloque}`} value={`${b.modulo}-${b.bloque}`} className="bg-[#0f1f3d]">
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Textarea */}
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[10px] text-white/30 uppercase tracking-widest">
                      Contenido a agregar (Markdown)
                    </label>
                    <textarea
                      value={alertaContenido}
                      onChange={e => setAlertaContenido(e.target.value)}
                      className="w-full text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg
                        px-3 py-2 text-white/80 outline-none focus:border-indigo-500/40
                        resize-none font-mono transition-colors placeholder:text-white/20"
                      placeholder="Escribí la respuesta aquí..."
                      rows={6}
                    />
                    <p className="text-[10px] text-white/25">
                      {alertaBloqueKey && conocimientoMap[alertaBloqueKey]
                        ? 'Este contenido se agregará al final de la sección existente.'
                        : alertaBloqueKey
                        ? 'Se creará una nueva sección con este contenido.'
                        : ''}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-white/[0.06] flex-shrink-0">
                  <button
                    onClick={() => !guardando && setAlertaActiva(null)}
                    className="text-sm text-white/40 hover:text-white/70 px-4 py-2 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarRespuestaAlerta}
                    disabled={guardando || !alertaBloqueKey || !alertaContenido.trim()}
                    className={cn(
                      'flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-lg transition-all duration-150',
                      'bg-amber-600 hover:bg-amber-500 text-white',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {guardando ? (
                      <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin-fast" /> Guardando...</>
                    ) : (
                      'Agregar al conocimiento'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </Portal>
    </>
  )
}
