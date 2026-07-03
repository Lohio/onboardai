'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard,
  Zap,
  Building2,
  Check,
  Users,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  Bot,
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { PLANES, calcularCostoMensual, getPlanFeatureList, cuotaIA } from '@/lib/billing'
import { createClient } from '@/lib/supabase'
import { useContext } from 'react'
import { ThemeContext } from '@/components/ThemeProvider'
import { useLanguage } from '@/components/LanguageProvider'
import type { PlanId, ProveedorPago } from '@/types'

// ─── Estado de suscripción desde API ─────────────────────────────────────────

interface SuscripcionStatus {
  plan: PlanId
  plan_empleados: number
  suscripcion_estado: string
  suscripcion_inicio?: string | null
  proveedor_pago?: string | null
  stripe_customer_id?: string | null
  empleados_activos: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PLAN_ICONS: Record<PlanId, React.ReactNode> = {
  trial: <Zap className="w-5 h-5" />,
  pro: <CreditCard className="w-5 h-5" />,
  enterprise: <Building2 className="w-5 h-5" />,
}

type PlanCfg = {
  card: string; icon: string; title: string; price: string
  feature: string; check: string; costBox: string
  costValue: string; costUnit: string; cta: string; badge: string
}

// Paleta dark (default)
const PLAN_CFG_DARK: Record<PlanId, PlanCfg> = {
  trial: {
    card:      'bg-zinc-500/30 border-zinc-400/40',
    icon:      'bg-zinc-400/40 border-zinc-300/30 text-white',
    title:     'text-white/90',
    price:     'text-white/50',
    feature:   'text-white/70',
    check:     'text-zinc-300',
    costBox:   'bg-zinc-400/20 border-zinc-300/20',
    costValue: 'text-white/90',
    costUnit:  'text-white/40',
    cta:       'bg-zinc-300 hover:bg-zinc-200 text-zinc-900',
    badge:     'bg-zinc-300/20 text-zinc-200 border-zinc-300/30',
  },
  pro: {
    card:      'bg-zinc-600/50 border-zinc-500/50',
    icon:      'bg-zinc-500/50 border-zinc-400/40 text-white',
    title:     'text-white/95',
    price:     'text-white/60',
    feature:   'text-white/70',
    check:     'text-zinc-200',
    costBox:   'bg-zinc-500/30 border-zinc-400/30',
    costValue: 'text-white/95',
    costUnit:  'text-white/50',
    cta:       'bg-zinc-300 hover:bg-zinc-200 text-zinc-900',
    badge:     'bg-zinc-400/30 text-zinc-100 border-zinc-400/40',
  },
  enterprise: {
    card:      'bg-zinc-950 border-zinc-800',
    icon:      'bg-zinc-800 border-zinc-700 text-zinc-300',
    title:     'text-white',
    price:     'text-zinc-400',
    feature:   'text-zinc-400',
    check:     'text-zinc-500',
    costBox:   'bg-zinc-800/80 border-zinc-700',
    costValue: 'text-white',
    costUnit:  'text-zinc-500',
    cta:       'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-300',
    badge:     'bg-zinc-800 text-zinc-300 border-zinc-700',
  },
}

// Paleta light — máximo contraste, sin depender de CSS variants
const PLAN_CFG_LIGHT: Record<PlanId, PlanCfg> = {
  trial: {
    card:      'bg-zinc-100 border-zinc-300',
    icon:      'bg-zinc-300 border-zinc-400 text-zinc-700',
    title:     'text-zinc-900',
    price:     'text-zinc-600',
    feature:   'text-zinc-800',
    check:     'text-zinc-600',
    costBox:   'bg-zinc-200 border-zinc-300',
    costValue: 'text-zinc-900',
    costUnit:  'text-zinc-600',
    cta:       'bg-zinc-800 hover:bg-zinc-700 text-[#fff]',
    badge:     'bg-zinc-300 text-zinc-800 border-zinc-400',
  },
  pro: {
    card:      'bg-zinc-300 border-zinc-400',
    icon:      'bg-zinc-500 border-zinc-600 text-[#fff]',
    title:     'text-zinc-950',
    price:     'text-zinc-700',
    feature:   'text-zinc-900',
    check:     'text-zinc-700',
    costBox:   'bg-zinc-200 border-zinc-400',
    costValue: 'text-zinc-950',
    costUnit:  'text-zinc-600',
    cta:       'bg-zinc-800 hover:bg-zinc-700 text-[#fff]',
    badge:     'bg-zinc-500 text-[#fff] border-zinc-600',
  },
  enterprise: {
    // Siempre oscuro — text-[#fff] evita el override !important de globals.css
    card:      'bg-zinc-900 border-zinc-800',
    icon:      'bg-zinc-800 border-zinc-700 text-zinc-300',
    title:     'text-[#fff]',
    price:     'text-zinc-400',
    feature:   'text-zinc-300',
    check:     'text-zinc-400',
    costBox:   'bg-zinc-800/80 border-zinc-700',
    costValue: 'text-[#fff]',
    costUnit:  'text-zinc-400',
    cta:       'bg-[#fff] hover:bg-zinc-100 text-zinc-900',
    badge:     'bg-zinc-800 text-zinc-300 border-zinc-700',
  },
}

function getPlanCfg(planId: PlanId, isLight: boolean): PlanCfg {
  return isLight ? PLAN_CFG_LIGHT[planId] : PLAN_CFG_DARK[planId]
}

function formatFecha(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Primer día del mes actual en formato YYYY-MM-01 (coincide con la columna `mes`) */
function primerDiaMesActual(): string {
  const ahora = new Date()
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-01`
}

// ─── Card de uso del asistente IA ─────────────────────────────────────────────

interface UsoIAMes {
  consultas: number
  input_tokens: number
  output_tokens: number
}

function UsoIACard({
  uso,
  loading,
  plan,
}: {
  uso: UsoIAMes | null
  loading: boolean
  plan: PlanId
}) {
  const { t } = useLanguage()
  const limite = cuotaIA(plan)
  const consultas = uso?.consultas ?? 0
  const pct = limite > 0 ? Math.min(100, Math.round((consultas / limite) * 100)) : 0

  // Semáforo de consumo (invertido): <70% bien (teal), 70–89% atención (amber), ≥90% crítico (rojo)
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-[#0D9488]'
  const tokensMes = (uso?.input_tokens ?? 0) + (uso?.output_tokens ?? 0)

  const scrollAPlanes = () => {
    document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white/70">
        <Bot className="w-4 h-4 text-[#0D9488]" />
        {t('adminSusc.usoIA')}
      </h2>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-4 h-4 border-2 border-[#0EA5E9]/30 border-t-[#0EA5E9] rounded-full animate-spin" />
        </div>
      ) : consultas === 0 ? (
        /* Empty state: sin uso este mes */
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Bot className="w-7 h-7 text-white/10" />
          <p className="text-sm text-white/40">{t('adminSusc.sinUso')}</p>
          <p className="text-xs text-white/25">
            {t('adminSusc.consultasIncluidasPre') + ' ' + limite.toLocaleString('es-AR') + ' ' + t('adminSusc.consultasIncluidasPost')}
          </p>
        </div>
      ) : (
        <>
          {/* Barra de progreso de consultas */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-white/40">
              <span>{t('adminSusc.consultasMes')}</span>
              <span className="font-mono">
                {consultas.toLocaleString('es-AR')} / {limite.toLocaleString('es-AR')}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Tokens del mes */}
          <p className="text-[11px] text-white/35">
            {t('adminSusc.tokensMes')}{' '}
            <span className="font-mono text-white/55">{tokensMes.toLocaleString('es-AR')}</span>
          </p>

          {/* Aviso de consumo alto con CTA */}
          {pct >= 80 && (
            <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border
              ${pct >= 90
                ? 'bg-red-500/10 border-red-500/20'
                : 'bg-amber-500/10 border-amber-500/20'
              }`}
            >
              <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${pct >= 90 ? 'text-red-400' : 'text-amber-400'}`} />
              <div className="flex-1 space-y-1.5">
                <p className={`text-xs ${pct >= 90 ? 'text-red-300/80' : 'text-amber-300/80'}`}>
                  {t('adminSusc.usastePre') + ' ' + pct + t('adminSusc.usastePost')}
                </p>
                <button
                  type="button"
                  onClick={scrollAPlanes}
                  className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors duration-150
                    ${pct >= 90 ? 'text-red-300 hover:text-red-200' : 'text-amber-300 hover:text-amber-200'}`}
                >
                  {t('adminSusc.mejorarPlan')}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Selector de proveedor ────────────────────────────────────────────────────

function ProveedorSelector({
  proveedor,
  onChange,
}: {
  proveedor: ProveedorPago
  onChange: (p: ProveedorPago) => void
}) {
  const { t } = useLanguage()
  return (
    <div className="flex gap-2">
      {(['stripe', 'mercadopago'] as ProveedorPago[]).map(p => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150
            ${proveedor === p
              ? 'bg-[#0EA5E9]/15 text-[#38BDF8] border-[#0EA5E9]/40'
              : 'text-white/40 border-white/10 hover:text-white/70 hover:border-white/20'
            }`}
        >
          {p === 'stripe' ? t('adminSusc.provTarjeta') : t('adminSusc.provMP')}
        </button>
      ))}
    </div>
  )
}

// ─── Tarjeta de plan ──────────────────────────────────────────────────────────

function PlanCard({
  planId,
  actual,
  empleadosActivos,
  onSelect,
  loading,
  isLight,
}: {
  planId: PlanId
  actual: PlanId
  empleadosActivos: number
  onSelect: (planId: PlanId) => void
  loading: boolean
  isLight: boolean
}) {
  const { t } = useLanguage()
  const plan = PLANES[planId] ?? PLANES.trial
  const cfg = getPlanCfg(planId, isLight)
  const features = getPlanFeatureList(planId)
  const esPlanActual = planId === actual
  const costo = calcularCostoMensual(planId, empleadosActivos)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl border p-5 flex flex-col gap-4
        ${cfg.card}
        ${esPlanActual ? 'ring-2 ring-white/20' : ''}
      `}
    >
      {/* Badge plan actual */}
      {esPlanActual && (
        <span className={`absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
          {t('adminSusc.planActual')}
        </span>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${cfg.icon}`}>
          {PLAN_ICONS[planId]}
        </div>
        <div>
          <h3 className={`text-sm font-bold ${cfg.title}`}>{plan.nombre}</h3>
          <p className={`text-xs ${cfg.price}`}>
            {plan.precioUSD === 0 ? t('adminSusc.gratis') : `$${plan.precioUSD} ` + t('adminSusc.usdMes')}
            {plan.extraPorEmpleado > 0 && ` + $${plan.extraPorEmpleado}` + t('adminSusc.extraEmpleado')}
          </p>
        </div>
      </div>

      {/* Costo calculado */}
      {planId !== 'trial' && (
        <div className={`px-3 py-2 rounded-xl border ${cfg.costBox}`}>
          <p className={`text-[11px] ${cfg.price}`}>
            {t('adminSusc.conPre') + ' ' + empleadosActivos + ' ' + t('adminSusc.conPost')}
          </p>
          <p className={`text-lg font-bold ${cfg.costValue}`}>
            ${costo} <span className={`text-xs font-normal ${cfg.costUnit}`}>{t('adminSusc.usdMes')}</span>
          </p>
        </div>
      )}

      {/* Features */}
      <ul className="space-y-1.5 flex-1">
        {features.map(f => (
          <li key={f} className={`flex items-start gap-2 text-xs ${cfg.feature}`}>
            <Check className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${cfg.check}`} />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      {planId !== 'trial' && !esPlanActual && (
        <button
          type="button"
          onClick={() => onSelect(planId)}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
            transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${cfg.cta}`}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : (
            <>
              {t('adminSusc.activar') + ' ' + plan.nombre}
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </motion.div>
  )
}

// ─── Feedback de retorno desde checkout (necesita Suspense) ──────────────────

function CheckoutFeedback() {
  const searchParams = useSearchParams()
  const { t } = useLanguage()

  useEffect(() => {
    if (searchParams.get('success') === '1') {
      toast.success(t('adminSusc.toastActivada'))
    } else if (searchParams.get('canceled') === '1') {
      toast(t('adminSusc.toastCancelado'))
    } else if (searchParams.get('pending') === '1') {
      toast(t('adminSusc.toastPendiente'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return null
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SuscripcionPage() {
  const { t } = useLanguage()
  const { currentTheme } = useContext(ThemeContext)
  const isLight = currentTheme === 'theme-light' || currentTheme === 'theme-gray'

  const [status, setStatus] = useState<SuscripcionStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [proveedor, setProveedor] = useState<ProveedorPago>('stripe')
  const [uso, setUso] = useState<UsoIAMes | null>(null)
  const [loadingUso, setLoadingUso] = useState(true)

  const cargarStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/status')
      if (!res.ok) throw new Error('Error cargando suscripción')
      const data = await res.json() as SuscripcionStatus
      setStatus(data)
    } catch (err) {
      console.error(err)
      toast.error(t('adminSusc.errorCargar'))
    } finally {
      setLoadingStatus(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carga no bloqueante del uso mensual de IA — si la tabla no existe aún, se muestra 0
  const cargarUso = useCallback(async () => {
    setLoadingUso(true)
    const sinUso: UsoIAMes = { consultas: 0, input_tokens: 0, output_tokens: 0 }
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setUso(sinUso); return }

      const { data: perfil } = await supabase
        .from('usuarios')
        .select('empresa_id')
        .eq('id', user.id)
        .single()
      if (!perfil?.empresa_id) { setUso(sinUso); return }

      const { data, error } = await supabase
        .from('uso_mensual_ia')
        .select('consultas, input_tokens, output_tokens')
        .eq('empresa_id', perfil.empresa_id)
        .eq('mes', primerDiaMesActual())
        .maybeSingle()

      if (error) {
        console.warn('[Suscripcion] uso_mensual_ia:', error.message)
        setUso(sinUso)
        return
      }
      setUso((data as UsoIAMes | null) ?? sinUso)
    } catch (err) {
      console.warn('[Suscripcion] uso IA:', err)
      setUso(sinUso)
    } finally {
      setLoadingUso(false)
    }
  }, [])

  useEffect(() => { cargarStatus() }, [cargarStatus])
  useEffect(() => { cargarUso() }, [cargarUso])

  const handleSelectPlan = useCallback(async (planId: PlanId) => {
    setLoadingCheckout(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, proveedor }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Error generando checkout')
      window.location.href = data.url
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : t('adminSusc.errorPago'))
      setLoadingCheckout(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedor])

  const handlePortal = useCallback(async () => {
    setLoadingPortal(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Error')
      window.location.href = data.url
    } catch (err) {
      console.error(err)
      toast.error(t('adminSusc.errorPortal'))
    } finally {
      setLoadingPortal(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-5 h-5 border-2 border-[#0EA5E9]/30 border-t-[#0EA5E9] rounded-full animate-spin" />
      </div>
    )
  }

  if (!status) return null

  const planActual = PLANES[status.plan] ?? PLANES.trial

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Suspense fallback={null}>
        <CheckoutFeedback />
      </Suspense>

      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold text-white/90">{t('adminSusc.titulo')}</h1>
        <p className="text-sm text-white/45 mt-0.5">{t('adminSusc.subtitulo')}</p>
      </div>

      {/* ── Estado actual ── */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white/70">{t('adminSusc.estadoActual')}</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t('adminSusc.plan'), value: planActual.nombre, badge: getPlanCfg(status.plan, isLight).badge },
            { label: t('adminSusc.empleadosActivos'), value: `${status.empleados_activos}`, badge: null },
            { label: t('adminSusc.estado'), value: status.suscripcion_estado, badge: null },
            { label: t('adminSusc.activoDesde'), value: formatFecha(status.suscripcion_inicio), badge: null },
          ].map(({ label, value, badge }) => (
            <div key={label} className="flex flex-col gap-1">
              <p className="text-[11px] text-white/35">{label}</p>
              {badge ? (
                <span className={`self-start text-xs font-semibold px-2 py-0.5 rounded-full border ${badge}`}>
                  {value}
                </span>
              ) : (
                <p className="text-sm font-semibold text-white/80">{value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Barra uso empleados */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-white/40">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {t('adminSusc.empleadosOnboarding')}
            </span>
            <span>{status.empleados_activos} / {planActual.empleadosIncluidos} {t('adminSusc.incluidos')}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#0EA5E9] transition-all duration-500"
              style={{ width: `${Math.min(100, (status.empleados_activos / planActual.empleadosIncluidos) * 100)}%` }}
            />
          </div>
        </div>

        {/* Botón portal Stripe */}
        {status.stripe_customer_id && status.plan !== 'trial' && (
          <button
            type="button"
            onClick={handlePortal}
            disabled={loadingPortal}
            className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80
              transition-colors duration-150 disabled:opacity-50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {loadingPortal ? t('adminSusc.abriendoPortal') : t('adminSusc.gestionarStripe')}
          </button>
        )}
      </div>

      {/* ── Uso del asistente IA ── */}
      <UsoIACard uso={uso} loading={loadingUso} plan={status.plan} />

      {/* ── Planes disponibles ── */}
      {status.plan === 'trial' && (
        <div id="planes" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-semibold text-white/70">{t('adminSusc.elegiPlan')}</h2>
            <ProveedorSelector proveedor={proveedor} onChange={setProveedor} />
          </div>

          {/* Aviso proveedor MP */}
          {proveedor === 'mercadopago' && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl
              bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/80">
                {t('adminSusc.avisoMP')}{' '}
                <a href="mailto:hola@heero.la" className="underline">hola@heero.la</a>.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['trial', 'pro', 'enterprise'] as PlanId[]).map(id => (
              <PlanCard
                key={id}
                planId={id}
                actual={status.plan}
                empleadosActivos={status.empleados_activos}
                onSelect={handleSelectPlan}
                loading={loadingCheckout}
                isLight={isLight}
              />
            ))}
          </div>
        </div>
      )}

      {/* Si ya tiene plan pago, mostrar solo el plan actual + opción de cambiar */}
      {status.plan !== 'trial' && (
        <div id="planes" className="space-y-4">
          <h2 className="text-sm font-semibold text-white/70">{t('adminSusc.tuPlan')}</h2>
          <div className="max-w-sm">
            <PlanCard
              planId={status.plan}
              actual={status.plan}
              empleadosActivos={status.empleados_activos}
              onSelect={handleSelectPlan}
              loading={loadingCheckout}
              isLight={isLight}
            />
          </div>
          <p className="text-xs text-white/35">
            {t('adminSusc.cambiarPlanNota')}
          </p>
        </div>
      )}
    </div>
  )
}
