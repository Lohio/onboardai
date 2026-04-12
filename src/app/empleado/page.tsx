'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  User, BookOpen, Briefcase, MessageSquare,
  CheckCircle2, Circle, ArrowRight, Mail,
  CheckSquare, Bot, Sparkles, Lock,
  Calendar, MapPin, ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useLanguage } from '@/components/LanguageProvider'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import { EncuestaPulsoModal, type EncuestaPendiente } from '@/components/empleado/EncuestaPulsoModal'
import { calcularEstadoModulos, calcularProgresoPct, isModuloDesbloqueado, calcularFaseActual, calcularProgresoPlanGlobal, calcularProgresoPlanFase } from '@/lib/progreso'
import { FASES_CONFIG, COLOR_EXTRAS } from '@/lib/plan'
import type { PlanItem } from '@/types'
import { getInitials, formatFecha } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { ErrorState } from '@/components/shared/ErrorState'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface DatosBase {
  id: string
  nombre: string
  puesto?: string
  area?: string
  empresa_id: string
  fecha_ingreso?: string
  foto_url?: string
  modalidad?: string
  email: string
}

interface MiembroEquipo {
  id: string
  nombre: string
  email: string
  puesto?: string
  foto_url?: string
  relacion: 'manager' | 'buddy' | 'companero'
}

interface TareaResumen {
  id: string
  titulo: string
  completada: boolean
  semana: number
}

interface BloqueProgreso {
  bloque: string
  completado: boolean
  label: string
}

type TabId = 'M1' | 'M2' | 'M3' | 'M4'

// ─────────────────────────────────────────────
// Config de tabs
// ─────────────────────────────────────────────

// TABS y BLOQUES_CULTURA_LABELS se generan dentro del componente con useMemo para soporte i18n

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────

const tabContentVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? 24 : -24,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -24 : 24,
    transition: { duration: 0.15 },
  }),
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-md', className)} />
}

function TabContentSkeleton() {
  return (
    <div className="space-y-3 py-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-12 w-full rounded-xl mt-4" />
    </div>
  )
}

// ─────────────────────────────────────────────
// Avatar pequeño
// ─────────────────────────────────────────────

