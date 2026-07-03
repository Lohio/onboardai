'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { EliminarBloqueModal } from '@/components/admin/EliminarBloqueModal'
import toast from 'react-hot-toast'
import type { BloqueContenido } from '@/components/admin/BloqueContenidoForm'
import { ErrorState } from '@/components/shared/ErrorState'
import type { CapaKey, FormularioEmpresa } from '@/components/admin/contenido/types'
import {
  CAPAS,
  containerVariants,
  itemVariants,
  SkeletonBloques,
} from '@/components/admin/contenido/helpers'
import { CapaEmpresaPanel } from '@/components/admin/contenido/CapaEmpresaPanel'
import { CapaBloquePanel } from '@/components/admin/contenido/CapaBloquePanel'
import { CapaEmpleadoPanel } from '@/components/admin/contenido/CapaEmpleadoPanel'
import { useLanguage } from '@/components/LanguageProvider'

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────

export default function ContenidoPage() {
  const router = useRouter()
  const { t } = useLanguage()

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
  const [formulario, setFormulario] = useState<FormularioEmpresa>(null)

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
      toast.error(t('adminCont.toast.errorCargar'))
      return
    }
    setBloques((data ?? []) as BloqueContenido[])
  }, [t])

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
      toast.error(t('adminCont.toast.errorEliminar'))
    } else {
      toast.success(t('adminCont.toast.bloqueEliminado'))
      setBloqueAEliminar(null)
    }
  }, [bloqueAEliminar, bloques, t])

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
          <h1 className="text-lg font-semibold text-white/90">CopilBot</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {t('adminCont.subtitulo')}
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
                    ? 'bg-gray-900 hover:bg-gray-800'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                  }`}
                style={activo ? { color: 'white' } : undefined}
              >
                <span
                  className={activo ? '' : 'text-white/25'}
                  style={activo ? { color: 'white' } : undefined}
                >
                  {capa.icon}
                </span>
                <span>{t('adminCont.capa.' + capa.key)}</span>
                {count > 0 && (
                  <span
                    className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold
                      flex items-center justify-center
                      ${activo ? 'bg-white' : 'bg-white/[0.06] text-white/30'}`}
                    style={activo ? { color: '#111827' } : undefined}
                  >
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
          <CapaEmpresaPanel
            loading={loading}
            empresaId={empresaId}
            bloquesFiltradosEmpresa={bloquesFiltradosEmpresa}
            proximoOrden={proximoOrden}
            formulario={formulario}
            setFormulario={setFormulario}
            onBloqueCreado={b => setBloques(prev => [...prev, b])}
            onBloqueActualizado={b => setBloques(prev => prev.map(x => x.id === b.id ? b : x))}
            onBloqueEliminar={b => setBloqueAEliminar(b)}
          />
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
