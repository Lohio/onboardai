'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Star, MessageSquare, Users, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ErrorState } from '@/components/shared/ErrorState'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

interface EncuestaRow {
  id: string
  dia_onboarding: number
  pregunta_1: string
  pregunta_2: string
  pregunta_3: string
  respuesta_1: number | null
  respuesta_2: number | null
  respuesta_3: number | null
  comentario: string | null
  completada: boolean
  respondida_at: string | null
  usuario: {
    nombre: string
    puesto?: string
  } | null
}

interface ResumenDia {
  dia: number
  total: number
  respondidas: number
  promedio1: number
  promedio2: number
  promedio3: number
  promedioGeneral: number
}

// ─────────────────────────────────────────────
// Animaciones
// ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 24 } },
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function promedioArr(nums: (number | null)[]): number {
  const validos = nums.filter((n): n is number => n !== null && n > 0)
  if (validos.length === 0) return 0
  return validos.reduce((a, b) => a + b, 0) / validos.length
}

function colorPromedio(p: number): string {
  if (p >= 4) return 'text-teal-400'
  if (p >= 3) return 'text-amber-400'
  return 'text-red-400'
}

function bgColorPromedio(p: number): string {
  if (p >= 4) return 'bg-teal-500/10 border-teal-500/20'
  if (p >= 3) return 'bg-amber-500/10 border-amber-500/20'
  return 'bg-red-500/10 border-red-500/20'
}

function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─────────────────────────────────────────────
// Componente: Estrellas solo lectura
// ─────────────────────────────────────────────

