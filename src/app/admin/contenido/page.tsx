'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Edit3,
  Trash2,
  FileText,
  Building2,
  FolderOpen,
  Briefcase,
  UserCheck,
  Save,
  Check,
  ChevronRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { BloqueContenidoForm } from '@/components/admin/BloqueContenidoForm'
import { EliminarBloqueModal } from '@/components/admin/EliminarBloqueModal'
import toast from 'react-hot-toast'
import type { BloqueContenido } from '@/components/admin/BloqueContenidoForm'
import { ErrorState } from '@/components/shared/ErrorState'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

type CapaKey = 'empresa' | 'area' | 'rol' | 'empleado'

interface CapaDef {
  key: CapaKey
  label: string
  icon: React.ReactNode
}

interface EmpleadoConNotas {
  id: string
  nombre: string
  puesto: string | null
  area: string | null
  notas_ia: string | null
}

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

const CAPAS: CapaDef[] = [
  { key: 'empresa',  label: 'Empresa',      icon: <Building2   className="w-3.5 h-3.5" /> },
  { key: 'area',     label: 'Por área',     icon: <FolderOpen  className="w-3.5 h-3.5" /> },
  { key: 'rol',      label: 'Por rol',      icon: <Briefcase   className="w-3.5 h-3.5" /> },
  { key: 'empleado', label: 'Por empleado', icon: <UserCheck   className="w-3.5 h-3.5" /> },
]

