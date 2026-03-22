'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  GripVertical,
  Edit3,
  Trash2,
  User,
  BookOpen,
  Wrench,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { BloqueContenidoForm } from '@/components/admin/BloqueContenidoForm'
import { EliminarBloqueModal } from '@/components/admin/EliminarBloqueModal'
import toast from 'react-hot-toast'
import type { BloqueContenido } from '@/components/admin/BloqueContenidoForm'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

type ModuloKey = 'perfil' | 'cultura' | 'rol'

interface ModuloDef {
  key: ModuloKey
  label: string
  descripcion: string
  icon: React.ReactNode
  accentColor: string
}

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

const MODULO_MAP: Record<ModuloKey, ModuloDef> = {
  perfil: {
    key: 'perfil',
    label: 'M1 · Perfil e Info Base',
    descripcion: 'Datos del empleado, accesos, contactos y organigrama.',
    icon: <User className="w-4 h-4" />,
    accentColor: 'text-teal-400',
  },
  cultura: {
    key: 'cultura',
    label: 'M2 · Cultura e Identidad',
    descripcion: 'Historia, misión, valores y reglas de trabajo.',
    icon: <BookOpen className="w-4 h-4" />,
    accentColor: 'text-[#38BDF8]',
  },
  rol: {
    key: 'rol',
    label: 'M3 · Rol y Herramientas',
    descripcion: 'Puesto, guías, herramientas y objetivos del rol.',
    icon: <Wrench className="w-4 h-4" />,
    accentColor: 'text-amber-400',
  },
}

const MODULOS_VALIDOS: ModuloKey[] = ['perfil', 'cultura', 'rol']

function esModuloValido(val: string): val is ModuloKey {
  return (MODULOS_VALIDOS as string[]).includes(val)
}

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
}

// ─────────────────────────────────────────────
// Skeleton de carga
// ─────────────────────────────────────────────

function SkeletonBloques() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="shimmer glass-card rounded-xl h-20" />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────

