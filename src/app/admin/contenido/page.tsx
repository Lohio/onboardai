'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  BookOpen,
  Wrench,
  Plus,
  Edit3,
  Trash2,
  ArrowRight,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { BloqueContenidoForm } from '@/components/admin/BloqueContenidoForm'
import { EliminarBloqueModal } from '@/components/admin/EliminarBloqueModal'
import toast from 'react-hot-toast'
import type { BloqueContenido } from '@/components/admin/BloqueContenidoForm'

// ─────────────────────────────────────────────
// Constantes: definición de módulos
// ─────────────────────────────────────────────

type ModuloKey = 'perfil' | 'cultura' | 'rol'

interface ModuloDef {
  key: ModuloKey
  label: string
  labelCorto: string
  descripcion: string
  icon: React.ReactNode
  color: string
}

const MODULOS: ModuloDef[] = [
  {
    key: 'perfil',
    label: 'Perfil e Info Base',
    labelCorto: 'M1 Perfil',
    descripcion: 'Datos del empleado, accesos, contactos y organigrama.',
    icon: <User className="w-4 h-4" />,
    color: 'text-teal-400',
  },
  {
    key: 'cultura',
    label: 'Cultura e Identidad',
    labelCorto: 'M2 Cultura',
    descripcion: 'Historia, misión, valores y reglas de trabajo.',
    icon: <BookOpen className="w-4 h-4" />,
    color: 'text-[#38BDF8]',
  },
  {
    key: 'rol',
    label: 'Rol y Herramientas',
    labelCorto: 'M3 Rol',
    descripcion: 'Puesto, guías, herramientas y objetivos del rol.',
    icon: <Wrench className="w-4 h-4" />,
    color: 'text-amber-400',
  },
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

function EmptyState({ modulo, onAgregar }: { modulo: ModuloDef; onAgregar: () => void }) {
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
          Agregá conocimiento sobre {modulo.label.toLowerCase()} para nutrir al asistente IA
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onAgregar}>
        <Plus className="w-3.5 h-3.5" />
        Agregar primer bloque
      </Button>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export default function ContenidoPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [bloques, setBloques] = useState<BloqueContenido[]>([])
  const [tabActivo, setTabActivo] = useState<ModuloKey>('perfil')

  // Formulario inline: null = cerrado, string = módulo para nuevo bloque, BloqueContenido = edición
  const [formulario, setFormulario] = useState<
    { modulo: ModuloKey; bloque?: BloqueContenido } | null
  >(null)

  // Modal de eliminación
  const [bloqueAEliminar, setBloqueAEliminar] = useState<BloqueContenido | null>(null)

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
        await cargarBloques(perfil.empresa_id)
      } catch (err) {
        console.error('Error al inicializar contenido:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // ── Fetch de bloques ──
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

  // ── Eliminar bloque ──
  const eliminarBloque = useCallback(async () => {
    if (!bloqueAEliminar) return

    // Optimistic: remover inmediatamente
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

  // ── Bloques del tab activo ──
  const bloquesFiltrados = bloques.filter(b => b.modulo === tabActivo)
  const moduloActivo = MODULOS.find(m => m.key === tabActivo)!

  // ── Siguiente orden disponible ──
  const proximoOrden = bloquesFiltrados.length + 1

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

      {/* Tabs de módulos */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] w-fit">
          {MODULOS.map(mod => {
            const count = bloques.filter(b => b.modulo === mod.key).length
            const activo = tabActivo === mod.key
            return (
              <button
                key={mod.key}
                onClick={() => {
                  setTabActivo(mod.key)
                  setFormulario(null)
                }}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                  transition-all duration-150 cursor-pointer
                  ${activo
                    ? 'bg-[#0EA5E9]/20 text-[#7DD3FC] border border-[#0EA5E9]/20'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                  }`}
              >
                <span className={activo ? 'text-[#38BDF8]' : 'text-white/25'}>
                  {mod.icon}
                </span>
                <span className="hidden sm:inline">{mod.labelCorto}</span>
                <span className="sm:hidden">{mod.key === 'perfil' ? 'M1' : mod.key === 'cultura' ? 'M2' : 'M3'}</span>
                {count > 0 && (
                  <span
                    className={`min-w-[18px] h-4.5 px-1 rounded-full text-[10px] font-bold
                      flex items-center justify-center
                      ${activo
                        ? 'bg-[#0EA5E9]/30 text-[#7DD3FC]'
                        : 'bg-white/[0.06] text-white/30'
                      }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Contenido del tab activo */}
      <motion.div variants={itemVariants}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tabActivo}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="glass-card rounded-xl overflow-hidden"
          >
            {/* Header del tab */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className={`${moduloActivo.color}`}>
                  {moduloActivo.icon}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white/85">
                    {moduloActivo.label}
                  </h2>
                  <p className="text-xs text-white/35 mt-0.5">
                    {moduloActivo.descripcion}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={bloquesFiltrados.length > 0 ? 'success' : 'default'}>
                  {bloquesFiltrados.length} bloque{bloquesFiltrados.length !== 1 ? 's' : ''}
                </Badge>

                {/* Link a vista detallada con DnD */}
                <Link
                  href={`/admin/contenido/${tabActivo}`}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs
                    text-white/40 hover:text-white/70 hover:bg-white/[0.04]
                    transition-colors duration-150"
                >
                  Ordenar
                  <ArrowRight className="w-3 h-3" />
                </Link>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    setFormulario(
                      formulario?.modulo === tabActivo && !formulario.bloque
                        ? null
                        : { modulo: tabActivo }
                    )
                  }
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
                  {/* Formulario de nuevo bloque */}
                  <AnimatePresence>
                    {formulario?.modulo === tabActivo && !formulario.bloque && empresaId && (
                      <BloqueContenidoForm
                        key="nuevo"
                        empresaId={empresaId}
                        modulo={tabActivo}
                        orden={proximoOrden}
                        onSuccess={nuevoBl => {
                          setBloques(prev => [...prev, nuevoBl])
                          setFormulario(null)
                        }}
                        onCancel={() => setFormulario(null)}
                      />
                    )}
                  </AnimatePresence>

                  {/* Lista de bloques */}
                  {bloquesFiltrados.length === 0 && !formulario ? (
                    <EmptyState
                      modulo={moduloActivo}
                      onAgregar={() => setFormulario({ modulo: tabActivo })}
                    />
                  ) : (
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="space-y-2"
                    >
                      {bloquesFiltrados
                        .sort((a, b) => a.orden - b.orden)
                        .map(bl => (
                          <AnimatePresence key={bl.id} mode="wait">
                            {formulario?.bloque?.id === bl.id ? (
                              /* Formulario de edición inline */
                              <BloqueContenidoForm
                                key={`edit-${bl.id}`}
                                empresaId={empresaId!}
                                modulo={tabActivo}
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
                              /* Fila del bloque */
                              <motion.div
                                key={bl.id}
                                variants={itemVariants}
                                layout
                                className="group flex items-start gap-3 px-4 py-3 rounded-xl
                                  bg-white/[0.02] border border-white/[0.05]
                                  hover:bg-white/[0.04] hover:border-white/[0.08]
                                  transition-colors duration-150"
                              >
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
                                  <p className="text-xs text-white/35 mt-0.5 line-clamp-2 leading-relaxed">
                                    {bl.contenido}
                                  </p>
                                </div>

                                {/* Acciones */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100
                                  transition-opacity duration-150 flex-shrink-0">
                                  <button
                                    onClick={() => setFormulario({ modulo: tabActivo, bloque: bl })}
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
          </motion.div>
        </AnimatePresence>
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
