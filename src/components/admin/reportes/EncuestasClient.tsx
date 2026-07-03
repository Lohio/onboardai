'use client'

// Client Component de la vista de encuestas de pulso (admin).
// Recibe los datos iniciales por props (cargados server-side en page.tsx)
// e inicializa el estado con ellos — sin useEffect de carga inicial.
// El retry re-ejecuta cargarEncuestasAdmin client-side con createClient().

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Star, MessageSquare, Users, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { ErrorState } from '@/components/shared/ErrorState'
import { useLanguage } from '@/components/LanguageProvider'
import { cargarEncuestasAdmin } from '@/lib/encuestasAdmin'
import type { EncuestaRow, DatosEncuestasAdmin } from '@/lib/encuestasAdmin'

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

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
  const { t } = useLanguage()
  const pct = resumen.total > 0 ? Math.round((resumen.respondidas / resumen.total) * 100) : 0
  return (
    <motion.div variants={itemVariants} className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35">
            {t('adminEnc.dia')} {resumen.dia}
          </p>
          <p className={`text-2xl font-bold tabular-nums mt-0.5 ${colorPromedio(resumen.promedioGeneral)}`}>
            {resumen.promedioGeneral > 0 ? resumen.promedioGeneral.toFixed(1) : '—'}
          </p>
          <p className="text-[11px] text-white/30">{t('adminEnc.promedioGeneral')}</p>
        </div>
        <div className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${bgColorPromedio(resumen.promedioGeneral)} ${colorPromedio(resumen.promedioGeneral)}`}>
          {resumen.respondidas}/{resumen.total} {t('adminEnc.respondidas')}
        </div>
      </div>

      {/* Barra de participación */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] text-white/30">{t('adminEnc.participacion')}</span>
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
// Componente principal
// ─────────────────────────────────────────────

type FiltroTab = 'todos' | '7' | '30' | '60'

interface EncuestasClientProps {
  empresaId: string | null
  rol: string
  datosIniciales: DatosEncuestasAdmin
  errorInicial: boolean
}

export function EncuestasClient({ empresaId, rol, datosIniciales, errorInicial }: EncuestasClientProps) {
  const router = useRouter()
  const { t } = useLanguage()

  const [hasError, setHasError] = useState(errorInicial)
  const [encuestas, setEncuestas] = useState<EncuestaRow[]>(datosIniciales.encuestas)
  const [tab, setTab] = useState<FiltroTab>('todos')

  // ── Retry client-side ──
  const cargarDatos = useCallback(async () => {
    setHasError(false)
    try {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: admin } = await supabase
        .from('usuarios')
        .select('empresa_id, rol')
        .eq('id', user.id)
        .single()

      if (!admin) { router.push('/auth/login'); return }

      const datos = await cargarEncuestasAdmin(supabase, admin.empresa_id ?? empresaId, admin.rol ?? rol)
      setEncuestas(datos.encuestas)
    } catch (err) {
      console.error('[encuestas admin] Error:', err)
      setHasError(true)
    }
  }, [router, empresaId, rol])

  if (hasError) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <ErrorState mensaje={t('adminEnc.errorCargar')} onRetry={cargarDatos} />
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
            <h1 className="text-xl font-semibold text-white">{t('adminEnc.titulo')}</h1>
            <p className="text-sm text-white/40 mt-0.5">{t('adminEnc.subtitulo')}</p>
          </div>
          {totalRespondidas > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 text-white/40">
                <Users className="w-3.5 h-3.5" />
                <span>{totalRespondidas} {t('adminEnc.respuestas')}</span>
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
            <p className="text-sm text-white/40">{t('adminEnc.emptyTitulo')}</p>
            <p className="text-xs text-white/25 mt-1">
              {t('adminEnc.emptyDesc')}
            </p>
          </motion.div>
        ) : (
          <motion.div variants={itemVariants} className="glass-card rounded-xl overflow-hidden">
            {/* Tabs filtro */}
            <div className="flex items-center gap-1 px-4 pt-4 border-b border-white/[0.06] pb-3">
              <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider mr-2">{t('adminEnc.filtrar')}</p>
              {(['todos', '7', '30', '60'] as FiltroTab[]).map((ft) => (
                <button
                  key={ft}
                  onClick={() => setTab(ft)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors font-medium
                    ${tab === ft
                      ? 'bg-[#0EA5E9]/20 text-[#7DD3FC] border border-[#0EA5E9]/30'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                    }`}
                >
                  {ft === 'todos' ? t('adminEnc.todos') : t('adminEnc.dia') + ' ' + ft}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-white/25">{filtradas.length} {t('adminEnc.entradas')}</span>
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
                          {enc.usuario?.nombre ?? t('adminEnc.empleado')}
                        </p>
                        {enc.usuario?.puesto && (
                          <p className="text-xs text-white/30 truncate">{enc.usuario.puesto}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] text-white/30 bg-white/[0.04] px-2 py-0.5 rounded-md">
                          {t('adminEnc.dia')} {enc.dia_onboarding}
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
                      {t('adminEnc.respondidaEl')} {formatFecha(enc.respondida_at)}
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
