'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, Wrench, CheckSquare,
  Check, Clock, Zap, GitBranch,
} from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { useLanguage } from '@/components/LanguageProvider'
import { ErrorState } from '@/components/shared/ErrorState'
import { cn } from '@/lib/utils'
import { construirArbol, generarNodosDesdeUsuarios } from '@/lib/organigrama'
import type {
  TareaOnboarding, HerramientaRol, ObjetivoRol,
  DecisionAutonomia, OrgNodo,
} from '@/types'
import {
  SkeletonRol, containerVariants, sectionVariants,
} from '@/components/empleado/rol/helpers'
import { TabRol } from '@/components/empleado/rol/TabRol'
import { TabEquipo } from '@/components/empleado/rol/TabEquipo'
import { TabHerramientas } from '@/components/empleado/rol/TabHerramientas'
import { TabTareas } from '@/components/empleado/rol/TabTareas'

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function RolPage() {
  const { t } = useLanguage()

  const ESTADO_CONFIG = useMemo(() => ({
    pendiente:   { label: t('rol.estado.pendiente'),   variant: 'default' as const, Icon: Clock, color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200' },
    en_progreso: { label: t('rol.estado.en_progreso'), variant: 'warning' as const, Icon: Zap,   color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300' },
    completado:  { label: t('rol.estado.completada'),  variant: 'success' as const, Icon: Check, color: 'text-teal-600',  bg: 'bg-teal-50',  border: 'border-teal-300'  },
  }), [t])

  const [puesto, setPuesto] = useState<string>('')
  const [autonomia, setAutonomia] = useState<DecisionAutonomia[]>([])
  const [herramientas, setHerramientas] = useState<HerramientaRol[]>([])
  const [tareas, setTareas] = useState<TareaOnboarding[]>([])
  const [objetivos, setObjetivos] = useState<ObjetivoRol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  // Datos por empleado (M3 dinámico)
  const [rolResponsabilidades, setRolResponsabilidades] = useState<string[]>([])
  const [rolKpis, setRolKpis] = useState<string[]>([])
  const [modalidadEmpleado, setModalidadEmpleado] = useState<string>('')
  const [managerNombre, setManagerNombre] = useState<string>('')
  const [responsabilidadesKnowledge, setResponsabilidadesKnowledge] = useState<string[]>([])
  const [metricasKnowledge, setMetricasKnowledge] = useState<string | null>(null)
  const [rolHerramientasEmpleado, setRolHerramientasEmpleado] = useState<Array<{ nombre: string; uso: string }>>([])
  const [rolAutonomiaEmpleado, setRolAutonomiaEmpleado] = useState<string>('')
  const [nombreEmpleado, setNombreEmpleado] = useState<string>('')
  const [puestoEmpleado, setPuestoEmpleado] = useState<string>('')
  const [areaEmpleado, setAreaEmpleado] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [empresaId, setEmpresaId] = useState<string>('')
  const [orgDescripcion, setOrgDescripcion] = useState<string>('')
  const [orgArbol, setOrgArbol] = useState<OrgNodo[]>([])
  const [activeTab, setActiveTab] = useState<'rol' | 'equipo' | 'herramientas' | 'tareas'>('rol')

  const progresoGlobal = tareas.length > 0
    ? Math.round(tareas.filter(t => t.completada).length / tareas.length * 100)
    : 0

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: usuario, error: uErr } = await supabase
        .from('usuarios')
        .select('empresa_id, nombre, puesto, area, modalidad, rol_responsabilidades, rol_kpis, rol_herramientas, rol_autonomia')
        .eq('id', user.id)
        .single()
      if (uErr || !usuario) throw new Error(uErr?.message ?? 'Usuario no encontrado')

      const eid = usuario.empresa_id
      setUserId(user.id)
      setEmpresaId(eid)
      setNombreEmpleado((usuario.nombre as string) ?? '')
      setPuestoEmpleado((usuario.puesto as string | null) ?? '')
      setAreaEmpleado((usuario.area as string | null) ?? '')
      setRolResponsabilidades((usuario.rol_responsabilidades as string[] | null) ?? [])
      setRolKpis((usuario.rol_kpis as string[] | null) ?? [])
      setRolHerramientasEmpleado((usuario.rol_herramientas as Array<{ nombre: string; uso: string }> | null) ?? [])
      setRolAutonomiaEmpleado((usuario.rol_autonomia as string | null) ?? '')
      setModalidadEmpleado((usuario.modalidad as string | null) ?? '')

      const [conocimientoRes, herramientasRes, tareasRes, objetivosRes, orgRes, managerRes, orgNodosRes] = await Promise.all([
        supabase.from('conocimiento').select('bloque, contenido').eq('empresa_id', eid).eq('modulo', 'rol'),
        supabase.from('herramientas_rol').select('*').eq('empresa_id', eid).order('orden'),
        supabase.from('tareas_onboarding').select('*').eq('empresa_id', eid).eq('usuario_id', user.id).order('semana').order('orden'),
        supabase.from('objetivos_rol').select('*').eq('empresa_id', eid).order('semana'),
        supabase.from('conocimiento').select('contenido').eq('empresa_id', eid).eq('modulo', 'organigrama').eq('bloque', 'descripcion').maybeSingle(),
        supabase.from('equipo_relaciones').select('miembro:usuarios!equipo_relaciones_miembro_id_fkey(nombre)').eq('empleado_id', user.id).eq('relacion', 'manager').maybeSingle(),
        supabase.from('organigrama_nodos').select('*').eq('empresa_id', eid).eq('visible', true).order('orden'),
      ])

      if (conocimientoRes.error) console.warn('[M3] conocimiento:', conocimientoRes.error.message)
      if (herramientasRes.error) console.warn('[M3] herramientas_rol:', herramientasRes.error.message)
      if (tareasRes.error)       console.warn('[M3] tareas_onboarding:', tareasRes.error.message)
      if (objetivosRes.error)    console.warn('[M3] objetivos_rol:', objetivosRes.error.message)
      if (orgRes.error)          console.warn('[M3] organigrama:', orgRes.error.message)
      setOrgDescripcion((orgRes.data?.contenido as string | null) ?? '')
      // Supabase retorna el join como array — tomar el primer elemento
      const mgrRaw = managerRes.data?.miembro
      const mgr = (Array.isArray(mgrRaw) ? (mgrRaw[0] ?? null) : (mgrRaw ?? null)) as { nombre: string } | null
      setManagerNombre(mgr?.nombre ?? '')

      // Organigrama: si hay nodos personalizados usarlos, sino generar desde usuarios
      const nodosOrg = (orgNodosRes.data ?? []) as OrgNodo[]
      if (nodosOrg.length > 0) {
        setOrgArbol(construirArbol(nodosOrg))
      } else {
        const { data: usuariosOrg } = await supabase
          .from('usuarios')
          .select('id, nombre, puesto, area, foto_url, manager_id')
          .eq('empresa_id', eid)
        if (usuariosOrg?.length) {
          setOrgArbol(construirArbol(generarNodosDesdeUsuarios(usuariosOrg, eid)))
        }
      }

      const bloques = conocimientoRes.data ?? []
      const puestoBloque = bloques.find(b => b.bloque === 'puesto')
      const autonomiaBloque = bloques.find(b => b.bloque === 'autonomia')
      const responsabilidadesBloque = bloques.find(b => b.bloque === 'responsabilidades')
      const metricasBloque = bloques.find(b => b.bloque === 'metricas')

      setPuesto(puestoBloque?.contenido ?? '')
      try {
        setAutonomia(autonomiaBloque ? JSON.parse(autonomiaBloque.contenido) : [])
      } catch {
        setAutonomia([])
      }
      try {
        setResponsabilidadesKnowledge(
          responsabilidadesBloque?.contenido ? JSON.parse(responsabilidadesBloque.contenido) : []
        )
      } catch {
        setResponsabilidadesKnowledge([])
      }
      setMetricasKnowledge(metricasBloque?.contenido ?? null)

      setHerramientas(herramientasRes.data ?? [])
      setTareas(tareasRes.data ?? [])
      setObjetivos(objetivosRes.data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const toggleTarea = useCallback(async (id: string, completada: boolean) => {
    if (togglingIds.has(id)) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setTogglingIds(prev => new Set(prev).add(id))
    setTareas(prev => prev.map(t =>
      t.id === id ? { ...t, completada, completada_at: completada ? new Date().toISOString() : undefined } : t,
    ))

    try {
      const { error } = await supabase
        .from('tareas_onboarding')
        .update({ completada, completada_at: completada ? new Date().toISOString() : null })
        .eq('id', id)
        .eq('usuario_id', user.id)

      if (error) throw error

      setTareas(prev => {
        const updated = prev.map(t => t.id === id ? { ...t, completada } : t)
        const pct = updated.length > 0 ? Math.round(updated.filter(t => t.completada).length / updated.length * 100) : 0
        supabase.from('progreso_modulos').upsert({
          usuario_id: user.id, modulo: 'rol', bloque: 'general',
          completado: pct === 100, completado_at: pct === 100 ? new Date().toISOString() : null,
        }, { onConflict: 'usuario_id,modulo,bloque' }).then(() => {})
        return updated
      })
    } catch {
      setTareas(prev => prev.map(t => t.id === id ? { ...t, completada: !completada } : t))
      toast.error('No se pudo actualizar la tarea')
    } finally {
      setTogglingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }, [togglingIds])

  // ── Loading / Error ──
  if (loading) return (
    <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto"><SkeletonRol /></div>
    </div>
  )
  if (error) return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-6">
      <ErrorState mensaje={error} onRetry={cargarDatos} />
    </div>
  )

  return (
    <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* ── Page header M2 ── */}
        <div className="flex items-center gap-4 mb-6">
          <Image src="/heero-icons4.svg" alt="" width={45} height={45} />
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-1">Módulo 3</p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">Rol</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Conocé tu puesto, las herramientas y tus objetivos del mes
            </p>
          </div>
        </div>

        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4">

          {/* ── Mi progreso en Rol ── */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">
                Mi progreso en Rol
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {tareas.filter(t => t.completada).length} / {tareas.length} tareas
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
                <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="28" cy="28" r="22" fill="none"
                    stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                  <motion.circle
                    cx="28" cy="28" r="22" fill="none"
                    stroke="url(#rolProgressGrad)" strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={138.2}
                    initial={{ strokeDashoffset: 138.2 }}
                    animate={{ strokeDashoffset: 138.2 - (138.2 * progresoGlobal / 100) }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                  />
                  <defs>
                    <linearGradient id="rolProgressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3B4FD8" />
                      <stop offset="100%" stopColor="#0D9488" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-gray-900 leading-none">{progresoGlobal}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Progreso del módulo</p>
                <p className="text-xs text-gray-500">Completá las tareas para avanzar</p>
              </div>
            </div>
          </div>

          {/* ══ Tab bar ══ */}
          <motion.div variants={sectionVariants}>
            <div className="flex gap-1 p-1 rounded-xl bg-gray-100 border border-gray-200">
              {([
                { key: 'rol' as const,          label: 'Mi rol',        icon: <Briefcase className="w-3.5 h-3.5" /> },
                { key: 'equipo' as const,        label: 'Mi equipo',     icon: <GitBranch className="w-3.5 h-3.5" /> },
                { key: 'herramientas' as const,  label: 'Herramientas',  icon: <Wrench className="w-3.5 h-3.5" /> },
                { key: 'tareas' as const,        label: 'Tareas',        icon: <CheckSquare className="w-3.5 h-3.5" /> },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium transition-all rounded-lg',
                    activeTab === tab.key
                      ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
                  )}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* ══ Contenido por tab ══ */}
          <AnimatePresence>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-4 pb-8"
            >

              {/* ── Tab: Mi rol ── */}
              {activeTab === 'rol' && (
                <TabRol
                  puesto={puesto}
                  puestoEmpleado={puestoEmpleado}
                  areaEmpleado={areaEmpleado}
                  managerNombre={managerNombre}
                  modalidadEmpleado={modalidadEmpleado}
                  responsabilidadesKnowledge={responsabilidadesKnowledge}
                  rolResponsabilidades={rolResponsabilidades}
                  rolKpis={rolKpis}
                  metricasKnowledge={metricasKnowledge}
                  autonomia={autonomia}
                />
              )}

              {/* ── Tab: Mi equipo ── */}
              {activeTab === 'equipo' && userId && empresaId && (
                <TabEquipo
                  userId={userId}
                  empresaId={empresaId}
                  orgDescripcion={orgDescripcion}
                  orgArbol={orgArbol}
                />
              )}

              {/* ── Tab: Herramientas ── */}
              {activeTab === 'herramientas' && (
                <TabHerramientas herramientas={herramientas} />
              )}

              {/* ── Tab: Tareas ── */}
              {activeTab === 'tareas' && (
                <TabTareas
                  tareas={tareas}
                  objetivos={objetivos}
                  onToggle={toggleTarea}
                  estadoConfig={ESTADO_CONFIG}
                />
              )}

            </motion.div>
          </AnimatePresence>

        </motion.div>
      </div>
    </div>
  )
}