function SmallAvatar({ src, nombre }: { src?: string; nombre: string }) {
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-[#0EA5E9]/20 border border-[#0EA5E9]/20 flex items-center justify-center">
      {src ? (
        <img src={src} alt={nombre} className="w-full h-full object-cover" />
      ) : (
        <span className="text-sky-600 text-xs font-semibold">{getInitials(nombre)}</span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Helper: días desde fecha
// ─────────────────────────────────────────────

function diasDesdeIngreso(fecha?: string): number | null {
  if (!fecha) return null
  return Math.max(1, Math.ceil((Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24)))
}

// ─────────────────────────────────────────────
// Tab M1 — Perfil
// ─────────────────────────────────────────────

function TabPerfil({
  datos,
  equipo,
  cargando,
}: {
  datos: DatosBase
  equipo: MiembroEquipo[] | null
  cargando: boolean
}) {
  const manager = equipo?.find(m => m.relacion === 'manager')
  const buddy = equipo?.find(m => m.relacion === 'buddy')

  const modalidadLabel = (m: string) => {
    if (m === 'presencial') return 'Presencial'
    if (m === 'remoto') return 'Remoto'
    if (m === 'hibrido') return 'Híbrido'
    return m
  }

  return (
    <div className="space-y-4">
      {/* Hero mini */}
      <div className="flex items-center gap-3">
        <div
          className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-[#0EA5E9]/10 border-2 border-[#0EA5E9]/20 flex items-center justify-center"
        >
          {datos.foto_url ? (
            <img src={datos.foto_url} alt={datos.nombre} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sky-600 text-xl font-semibold">{getInitials(datos.nombre)}</span>
          )}
        </div>
        <div>
          <p className="text-base font-semibold text-gray-900">{datos.nombre}</p>
          {(datos.puesto || datos.area) && (
            <p className="text-sm text-gray-500">
              {[datos.puesto, datos.area].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {datos.fecha_ingreso && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                {formatFecha(datos.fecha_ingreso)}
              </span>
            )}
            {datos.modalidad && (
              <Badge variant="info">{modalidadLabel(datos.modalidad)}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Equipo */}
      {cargando ? (
        <TabContentSkeleton />
      ) : equipo && equipo.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-widest">Mi equipo</p>
          {[manager, buddy].filter(Boolean).map((m) => m && (
            <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-200">
              <SmallAvatar src={m.foto_url} nombre={m.nombre} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{m.nombre}</p>
                  <Badge variant={m.relacion === 'manager' ? 'default' : 'success'}>
                    {m.relacion === 'manager' ? 'Manager' : 'Buddy'}
                  </Badge>
                </div>
                {m.puesto && <p className="text-xs text-gray-500 truncate">{m.puesto}</p>}
              </div>
              <a
                href={`mailto:${m.email}`}
                className="text-gray-300 hover:text-sky-600 transition-colors p-1"
              >
                <Mail className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">No hay miembros del equipo asignados aún.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Tab M2 — Cultura
// ─────────────────────────────────────────────

function TabCultura({
  bloques,
  totalBloques,
  cargando,
}: {
  bloques: BloqueProgreso[] | null
  totalBloques: number
  cargando: boolean
}) {
  if (cargando) return <TabContentSkeleton />

  const completados = bloques?.filter(b => b.completado).length ?? 0
  const total = totalBloques || bloques?.length || 5
  const pct = total > 0 ? Math.round((completados / total) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Progreso resumen */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-gray-500">Bloques de cultura completados</p>
          <span className="text-xs font-mono text-gray-500">{completados}/{total}</span>
        </div>
        <ProgressBar value={pct} showPercentage={false} animated />
      </div>

      {/* Lista de bloques */}
      <div className="space-y-2">
        {(bloques ?? []).slice(0, 5).map(b => (
          <div
            key={b.bloque}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50 border border-gray-200"
          >
            {b.completado ? (
              <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
            )}
            <span className={cn('text-sm truncate', b.completado ? 'text-gray-600 line-through' : 'text-gray-900')}>
              {b.label}
            </span>
            {b.completado && <Badge variant="success" className="ml-auto flex-shrink-0">✓</Badge>}
          </div>
        ))}
        {!bloques || bloques.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No hay bloques de cultura disponibles aún.</p>
        ) : null}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Tab M3 — Rol
// ─────────────────────────────────────────────

function TabRol({
  tareas,
  cargando,
}: {
  tareas: TareaResumen[] | null
  cargando: boolean
}) {
  if (cargando) return <TabContentSkeleton />

  const pendientes = tareas?.filter(t => !t.completada) ?? []
  const completadas = tareas?.filter(t => t.completada).length ?? 0
  const total = tareas?.length ?? 0
  const pct = total > 0 ? Math.round((completadas / total) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Progreso tareas */}
      {total > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-gray-500">Tareas completadas</p>
            <span className="text-xs font-mono text-gray-500">{completadas}/{total}</span>
          </div>
          <ProgressBar value={pct} showPercentage={false} animated />
        </div>
      )}

      {/* Próximas tareas pendientes */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-widest">Próximas tareas</p>
        {pendientes.length > 0 ? pendientes.slice(0, 5).map(t => (
          <div
            key={t.id}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50 border border-gray-200"
          >
            <CheckSquare className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm text-gray-700 truncate">{t.titulo}</span>
            <span className="ml-auto text-[10px] text-gray-300 flex-shrink-0">Sem. {t.semana}</span>
          </div>
        )) : (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-teal-600/10 border border-teal-500/20">
            <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
            <p className="text-sm text-teal-700">
              {total > 0 ? '¡Completaste todas tus tareas!' : 'No hay tareas asignadas aún.'}
            </p>
          </div>
        )}
        {pendientes.length > 5 && (
          <p className="text-xs text-gray-400 text-center">+{pendientes.length - 5} tareas más</p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Tab M4 — Asistente
// ─────────────────────────────────────────────

function TabAsistente({
  conversaciones,
  nombre,
  cargando,
}: {
  conversaciones: number | null
  nombre: string
  cargando: boolean
}) {
  if (cargando) return <TabContentSkeleton />

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-teal-600/10 border border-teal-500/20">
        <div className="w-10 h-10 rounded-xl bg-teal-600/20 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Asistente de onboarding</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            Tenés dudas sobre la empresa, tu rol o los procesos? El asistente IA está disponible para ayudarte.
          </p>
        </div>
      </div>

      {/* Stats */}
      {conversaciones !== null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50">
          <Sparkles className="w-3.5 h-3.5 text-[#0EA5E9]" />
          <p className="text-xs text-gray-500">
            {conversaciones === 0
              ? 'Todavía no iniciaste ninguna conversación'
              : `Iniciaste ${conversaciones} conversación${conversaciones === 1 ? '' : 'es'} con el asistente`}
          </p>
        </div>
      )}

      {/* Prompts sugeridos */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-widest">Preguntas frecuentes</p>
        {[
          '¿Cómo son los procesos de feedback en la empresa?',
          '¿Cuáles son los valores y la cultura del equipo?',
          `¿Qué se espera de mí en los primeros 30 días?`,
        ].map((prompt, i) => (
          <Link
            key={i}
            href={`/empleado/asistente?q=${encodeURIComponent(prompt)}`}
            className="flex items-center gap-2.5 w-full p-2.5 rounded-xl bg-gray-50 border border-gray-200 hover:border-teal-300 hover:bg-teal-50 hover:shadow-md transition-all duration-150 group text-left"
          >
            <MessageSquare className="w-3.5 h-3.5 text-teal-600/60 flex-shrink-0" />
            <span className="text-xs text-gray-600 group-hover:text-gray-900 transition-colors line-clamp-1">
              {prompt}
            </span>
            <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-teal-600 ml-auto flex-shrink-0 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function EmpleadoHome() {
  const { t } = useLanguage()

  // ── Tabs y labels de cultura (i18n) ──────────
  const TABS = useMemo(() => [
    { id: 'M1' as TabId, label: t('tab.perfil'),    icon: <User className="w-4 h-4" />,          href: '/empleado/perfil',    color: 'sky' },
    { id: 'M2' as TabId, label: t('tab.cultura'),   icon: <BookOpen className="w-4 h-4" />,       href: '/empleado/cultura',   color: 'sky' },
    { id: 'M3' as TabId, label: t('tab.rol'),       icon: <Briefcase className="w-4 h-4" />,      href: '/empleado/rol',       color: 'amber' },
    { id: 'M4' as TabId, label: t('tab.asistente'), icon: <MessageSquare className="w-4 h-4" />,  href: '/empleado/asistente', color: 'teal' },
  ], [t])

  const BLOQUES_CULTURA_LABELS = useMemo<Record<string, string>>(() => ({
    historia:        t('cultura.historia'),
    mision:          t('cultura.mision'),
    como_trabajamos: t('cultura.como_trabajamos'),
    expectativas:    t('cultura.expectativas'),
    hitos:           t('cultura.hitos'),
  }), [t])

  // ── Estado base (carga inicial) ──────────────
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [datosBase, setDatosBase] = useState<DatosBase | null>(null)
  const [estadoModulos, setEstadoModulos] = useState({ M1: true, M2: false, M3: false, M4: false })
  const [progresoPct, setProgresoPct] = useState(0)
  const [encuestaPendiente, setEncuestaPendiente] = useState<EncuestaPendiente | null>(null)

  // ── Plan 30-60-90 ────────────────────────────
  const [planItems, setPlanItems] = useState<PlanItem[]>([])

  // ── Tab activo y dirección de animación ──────
  const [tabActivo, setTabActivo] = useState<TabId>('M1')
  const [tabPrev, setTabPrev] = useState<TabId>('M1')
  const direction = TABS.findIndex(tab => tab.id === tabActivo) - TABS.findIndex(tab => tab.id === tabPrev)

  // ── Datos lazy por tab ───────────────────────
  const [tabsCargados, setTabsCargados] = useState<Set<TabId>>(new Set())
  const [tabsCargando, setTabsCargando] = useState<Set<TabId>>(new Set())

  // M1
  const [equipo, setEquipo] = useState<MiembroEquipo[] | null>(null)
  // M2
  const [bloquesProgreso, setBloquesProgreso] = useState<BloqueProgreso[] | null>(null)
  const [totalBloquesCultura, setTotalBloquesCultura] = useState(5)
  // M3
  const [tareas, setTareas] = useState<TareaResumen[] | null>(null)
  // M4
  const [conversaciones, setConversaciones] = useState<number | null>(null)

  // ── Verificar encuesta de pulso pendiente ─────────────────────
  const verificarEncuesta = useCallback(async () => {
    try {
      const res = await fetch('/api/empleado/encuesta-check', { method: 'POST' })
      if (res.ok) {
        const json = await res.json() as { encuesta: EncuestaPendiente | null }
        if (json.encuesta) setEncuestaPendiente(json.encuesta)
      }
    } catch { /* silenciar */ }
  }, [])

  // Listener para abrir el modal desde el agente flotante
  useEffect(() => {
    const handler = () => void verificarEncuesta()
    window.addEventListener('open-encuesta-modal', handler)
    return () => window.removeEventListener('open-encuesta-modal', handler)
  }, [verificarEncuesta])

  // ── Carga inicial de datos base ────────────────────────────────
  const cargarDatosBase = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Datos del usuario, progreso y plan en paralelo
      const [usuarioRes, progresoRes, planRes] = await Promise.all([
        supabase
          .from('usuarios')
          .select('id, nombre, puesto, area, empresa_id, fecha_ingreso, foto_url, modalidad, email')
          .eq('id', user.id)
          .single(),
        supabase
          .from('progreso_modulos')
          .select('modulo, bloque, completado')
          .eq('usuario_id', user.id),
        supabase
          .from('plan_30_60_90')
          .select('*')
          .eq('usuario_id', user.id)
          .order('orden', { ascending: true }),
      ])

      const usuario = usuarioRes.data
      if (!usuario) return
      setDatosBase(usuario as DatosBase)
      setPlanItems((planRes.data ?? []) as PlanItem[])

      // Ahora que tenemos empresa_id, consultamos el total de bloques de cultura
      const culturaCountRes = await supabase
        .from('conocimiento')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', usuario.empresa_id)
        .eq('modulo', 'cultura')

      const progresoRows = progresoRes.data ?? []
      const totalCultura = (culturaCountRes.count ?? 5)
      setTotalBloquesCultura(totalCultura)

      const estados = calcularEstadoModulos(progresoRows, totalCultura)
      setEstadoModulos(estados)
      setProgresoPct(calcularProgresoPct(estados))

      // Encuesta de pulso (fire and forget)
      void verificarEncuesta()

      // Precargar el primer tab (M1)
      setTabsCargados(new Set(['M1' as TabId]))
      cargarTabM1(user.id, usuario as DatosBase)
    } catch (err) {
      console.error('[EmpleadoHome] Error cargando datos base:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargarDatosBase() }, [cargarDatosBase])

  // ── Carga lazy por tab ────────────────────────────────────────

  const cargarTabM1 = useCallback(async (userId: string, usuario: DatosBase) => {
    try {
      const supabase = createClient()
      const relRes = await supabase
        .from('equipo_relaciones')
        .select('relacion, miembro_id')
        .eq('usuario_id', userId)

      if (!relRes.data || relRes.data.length === 0) {
        setEquipo([])
        return
      }

      const ids = relRes.data.map(r => r.miembro_id)
      const miembrosRes = await supabase
        .from('usuarios')
        .select('id, nombre, email, puesto, foto_url')
        .in('id', ids)

      const miembros: MiembroEquipo[] = relRes.data
        .map(rel => {
          const u = miembrosRes.data?.find(m => m.id === rel.miembro_id)
          return {
            id: rel.miembro_id,
            nombre: u?.nombre ?? '',
            email: u?.email ?? '',
            puesto: u?.puesto ?? undefined,
            foto_url: u?.foto_url ?? undefined,
            relacion: rel.relacion as MiembroEquipo['relacion'],
          }
        })
        .filter(m => m.nombre)
      const order = { manager: 0, buddy: 1, companero: 2 }
      miembros.sort((a, b) => order[a.relacion] - order[b.relacion])
      setEquipo(miembros)
    } catch (err) {
      console.warn('[TabM1] equipo:', err)
      setEquipo([])
    }
  }, [])

  const cargarTabM2 = useCallback(async (userId: string, empresaId: string) => {
    try {
      const supabase = createClient()
      const [progresoRes, contenidosRes] = await Promise.all([
        supabase
          .from('progreso_modulos')
          .select('bloque, completado')
          .eq('usuario_id', userId)
          .eq('modulo', 'cultura'),
        supabase
          .from('conocimiento')
          .select('bloque, titulo')
          .eq('empresa_id', empresaId)
          .eq('modulo', 'cultura')
          .order('bloque'),
      ])

      const progresoMap: Record<string, boolean> = {}
      for (const p of progresoRes.data ?? []) {
        progresoMap[p.bloque] = p.completado
      }

      // Usar conocimiento real si existe, si no usar bloques default
      const bloques: BloqueProgreso[] = (contenidosRes.data ?? []).map(c => ({
        bloque: c.bloque,
        label: BLOQUES_CULTURA_LABELS[c.bloque] ?? c.titulo ?? c.bloque,
        completado: progresoMap[c.bloque] ?? false,
      }))

      if (bloques.length === 0) {
        // Fallback con bloques canónicos
        const defaultBloques = ['historia', 'mision', 'como_trabajamos', 'expectativas', 'hitos']
        setBloquesProgreso(defaultBloques.map(b => ({
          bloque: b,
          label: BLOQUES_CULTURA_LABELS[b] ?? b,
          completado: progresoMap[b] ?? false,
        })))
      } else {
        setBloquesProgreso(bloques)
      }
    } catch (err) {
      console.warn('[TabM2] cultura:', err)
      setBloquesProgreso([])
    }
  }, [BLOQUES_CULTURA_LABELS])

  const cargarTabM3 = useCallback(async (userId: string, empresaId: string) => {
    try {
      const supabase = createClient()
      const res = await supabase
        .from('tareas_onboarding')
        .select('id, titulo, completada, semana')
        .eq('empresa_id', empresaId)
        .eq('usuario_id', userId)
        .order('semana')
        .order('orden')
      setTareas(res.data ?? [])
    } catch (err) {
      console.warn('[TabM3] tareas:', err)
      setTareas([])
    }
  }, [])

  const cargarTabM4 = useCallback(async (userId: string) => {
    try {
      const supabase = createClient()
      const { count } = await supabase
        .from('conversaciones_ia')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', userId)
      setConversaciones(count ?? 0)
    } catch {
      setConversaciones(0)
    }
  }, [])

  // ── Handler de cambio de tab ─────────────────
  const handleTabClick = useCallback(async (tab: TabId) => {
    if (tab === tabActivo) return
    setTabPrev(tabActivo)
    setTabActivo(tab)

    if (tabsCargados.has(tab) || tabsCargando.has(tab)) return
    if (!datosBase) return

    setTabsCargando(prev => new Set(prev).add(tab))
    const userId = datosBase.id
    const empresaId = datosBase.empresa_id

    try {
      if (tab === 'M1') await cargarTabM1(userId, datosBase)
      if (tab === 'M2') await cargarTabM2(userId, empresaId)
      if (tab === 'M3') await cargarTabM3(userId, empresaId)
      if (tab === 'M4') await cargarTabM4(userId)
      setTabsCargados(prev => new Set(prev).add(tab))
    } finally {
      setTabsCargando(prev => { const s = new Set(prev); s.delete(tab); return s })
    }
  }, [tabActivo, tabsCargados, tabsCargando, datosBase, cargarTabM1, cargarTabM2, cargarTabM3, cargarTabM4])

  // ── Determinar tab inicial basado en módulo activo ──
  useEffect(() => {
    if (!loading && datosBase) {
      const tabInicial = !estadoModulos.M1 ? 'M1'
        : !estadoModulos.M2 ? 'M2'
        : !estadoModulos.M3 ? 'M3'
        : !estadoModulos.M4 ? 'M4'
        : 'M1'
      setTabActivo(tabInicial as TabId)
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState onRetry={cargarDatosBase} />

  // ─────────────────────────────────────────────
  // Render: loading
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-4">
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 flex-1 rounded-xl" />)}
            </div>
            <div className="space-y-3 pt-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!datosBase) return null

  const estadoArray = [estadoModulos.M1, estadoModulos.M2, estadoModulos.M3, estadoModulos.M4]
  const dias = diasDesdeIngreso(datosBase.fecha_ingreso)

  // Plan 30-60-90
  const faseActual = datosBase.fecha_ingreso ? calcularFaseActual(datosBase.fecha_ingreso) : '30' as const
  const diaOnboarding = dias ?? 1
  const progresoGlobal = calcularProgresoPlanGlobal(planItems)

  return (
    <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">

        {/* ── Saludo y métricas ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-semibold text-gray-900">
            {new Date().getHours() < 12 ? t('home.greeting.morning') : new Date().getHours() < 18 ? t('home.greeting.afternoon') : t('home.greeting.evening')},{' '}
            <span className="text-sky-600">{datosBase.nombre.split(' ')[0]}</span> 👋
          </h1>
          <div className="flex items-center gap-3 mt-1">
            {dias !== null && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                {t('home.day').replace('{n}', String(dias))}
              </span>
            )}
            {datosBase.puesto && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <MapPin className="w-3.5 h-3.5" />
                {datosBase.puesto}
              </span>
            )}
          </div>
        </motion.div>

        {/* ── Progreso global ── */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0.95 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.05 }}
          className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5"
        >
          {/* Barra + porcentaje */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">
              {t('home.progress')}
            </p>
            <span className="text-xs font-mono text-gray-500 tabular-nums">{progresoPct}%</span>
          </div>
          <ProgressBar value={progresoPct} showPercentage={false} animated />

          {/* ── Tabs ── */}
          <div className="flex gap-1.5 mt-4">
            {TABS.map((tab, idx) => {
              const completado = estadoArray[idx]
              const desbloqueado = isModuloDesbloqueado(idx, estadoArray, false)
              const activo = tabActivo === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  disabled={!desbloqueado}
                  className={cn(
                    'relative flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-all duration-200',
                    'text-[11px] font-medium',
                    activo
                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                      : desbloqueado
                      ? 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 hover:text-gray-700'
                      : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed',
                  )}
                >
                  {/* Badge completado */}
                  {completado && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-teal-500 border-2 border-white flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">✓</span>
                    </span>
                  )}
                  {!desbloqueado && (
                    <Lock className="absolute -top-1.5 -right-1.5 w-3 h-3 text-gray-300" />
                  )}
                  <span className={cn(
                    'transition-colors',
                    activo ? 'text-[#0EA5E9]' : completado ? 'text-teal-600' : 'text-current',
                  )}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                  <span className="text-[9px] font-mono opacity-60">{tab.id}</span>
                </button>
              )
            })}
          </div>

          {/* ── Contenido del tab activo ── */}
          <div className="mt-5 overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={tabActivo}
                custom={direction}
                variants={tabContentVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {tabActivo === 'M1' && (
                  <TabPerfil
                    datos={datosBase}
                    equipo={equipo}
                    cargando={tabsCargando.has('M1')}
                  />
                )}
                {tabActivo === 'M2' && (
                  <TabCultura
                    bloques={bloquesProgreso}
                    totalBloques={totalBloquesCultura}
                    cargando={tabsCargando.has('M2')}
                  />
                )}
                {tabActivo === 'M3' && (
                  <TabRol
                    tareas={tareas}
                    cargando={tabsCargando.has('M3')}
                  />
                )}
                {tabActivo === 'M4' && (
                  <TabAsistente
                    conversaciones={conversaciones}
                    nombre={datosBase.nombre.split(' ')[0]}
                    cargando={tabsCargando.has('M4')}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── CTA hacia el módulo completo ── */}
          <div className="mt-5 pt-4 border-t border-gray-200">
            <Link
              href={TABS.find(t => t.id === tabActivo)?.href ?? '/empleado'}
              className={cn(
                'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium',
                'transition-all duration-200',
                isModuloDesbloqueado(
                  TABS.findIndex(t => t.id === tabActivo),
                  estadoArray,
                  false,
                )
                  ? 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-200 pointer-events-none',
              )}
            >
              Ver {TABS.find(t => t.id === tabActivo)?.label} completo
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        {/* ── Bloque B: Mi Plan 30-60-90 ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.1 }}
          className="mt-4"
        >
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">
                Mi Plan 30-60-90
              </h2>
              <Badge variant={faseActual === '30' ? 'teal' : faseActual === '60' ? 'amber' : 'indigo'}>
                Día {diaOnboarding} · {FASES_CONFIG[faseActual].titulo}
              </Badge>
            </div>

            <ProgressBar value={progresoGlobal} showPercentage animated />

            {/* 3 mini-cards de fases */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {(['30', '60', '90'] as const).map(fase => {
                const config = FASES_CONFIG[fase]
                const extras = COLOR_EXTRAS[config.color]
                const pct = calcularProgresoPlanFase(planItems, fase)
                const esActual = faseActual === fase

                return (
                  <div
                    key={fase}
                    className={cn(
                      'rounded-xl p-3 border transition-all',
                      esActual
                        ? cn(config.iconBg, extras.border)
                        : 'border-gray-200 bg-gray-50',
                    )}
                  >
                    <p className={cn(
                      'text-[10px] font-medium uppercase tracking-wider mb-1',
                      esActual ? config.iconText : 'text-gray-400',
                    )}>
                      {config.label}
                    </p>
                    <p className="text-lg font-semibold text-gray-900 tabular-nums">{pct}%</p>
                    <p className={cn(
                      'text-[10px] opacity-70',
                      esActual ? config.iconText : 'text-gray-300',
                    )}>
                      {config.titulo}
                    </p>
                  </div>
                )
              })}
            </div>

            <Link
              href="/empleado/plan"
              className="mt-3 text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1 transition-colors"
            >
              Ver plan completo <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </motion.div>

      </div>

      {/* ── Modal encuesta de pulso ── */}
      {encuestaPendiente && (
        <EncuestaPulsoModal
          encuesta={encuestaPendiente}
          onClose={() => setEncuestaPendiente(null)}
          onCompletada={() => setEncuestaPendiente(null)}
        />
      )}
    </div>
  )
}