// ─────────────────────────────────────────────
// Variantes de animación
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
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
      {[1, 2, 3].map(i => (
        <div key={i} className="shimmer glass-card rounded-xl h-20" />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Empty state por módulo
// ─────────────────────────────────────────────

function EmptyState({ label, onAgregar }: { label: string; onAgregar: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 gap-3"
    >
      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
        <FileText className="w-5 h-5 text-white/20" />
      </div>
      <div className="text-center">
        <p className="text-sm text-white/50 font-medium">Sin bloques de contenido</p>
        <p className="text-xs text-white/30 mt-0.5">
          Agregá conocimiento sobre {label.toLowerCase()} para nutrir al asistente IA
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onAgregar} className="flex items-center gap-1.5">
        <Plus className="w-3.5 h-3.5" />
        Agregar primer bloque
      </Button>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Lista de bloques reutilizable
// ─────────────────────────────────────────────

function BloquesList({
  bloques,
  empresaId,
  modulo,
  area,
  puesto,
  onActualizado,
  onEliminar,
}: {
  bloques: BloqueContenido[]
  empresaId: string
  modulo: string
  area?: string | null
  puesto?: string | null
  onActualizado: (b: BloqueContenido) => void
  onEliminar: (b: BloqueContenido) => void
}) {
  const [formulario, setFormulario] = useState<{ bloque?: BloqueContenido } | null>(null)

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-2"
    >
      {bloques.sort((a, b) => a.orden - b.orden).map(bl => (
        <AnimatePresence key={bl.id} mode="wait">
          {formulario?.bloque?.id === bl.id ? (
            <BloqueContenidoForm
              key={`edit-${bl.id}`}
              empresaId={empresaId}
              modulo={modulo}
              bloque={formulario.bloque}
              area={area}
              puesto={puesto}
              onSuccess={actualizado => {
                onActualizado(actualizado)
                setFormulario(null)
              }}
              onCancel={() => setFormulario(null)}
            />
          ) : (
            <motion.div
              key={bl.id}
              variants={itemVariants}
              layout
              className="group flex items-start gap-3 px-4 py-3 rounded-xl
                bg-white/[0.02] border border-white/[0.05]
                hover:bg-white/[0.04] hover:border-white/[0.08]
                transition-colors duration-150"
            >
              <span className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-md
                bg-white/[0.04] border border-white/[0.06]
                flex items-center justify-center
                text-[10px] text-white/25 font-mono">
                {bl.orden}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 truncate">{bl.titulo}</p>
                <p className="text-xs text-white/35 mt-0.5 line-clamp-2 leading-relaxed">
                  {bl.contenido}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100
                transition-opacity duration-150 flex-shrink-0">
                <button
                  onClick={() => setFormulario({ bloque: bl })}
                  className="p-1.5 rounded-lg text-white/30 hover:text-[#38BDF8]
                    hover:bg-[#0EA5E9]/10 transition-colors duration-150"
                  aria-label="Editar bloque"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onEliminar(bl)}
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
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// CapaBloquePanel — panel para área o rol
// ─────────────────────────────────────────────

function CapaBloquePanel({
  tipo,
  valores,
  bloques,
  empresaId,
  onBloqueCreado,
  onBloqueActualizado,
  onBloqueEliminar,
}: {
  tipo: 'area' | 'rol'
  valores: string[]
  bloques: BloqueContenido[]
  empresaId: string
  onBloqueCreado: (b: BloqueContenido) => void
  onBloqueActualizado: (b: BloqueContenido) => void
  onBloqueEliminar: (b: BloqueContenido) => void
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null)
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [valorNuevo, setValorNuevo] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)

  // Incluir también valores que ya tienen bloques cargados (aunque no haya empleado)
  const valoresExistentes = [
    ...new Set([
      ...valores,
      ...bloques
        .filter(b => tipo === 'area' ? (!!b.area && !b.puesto) : !!b.puesto)
        .map(b => (tipo === 'area' ? b.area! : b.puesto!)),
    ]),
  ].sort()

  const bloquesFiltrados = seleccionado
    ? bloques.filter(b =>
        tipo === 'area'
          ? b.area === seleccionado && !b.puesto
          : b.puesto === seleccionado
      )
    : []

  const etiqueta = tipo === 'area' ? 'área' : 'rol'
  const modulo   = tipo === 'area' ? 'area' : 'puesto'

  const handleCrearNuevo = () => {
    const val = valorNuevo.trim()
    if (!val) return
    setSeleccionado(val)
    setMostrarNuevo(false)
    setValorNuevo('')
    setMostrarForm(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Pills de valores + agregar nuevo */}
      <div className="flex flex-wrap items-center gap-2">
        {valoresExistentes.map(v => {
          const count = bloques.filter(b =>
            tipo === 'area' ? b.area === v && !b.puesto : b.puesto === v
          ).length
          const activo = seleccionado === v
          return (
            <button
              key={v}
              onClick={() => { setSeleccionado(v); setMostrarForm(false) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-150
                ${activo
                  ? 'bg-[#0EA5E9]/20 text-[#7DD3FC] border border-[#0EA5E9]/20'
                  : 'bg-white/[0.04] text-white/50 border border-white/[0.06] hover:text-white/75 hover:bg-white/[0.06]'
                }`}
            >
              {v}
              {count > 0 && (
                <span className={`min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-bold
                  flex items-center justify-center
                  ${activo ? 'bg-[#0EA5E9]/30 text-[#7DD3FC]' : 'bg-white/[0.08] text-white/35'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}

        {/* Agregar nuevo valor */}
        {mostrarNuevo ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={valorNuevo}
              onChange={e => setValorNuevo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCrearNuevo(); if (e.key === 'Escape') setMostrarNuevo(false) }}
              placeholder={`Nombre del ${etiqueta}...`}
              autoFocus
              className="w-40 px-2.5 py-1.5 rounded-lg text-xs bg-white/[0.05] border border-[#0EA5E9]/30
                text-white/85 placeholder-white/25 outline-none focus:border-[#0EA5E9]/60"
            />
            <button
              onClick={handleCrearNuevo}
              className="p-1.5 rounded-lg bg-[#0EA5E9]/20 text-[#38BDF8] hover:bg-[#0EA5E9]/30 transition-colors"
            >
              <Check className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setMostrarNuevo(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs
              text-white/30 hover:text-white/60 border border-dashed border-white/[0.10]
              hover:border-white/[0.20] transition-colors duration-150"
          >
            <Plus className="w-3 h-3" />
            Nuevo {etiqueta}
          </button>
        )}
      </div>

      {/* Panel de contenido del valor seleccionado */}
      {seleccionado && (
        <AnimatePresence mode="wait">
          <motion.div
            key={seleccionado}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="glass-card rounded-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className={tipo === 'area' ? 'text-teal-400' : 'text-amber-400'}>
                  {tipo === 'area' ? <FolderOpen className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white/85">{seleccionado}</h2>
                  <p className="text-xs text-white/35 mt-0.5">
                    Contenido específico para este {etiqueta}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={bloquesFiltrados.length > 0 ? 'success' : 'default'}>
                  {bloquesFiltrados.length} bloque{bloquesFiltrados.length !== 1 ? 's' : ''}
                </Badge>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setMostrarForm(v => !v)}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar bloque
                </Button>
              </div>
            </div>

            {/* Cuerpo */}
            <div className="p-5 space-y-3">
              {/* Formulario nuevo bloque */}
              <AnimatePresence>
                {mostrarForm && (
                  <BloqueContenidoForm
                    key="nuevo-capa"
                    empresaId={empresaId}
                    modulo={modulo}
                    orden={bloquesFiltrados.length + 1}
                    area={tipo === 'area' ? seleccionado : null}
                    puesto={tipo === 'rol' ? seleccionado : null}
                    onSuccess={nuevo => {
                      onBloqueCreado(nuevo)
                      setMostrarForm(false)
                    }}
                    onCancel={() => setMostrarForm(false)}
                  />
                )}
              </AnimatePresence>

              {bloquesFiltrados.length === 0 && !mostrarForm ? (
                <EmptyState
                  label={`${etiqueta} "${seleccionado}"`}
                  onAgregar={() => setMostrarForm(true)}
                />
              ) : (
                <BloquesList
                  bloques={bloquesFiltrados}
                  empresaId={empresaId}
                  modulo={modulo}
                  area={tipo === 'area' ? seleccionado : null}
                  puesto={tipo === 'rol' ? seleccionado : null}
                  onActualizado={onBloqueActualizado}
                  onEliminar={onBloqueEliminar}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Placeholder cuando no hay nada seleccionado */}
      {!seleccionado && valoresExistentes.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-12 gap-2 text-center"
        >
          <ChevronRight className="w-5 h-5 text-white/15" />
          <p className="text-sm text-white/30">
            Seleccioná un {etiqueta} para ver o agregar contenido
          </p>
        </motion.div>
      )}

      {valoresExistentes.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-12 gap-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            {tipo === 'area' ? <FolderOpen className="w-5 h-5 text-white/20" /> : <Briefcase className="w-5 h-5 text-white/20" />}
          </div>
          <p className="text-sm text-white/40 text-center">
            No hay {etiqueta}s definidos todavía.<br />
            <span className="text-white/25">Creá uno con el botón de arriba.</span>
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// CapaEmpleadoPanel — notas del manager
// ─────────────────────────────────────────────

function CapaEmpleadoPanel({ empresaId }: { empresaId: string }) {
  const [empleados, setEmpleados]   = useState<EmpleadoConNotas[]>([])
  const [loading, setLoading]       = useState(true)
  const [notas, setNotas]           = useState<Record<string, string>>({})
  const [guardando, setGuardando]   = useState<Record<string, boolean>>({})
  const [guardado, setGuardado]     = useState<Record<string, boolean>>({})

  const cargarEmpleados = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, puesto, area, notas_ia')
      .eq('empresa_id', empresaId)
      .eq('rol', 'empleado')
      .order('nombre')

    if (error) {
      console.warn('[CapaEmpleado] error:', error.message)
      setLoading(false)
      return
    }

    const lista = (data ?? []) as EmpleadoConNotas[]
    setEmpleados(lista)

    const notasInit: Record<string, string> = {}
    for (const e of lista) notasInit[e.id] = e.notas_ia ?? ''
    setNotas(notasInit)
    setLoading(false)
  }, [empresaId])

  useEffect(() => { void cargarEmpleados() }, [cargarEmpleados])

  const guardarNotas = async (id: string) => {
    setGuardando(prev => ({ ...prev, [id]: true }))
    const supabase = createClient()
    const { error } = await supabase
      .from('usuarios')
      .update({ notas_ia: notas[id] ?? '' })
      .eq('id', id)

    if (error) {
      toast.error('No se pudo guardar las notas')
    } else {
      setGuardado(prev => ({ ...prev, [id]: true }))
      setTimeout(() => setGuardado(prev => ({ ...prev, [id]: false })), 2500)
    }
    setGuardando(prev => ({ ...prev, [id]: false }))
  }

  if (loading) return <SkeletonBloques />

  if (empleados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <UserCheck className="w-8 h-8 text-white/15" />
        <p className="text-sm text-white/35">Sin empleados en esta empresa todavía.</p>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-3"
    >
      {empleados.map(emp => {
        const iniciales = emp.nombre
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map(p => p[0].toUpperCase())
          .join('')

        return (
          <motion.div
            key={emp.id}
            variants={itemVariants}
            className="glass-card rounded-xl p-4 space-y-3"
          >
            {/* Info empleado */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#0EA5E9]/15 border border-[#0EA5E9]/20
                flex items-center justify-center flex-shrink-0">
                <span className="text-[#7DD3FC] text-xs font-bold">{iniciales}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 truncate">{emp.nombre}</p>
                <p className="text-xs text-white/35 truncate">
                  {[emp.puesto, emp.area].filter(Boolean).join(' · ') || 'Sin puesto/área asignado'}
                </p>
              </div>
            </div>

            {/* Textarea de notas */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/35">
                Notas para el asistente IA
              </label>
              <textarea
                value={notas[emp.id] ?? ''}
                onChange={e => setNotas(prev => ({ ...prev, [emp.id]: e.target.value }))}
                rows={3}
                placeholder="Ej: Tiene experiencia en Python. Prefiere comunicación directa. Viene de una startup."
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg
                  px-3 py-2 text-xs text-white/75 placeholder-white/20
                  outline-none focus:border-[#0EA5E9]/40 focus:bg-white/[0.05]
                  resize-none transition-colors duration-150"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => guardarNotas(emp.id)}
                disabled={guardando[emp.id]}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                  text-white/70 bg-white/[0.04] border border-white/[0.10]
                  hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-white/90
                  transition-all duration-150 disabled:opacity-50"
              >
                {guardado[emp.id] ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Guardado
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export default function ContenidoPage() {
  const router = useRouter()

  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(false)
  const [empresaId, setEmpresaId]       = useState<string | null>(null)
  const [bloques, setBloques]           = useState<BloqueContenido[]>([])
  const [capaActiva, setCapaActiva]     = useState<CapaKey>('empresa')

  // Datos de capas area/rol
  const [areas, setAreas]               = useState<string[]>([])
  const [puestos, setPuestos]           = useState<string[]>([])
  const [capasLoading, setCapasLoading] = useState(false)

  // Formulario inline empresa (nuevo / edición)
  const [formulario, setFormulario] = useState<
    { modulo: string; bloque?: BloqueContenido } | null
  >(null)

  // Modal de eliminación
  const [bloqueAEliminar, setBloqueAEliminar] = useState<BloqueContenido | null>(null)

  // ── Fetch de bloques (todos) ──
  const cargarBloques = useCallback(async (eid: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('conocimiento')
      .select('*')
      .eq('empresa_id', eid)
      .order('modulo')
      .order('orden')

    if (error) {
      console.error('Error al cargar bloques:', error)
      toast.error('No se pudo cargar el contenido')
      return
    }
    setBloques((data ?? []) as BloqueContenido[])
  }, [])

  // ── Fetch de áreas y puestos de empleados ──
  const cargarCapas = useCallback(async (eid: string) => {
    setCapasLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('usuarios')
      .select('area, puesto')
      .eq('empresa_id', eid)
      .eq('rol', 'empleado')

    const areasSet   = [...new Set((data ?? []).map(u => u.area).filter(Boolean) as string[])].sort()
    const puestosSet = [...new Set((data ?? []).map(u => u.puesto).filter(Boolean) as string[])].sort()
    setAreas(areasSet)
    setPuestos(puestosSet)
    setCapasLoading(false)
  }, [])

  // ── Carga inicial ──
  useEffect(() => {
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
        await Promise.all([
          cargarBloques(perfil.empresa_id),
          cargarCapas(perfil.empresa_id),
        ])
      } catch (err) {
        console.error('Error al inicializar contenido:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

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

  // ── Bloques de empresa (todos los sin area/puesto) ──
  const bloquesFiltradosEmpresa = bloques.filter(b => !b.area && !b.puesto)
  const proximoOrden = bloquesFiltradosEmpresa.length + 1

  if (!loading && error) return <ErrorState onRetry={() => { setError(false); setLoading(true) }} />

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Encabezado */}
      <motion.div variants={itemVariants} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white/90">Contenido del asistente</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Administrá el conocimiento institucional que nutre al asistente IA
          </p>
        </div>
      </motion.div>

      {/* ── Selector de capa ── */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
          {CAPAS.map(capa => {
            const activo = capaActiva === capa.key
            // Contar bloques relevantes para badge
            let count = 0
            if (capa.key === 'empresa') count = bloques.filter(b => !b.area && !b.puesto).length
            else if (capa.key === 'area') count = bloques.filter(b => !!b.area && !b.puesto).length
            else if (capa.key === 'rol')  count = bloques.filter(b => !!b.puesto).length

            return (
              <button
                key={capa.key}
                onClick={() => { setCapaActiva(capa.key); setFormulario(null) }}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                  transition-all duration-150 cursor-pointer
                  ${activo
                    ? 'bg-[#0EA5E9]/20 text-[#7DD3FC] border border-[#0EA5E9]/20'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                  }`}
              >
                <span className={activo ? 'text-[#38BDF8]' : 'text-white/25'}>
                  {capa.icon}
                </span>
                <span>{capa.label}</span>
                {count > 0 && (
                  <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold
                    flex items-center justify-center
                    ${activo ? 'bg-[#0EA5E9]/30 text-[#7DD3FC]' : 'bg-white/[0.06] text-white/30'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* ── CAPA EMPRESA: lista plana de todos los bloques ── */}
      {capaActiva === 'empresa' && (
        <motion.div variants={itemVariants}>
          <div className="glass-card rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="text-[#38BDF8]">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white/85">Conocimiento general</h2>
                  <p className="text-xs text-white/35 mt-0.5">
                    Información institucional visible para todos los empleados
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={bloquesFiltradosEmpresa.length > 0 ? 'success' : 'default'}>
                  {bloquesFiltradosEmpresa.length} bloque{bloquesFiltradosEmpresa.length !== 1 ? 's' : ''}
                </Badge>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    setFormulario(formulario && !formulario.bloque ? null : { modulo: 'empresa' })
                  }
                  className="flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar bloque
                </Button>
              </div>
            </div>

            {/* Cuerpo */}
            <div className="p-5 space-y-3">
              {loading ? (
                <SkeletonBloques />
              ) : (
                <>
                  <AnimatePresence>
                    {formulario && !formulario.bloque && empresaId && (
                      <BloqueContenidoForm
                        key="nuevo"
                        empresaId={empresaId}
                        modulo="empresa"
                        orden={proximoOrden}
                        onSuccess={nuevoBl => {
                          setBloques(prev => [...prev, nuevoBl])
                          setFormulario(null)
                        }}
                        onCancel={() => setFormulario(null)}
                      />
                    )}
                  </AnimatePresence>

                  {bloquesFiltradosEmpresa.length === 0 && !formulario ? (
                    <EmptyState
                      label="la empresa"
                      onAgregar={() => setFormulario({ modulo: 'empresa' })}
                    />
                  ) : (
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="space-y-2"
                    >
                      {bloquesFiltradosEmpresa
                        .sort((a, b) => a.orden - b.orden)
                        .map(bl => (
                          <AnimatePresence key={bl.id} mode="wait">
                            {formulario?.bloque?.id === bl.id ? (
                              <BloqueContenidoForm
                                key={`edit-${bl.id}`}
                                empresaId={empresaId!}
                                modulo={bl.modulo}
                                bloque={formulario.bloque}
                                onSuccess={actualizado => {
                                  setBloques(prev =>
                                    prev.map(b => (b.id === actualizado.id ? actualizado : b))
                                  )
                                  setFormulario(null)
                                }}
                                onCancel={() => setFormulario(null)}
                              />
                            ) : (
                              <motion.div
                                key={bl.id}
                                variants={itemVariants}
                                layout
                                className="group flex items-start gap-3 px-4 py-3 rounded-xl
                                  bg-white/[0.02] border border-white/[0.05]
                                  hover:bg-white/[0.04] hover:border-white/[0.08]
                                  transition-colors duration-150"
                              >
                                <span className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-md
                                  bg-white/[0.04] border border-white/[0.06]
                                  flex items-center justify-center
                                  text-[10px] text-white/25 font-mono">
                                  {bl.orden}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white/80 truncate">{bl.titulo}</p>
                                  <p className="text-xs text-white/35 mt-0.5 line-clamp-2 leading-relaxed">
                                    {bl.contenido}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100
                                  transition-opacity duration-150 flex-shrink-0">
                                  <button
                                    onClick={() => setFormulario({ modulo: bl.modulo, bloque: bl })}
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
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── CAPA ÁREA ── */}
      {capaActiva === 'area' && empresaId && (
        <motion.div variants={itemVariants}>
          {capasLoading ? <SkeletonBloques /> : (
            <CapaBloquePanel
              tipo="area"
              valores={areas}
              bloques={bloques}
              empresaId={empresaId}
              onBloqueCreado={b => setBloques(prev => [...prev, b])}
              onBloqueActualizado={b => setBloques(prev => prev.map(x => x.id === b.id ? b : x))}
              onBloqueEliminar={b => setBloqueAEliminar(b)}
            />
          )}
        </motion.div>
      )}

      {/* ── CAPA ROL ── */}
      {capaActiva === 'rol' && empresaId && (
        <motion.div variants={itemVariants}>
          {capasLoading ? <SkeletonBloques /> : (
            <CapaBloquePanel
              tipo="rol"
              valores={puestos}
              bloques={bloques}
              empresaId={empresaId}
              onBloqueCreado={b => setBloques(prev => [...prev, b])}
              onBloqueActualizado={b => setBloques(prev => prev.map(x => x.id === b.id ? b : x))}
              onBloqueEliminar={b => setBloqueAEliminar(b)}
            />
          )}
        </motion.div>
      )}

      {/* ── CAPA EMPLEADO ── */}
      {capaActiva === 'empleado' && empresaId && (
        <motion.div variants={itemVariants}>
          <CapaEmpleadoPanel empresaId={empresaId} />
        </motion.div>
      )}

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