function EstrellasSoloLectura({ valor }: { valor: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= valor ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-white/15'}`}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Componente: Card de resumen por día
// ─────────────────────────────────────────────

function ResumenCard({ resumen }: { resumen: ResumenDia }) {
  const pct = resumen.total > 0 ? Math.round((resumen.respondidas / resumen.total) * 100) : 0
  return (
    <motion.div variants={itemVariants} className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35">
            Día {resumen.dia}
          </p>
          <p className={`text-2xl font-bold tabular-nums mt-0.5 ${colorPromedio(resumen.promedioGeneral)}`}>
            {resumen.promedioGeneral > 0 ? resumen.promedioGeneral.toFixed(1) : '—'}
          </p>
          <p className="text-[11px] text-white/30">promedio general</p>
        </div>
        <div className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${bgColorPromedio(resumen.promedioGeneral)} ${colorPromedio(resumen.promedioGeneral)}`}>
          {resumen.respondidas}/{resumen.total} respondidas
        </div>
      </div>

      {/* Barra de participación */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] text-white/30">Participación</span>
          <span className="text-[11px] text-white/40 tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
            className={`h-full rounded-full ${pct >= 70 ? 'bg-teal-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-500'}`}
          />
        </div>
      </div>

      {/* Promedios por pregunta */}
      {resumen.respondidas > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-white/[0.05]">
          {[resumen.promedio1, resumen.promedio2, resumen.promedio3].map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[11px] text-white/30 w-16 flex-shrink-0">P{i + 1}</span>
              <EstrellasSoloLectura valor={Math.round(p)} />
              <span className="text-[11px] text-white/40 tabular-nums ml-auto">{p.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="shimmer h-8 w-48 rounded-md" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="shimmer glass-card rounded-xl h-36" />)}
      </div>
      <div className="shimmer glass-card rounded-xl h-64" />
    </div>
  )
}

// ─────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────

type FiltroTab = 'todos' | '7' | '30' | '60'

export default function EncuestasAdminPage() {
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [encuestas, setEncuestas] = useState<EncuestaRow[]>([])
  const [tab, setTab] = useState<FiltroTab>('todos')

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setHasError(false)
    try {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: admin } = await supabase
        .from('usuarios')
        .select('empresa_id, rol')
        .eq('id', user.id)
        .single()

      if (!admin) return

      let query = supabase
        .from('encuestas_pulso')
        .select(`
          id, dia_onboarding,
          pregunta_1, pregunta_2, pregunta_3,
          respuesta_1, respuesta_2, respuesta_3,
          comentario, completada, respondida_at,
          usuario:usuarios!usuario_id(nombre, puesto)
        `)
        .order('respondida_at', { ascending: false })

      if (admin.rol !== 'dev') {
        query = query.eq('empresa_id', admin.empresa_id)
      }

      const { data } = await query
      setEncuestas((data ?? []) as unknown as EncuestaRow[])
    } catch (err) {
      console.error('[encuestas admin] Error:', err)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Skeleton />
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <ErrorState mensaje="No se pudieron cargar las encuestas." onRetry={cargarDatos} />
      </div>
    )
  }

  // Calcular resúmenes por día
  const dias = [7, 30, 60]
  const resumenes: ResumenDia[] = dias.map((dia) => {
    const del_dia = encuestas.filter((e) => e.dia_onboarding === dia)
    const respondidas = del_dia.filter((e) => e.completada)
    return {
      dia,
      total: del_dia.length,
      respondidas: respondidas.length,
      promedio1: promedioArr(respondidas.map((e) => e.respuesta_1)),
      promedio2: promedioArr(respondidas.map((e) => e.respuesta_2)),
      promedio3: promedioArr(respondidas.map((e) => e.respuesta_3)),
      promedioGeneral: promedioArr([
        ...respondidas.map((e) => e.respuesta_1),
        ...respondidas.map((e) => e.respuesta_2),
        ...respondidas.map((e) => e.respuesta_3),
      ]),
    }
  })

  // Filtrar encuestas respondidas para mostrar en tabla
  const respondidas = encuestas.filter((e) => e.completada)
  const filtradas = tab === 'todos'
    ? respondidas
    : respondidas.filter((e) => e.dia_onboarding === parseInt(tab))

  const totalRespondidas = respondidas.length
  const promedioGlobal = promedioArr([
    ...respondidas.map((e) => e.respuesta_1),
    ...respondidas.map((e) => e.respuesta_2),
    ...respondidas.map((e) => e.respuesta_3),
  ])

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-start gap-4">
          <Link
            href="/admin/reportes"
            className="mt-0.5 p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-white">Encuestas de pulso</h1>
            <p className="text-sm text-white/40 mt-0.5">Feedback de empleados en días 7, 30 y 60</p>
          </div>
          {totalRespondidas > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 text-white/40">
                <Users className="w-3.5 h-3.5" />
                <span>{totalRespondidas} respuestas</span>
              </div>
              <div className={`flex items-center gap-1.5 font-semibold ${colorPromedio(promedioGlobal)}`}>
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{promedioGlobal.toFixed(1)} / 5</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Resúmenes por día */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {resumenes.map((r) => (
            <ResumenCard key={r.dia} resumen={r} />
          ))}
        </div>

        {/* Tabla de respuestas */}
        {respondidas.length === 0 ? (
          <motion.div variants={itemVariants} className="glass-card rounded-xl p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-5 h-5 text-white/20" />
            </div>
            <p className="text-sm text-white/40">Aún no hay encuestas respondidas</p>
            <p className="text-xs text-white/25 mt-1">
              Las encuestas aparecen automáticamente en el día 7, 30 y 60 del onboarding
            </p>
          </motion.div>
        ) : (
          <motion.div variants={itemVariants} className="glass-card rounded-xl overflow-hidden">
            {/* Tabs filtro */}
            <div className="flex items-center gap-1 px-4 pt-4 border-b border-white/[0.06] pb-3">
              <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mr-2">Filtrar:</p>
              {(['todos', '7', '30', '60'] as FiltroTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors font-medium
                    ${tab === t
                      ? 'bg-[#0EA5E9]/20 text-[#7DD3FC] border border-[#0EA5E9]/30'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                    }`}
                >
                  {t === 'todos' ? 'Todos' : `Día ${t}`}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-white/25">{filtradas.length} entradas</span>
            </div>

            {/* Lista */}
            <div className="divide-y divide-white/[0.04]">
              {filtradas.map((enc) => {
                const promedio = promedioArr([enc.respuesta_1, enc.respuesta_2, enc.respuesta_3])
                return (
                  <div key={enc.id} className="px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate">
                          {enc.usuario?.nombre ?? 'Empleado'}
                        </p>
                        {enc.usuario?.puesto && (
                          <p className="text-xs text-white/30 truncate">{enc.usuario.puesto}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-md">
                          Día {enc.dia_onboarding}
                        </span>
                        <span className={`text-sm font-semibold tabular-nums ${colorPromedio(promedio)}`}>
                          {promedio.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Preguntas y respuestas */}
                    <div className="space-y-1.5 mb-2">
                      {[
                        { p: enc.pregunta_1, r: enc.respuesta_1 },
                        { p: enc.pregunta_2, r: enc.respuesta_2 },
                        { p: enc.pregunta_3, r: enc.respuesta_3 },
                      ].map(({ p, r }, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <p className="text-xs text-white/40 flex-1 leading-snug truncate">{p}</p>
                          {r !== null && <EstrellasSoloLectura valor={r} />}
                        </div>
                      ))}
                    </div>

                    {/* Comentario */}
                    {enc.comentario && (
                      <div className="mt-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-xs text-white/50 leading-relaxed italic">
                          &ldquo;{enc.comentario}&rdquo;
                        </p>
                      </div>
                    )}

                    <p className="text-[11px] text-white/20 mt-2">
                      Respondida el {formatFecha(enc.respondida_at)}
                    </p>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