function EmptyState({ onAgregar }: { onAgregar: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 gap-3"
    >
      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
        <FileText className="w-5 h-5 text-white/20" />
      </div>
      <div className="text-center">
        <p className="text-sm text-white/50 font-medium">Sin bloques todavía</p>
        <p className="text-xs text-white/30 mt-0.5">
          Creá el primer bloque de conocimiento para este módulo
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onAgregar}>
        <Plus className="w-3.5 h-3.5" />
        Crear primer bloque
      </Button>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export default function ModuloContenidoPage() {
  const router = useRouter()
  const params = useParams()
  const moduloParam = params.modulo as string

  // Validar que el param sea un módulo conocido
  const moduloKey: ModuloKey | null = esModuloValido(moduloParam) ? moduloParam : null
  const moduloDef = moduloKey ? MODULO_MAP[moduloKey] : null

  const [loading, setLoading] = useState(true)
  const [guardandoOrden, setGuardandoOrden] = useState(false)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [bloques, setBloques] = useState<BloqueContenido[]>([])

  // Estado del formulario: 'nuevo' | BloqueContenido (edición) | null (cerrado)
  const [formulario, setFormulario] = useState<BloqueContenido | 'nuevo' | null>(null)
  const [bloqueAEliminar, setBloqueAEliminar] = useState<BloqueContenido | null>(null)

  // ── DnD state ──
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const dragCounterRef = useRef(0)

  // ── Carga inicial ──
  useEffect(() => {
    if (!moduloKey) {
      router.push('/admin/contenido')
      return
    }

    async function init() {
      try {
        const supabase = createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/auth/login'); return }

        const { data: perfil } = await supabase
          .from('usuarios')
          .select('empresa_id, rol')
          .eq('id', user.id)
          .single()

        if (!perfil || !['admin', 'dev'].includes(perfil.rol)) {
          router.push('/auth/login')
          return
        }

        setEmpresaId(perfil.empresa_id)
        await cargarBloques(perfil.empresa_id)
      } catch (err) {
        console.error('Error al inicializar módulo:', err)
      } finally {
        setLoading(false)
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduloKey, router])

  // ── Fetch bloques del módulo ──
  const cargarBloques = useCallback(async (eid: string) => {
    if (!moduloKey) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('conocimiento')
      .select('*')
      .eq('empresa_id', eid)
      .eq('modulo', moduloKey)
      .order('orden')

    if (error) {
      console.error('Error al cargar bloques del módulo:', error)
      toast.error('No se pudo cargar el contenido')
      return
    }
    setBloques((data ?? []) as BloqueContenido[])
  }, [moduloKey])

  // ── Persistir nuevo orden en Supabase ──
  const persistirOrden = useCallback(async (nuevosBloques: BloqueContenido[]) => {
    setGuardandoOrden(true)
    try {
      const supabase = createClient()
      const updates = nuevosBloques.map(b => ({
        id: b.id,
        orden: b.orden,
        empresa_id: b.empresa_id,
        modulo: b.modulo,
        titulo: b.titulo,
        contenido: b.contenido,
        updated_at: new Date().toISOString(),
      }))

      const { error } = await supabase.from('conocimiento').upsert(updates)
      if (error) throw error
    } catch (err) {
      console.error('Error al guardar orden:', err)
      toast.error('No se pudo guardar el orden')
    } finally {
      setGuardandoOrden(false)
    }
  }, [])

  // ── Eliminar bloque ──
  const eliminarBloque = useCallback(async () => {
    if (!bloqueAEliminar) return

    const snapshot = bloques
    setBloques(prev => prev.filter(b => b.id !== bloqueAEliminar.id))

    const supabase = createClient()
    const { error } = await supabase
      .from('conocimiento')
      .delete()
      .eq('id', bloqueAEliminar.id)

    if (error) {
      setBloques(snapshot)
      toast.error('No se pudo eliminar el bloque')
    } else {
      toast.success('Bloque eliminado')
      setBloqueAEliminar(null)
    }
  }, [bloqueAEliminar, bloques])

  // ─────────────────────────────────────────────
  // Drag & Drop handlers (HTML5 API nativa)
  // ─────────────────────────────────────────────

  function handleDragStart(idx: number) {
    setDraggingIdx(idx)
  }

  function handleDragEnter(idx: number) {
    dragCounterRef.current += 1
    setDragOverIdx(idx)
  }

  function handleDragLeave() {
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) setDragOverIdx(null)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function handleDrop(idx: number) {
    dragCounterRef.current = 0
    if (draggingIdx === null || draggingIdx === idx) {
      setDraggingIdx(null)
      setDragOverIdx(null)
      return
    }

    const nuevosBloques = [...bloques]
    const [movido] = nuevosBloques.splice(draggingIdx, 1)
    nuevosBloques.splice(idx, 0, movido)

    // Reasignar campo `orden` de forma secuencial
    const conOrdenActualizado = nuevosBloques.map((b, i) => ({
      ...b,
      orden: i + 1,
    }))

    setBloques(conOrdenActualizado)
    persistirOrden(conOrdenActualizado)

    setDraggingIdx(null)
    setDragOverIdx(null)
  }

  function handleDragEnd() {
    setDraggingIdx(null)
    setDragOverIdx(null)
    dragCounterRef.current = 0
  }

  // ─────────────────────────────────────────────
  // Render: módulo inválido
  // ─────────────────────────────────────────────

  if (!moduloKey || !moduloDef) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-sm text-white/40">Módulo no encontrado</p>
        <Link
          href="/admin/contenido"
          className="text-sm text-[#38BDF8] hover:text-[#7DD3FC] transition-colors"
        >
          ← Volver al contenido
        </Link>
      </div>
    )
  }

  // ─────────────────────────────────────────────
  // Render principal
  // ─────────────────────────────────────────────

  const proximoOrden = bloques.length + 1

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-3xl mx-auto"
    >
      {/* Encabezado con back */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <Link
          href="/admin/contenido"
          className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.04]
            transition-colors duration-150"
          aria-label="Volver"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={moduloDef.accentColor}>{moduloDef.icon}</span>
            <h1 className="text-base font-semibold text-white/90">{moduloDef.label}</h1>
          </div>
          <p className="text-xs text-white/35 mt-0.5">{moduloDef.descripcion}</p>
        </div>

        <div className="flex items-center gap-2">
          {guardandoOrden && (
            <div className="flex items-center gap-1.5 text-xs text-white/30">
              <div className="w-3 h-3 border border-white/20 border-t-white/50 rounded-full animate-spin-fast" />
              Guardando orden...
            </div>
          )}
          <Badge variant={bloques.length > 0 ? 'success' : 'default'}>
            {bloques.length} bloque{bloques.length !== 1 ? 's' : ''}
          </Badge>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              setFormulario(prev => (prev === 'nuevo' ? null : 'nuevo'))
            }
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo bloque
          </Button>
        </div>
      </motion.div>

      {/* Hint de drag */}
      {bloques.length > 1 && (
        <motion.p
          variants={itemVariants}
          className="text-xs text-white/25 flex items-center gap-1.5"
        >
          <GripVertical className="w-3.5 h-3.5" />
          Arrastrá los bloques para cambiar el orden de lectura del asistente IA
        </motion.p>
      )}

      {/* Lista de bloques */}
      <motion.div variants={itemVariants} className="space-y-3">
        {loading ? (
          <SkeletonBloques />
        ) : (
          <>
            {/* Formulario de nuevo bloque */}
            <AnimatePresence>
              {formulario === 'nuevo' && empresaId && (
                <BloqueContenidoForm
                  key="nuevo"
                  empresaId={empresaId}
                  modulo={moduloKey}
                  orden={proximoOrden}
                  onSuccess={nuevo => {
                    setBloques(prev => [...prev, nuevo])
                    setFormulario(null)
                  }}
                  onCancel={() => setFormulario(null)}
                />
              )}
            </AnimatePresence>

            {/* Empty state */}
            {bloques.length === 0 && formulario !== 'nuevo' && (
              <EmptyState onAgregar={() => setFormulario('nuevo')} />
            )}

            {/* Bloques draggables */}
            {bloques.map((bl, idx) => (
              <AnimatePresence key={bl.id} mode="wait">
                {formulario !== 'nuevo' && typeof formulario === 'object' && formulario?.id === bl.id ? (
                  /* Formulario de edición inline */
                  <BloqueContenidoForm
                    key={`edit-${bl.id}`}
                    empresaId={empresaId!}
                    modulo={moduloKey}
                    bloque={formulario}
                    onSuccess={actualizado => {
                      setBloques(prev =>
                        prev.map(b => (b.id === actualizado.id ? actualizado : b))
                      )
                      setFormulario(null)
                    }}
                    onCancel={() => setFormulario(null)}
                  />
                ) : (
                  /* Fila draggable */
                  <motion.div
                    key={bl.id}
                    variants={itemVariants}
                    layout
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    className={`group relative flex items-start gap-3 px-4 py-4 rounded-xl
                      border transition-all duration-150 select-none
                      ${draggingIdx === idx
                        ? 'opacity-40 border-[#0EA5E9]/40 bg-[#0EA5E9]/[0.08] scale-[0.99]'
                        : dragOverIdx === idx && draggingIdx !== idx
                          ? 'border-[#0EA5E9]/50 bg-[#0EA5E9]/[0.06] shadow-[0_0_0_1px_rgba(14,165,233,0.3)]'
                          : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.08]'
                      }`}
                  >
                    {/* Handle de drag */}
                    <div className="flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing
                      text-white/15 group-hover:text-white/35 transition-colors duration-150">
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Número de orden */}
                    <span className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-md
                      bg-white/[0.04] border border-white/[0.06]
                      flex items-center justify-center
                      text-[10px] text-white/25 font-mono">
                      {bl.orden}
                    </span>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">
                        {bl.titulo}
                      </p>
                      <p className="text-xs text-white/35 mt-1 leading-relaxed line-clamp-3">
                        {bl.contenido}
                      </p>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1 flex-shrink-0
                      opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={() => setFormulario(bl)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-[#38BDF8]
                          hover:bg-[#0EA5E9]/10 transition-colors duration-150"
                        aria-label="Editar bloque"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setBloqueAEliminar(bl)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-red-400
                          hover:bg-red-500/10 transition-colors duration-150"
                        aria-label="Eliminar bloque"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
          </>
        )}
      </motion.div>

      {/* Modal de confirmación de eliminación */}
      {bloqueAEliminar && (
        <EliminarBloqueModal
          bloque={bloqueAEliminar}
          onConfirm={eliminarBloque}
          onClose={() => setBloqueAEliminar(null)}
        />
      )}
    </motion.div>
  )
}
