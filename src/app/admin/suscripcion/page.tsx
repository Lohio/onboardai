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
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { PLANES, calcularCostoMensual, getPlanFeatureList } from '@/lib/billing'
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

const PLAN_COLORS: Record<PlanId, string> = {
  trial: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  pro: 'from-[#0EA5E9]/20 to-[#3B4FD8]/10 border-[#0EA5E9]/30',
  enterprise: 'from-violet-500/20 to-violet-600/10 border-violet-500/30',
}

const PLAN_BADGE: Record<PlanId, string> = {
  trial: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  pro: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
  enterprise: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
}

function formatFecha(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Selector de proveedor ────────────────────────────────────────────────────

function ProveedorSelector({
  proveedor,
  onChange,
}: {
  proveedor: ProveedorPago
  onChange: (p: ProveedorPago) => void
}) {
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
          {p === 'stripe' ? 'Tarjeta / Internacional' : 'MercadoPago (LATAM)'}
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
}: {
  planId: PlanId
  actual: PlanId
  empleadosActivos: number
  onSelect: (planId: PlanId) => void
  loading: boolean
}) {
  const plan = PLANES[planId]
  const features = getPlanFeatureList(planId)
  const esPlanActual = planId === actual
  const costo = calcularCostoMensual(planId, empleadosActivos)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl border bg-gradient-to-br p-5 flex flex-col gap-4
        ${PLAN_COLORS[planId]}
        ${esPlanActual ? 'ring-2 ring-[#0EA5E9]/30' : ''}
      `}
    >
      {/* Badge plan actual */}
      {esPlanActual && (
        <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full
          bg-[#0EA5E9]/15 text-[#38BDF8] border border-[#0EA5E9]/25">
          Plan actual
        </span>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${PLAN_BADGE[planId]}`}>
          {PLAN_ICONS[planId]}
        </div>
        <div>
          <h3 className="text-sm font-bold text-white/90">{plan.nombre}</h3>
          <p className="text-xs text-white/40">
            {plan.precioUSD === 0 ? 'Gratis' : `$${plan.precioUSD} USD/mes`}
            {plan.extraPorEmpleado > 0 && ` + $${plan.extraPorEmpleado}/empleado extra`}
          </p>
        </div>
      </div>

      {/* Costo calculado */}
      {planId !== 'trial' && (
        <div className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <p className="text-[11px] text-white/40">
            Con {empleadosActivos} empleados activos
          </p>
          <p className="text-lg font-bold text-white/85">
            ${costo} <span className="text-xs font-normal text-white/35">USD/mes</span>
          </p>
        </div>
      )}

      {/* Features */}
      <ul className="space-y-1.5 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-xs text-white/60">
            <Check className="w-3.5 h-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
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
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
            bg-[#0EA5E9] hover:bg-[#0284C7] text-white transition-colors duration-150
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Activar {plan.nombre}
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

  useEffect(() => {
    if (searchParams.get('success') === '1') {
      toast.success('¡Suscripción activada! Bienvenido al plan Pro.')
    } else if (searchParams.get('canceled') === '1') {
      toast('Pago cancelado.')
    } else if (searchParams.get('pending') === '1') {
      toast('Pago pendiente de acreditación.')
    }
  }, [searchParams])

  return null
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SuscripcionPage() {
  const [status, setStatus] = useState<SuscripcionStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [proveedor, setProveedor] = useState<ProveedorPago>('stripe')

  const cargarStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/status')
      if (!res.ok) throw new Error('Error cargando suscripción')
      const data = await res.json() as SuscripcionStatus
      setStatus(data)
    } catch (err) {
      console.error(err)
      toast.error('No se pudo cargar la suscripción')
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => { cargarStatus() }, [cargarStatus])

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
      toast.error(err instanceof Error ? err.message : 'Error al iniciar pago')
      setLoadingCheckout(false)
    }
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
      toast.error('No se pudo abrir el portal de facturación')
    } finally {
      setLoadingPortal(false)
    }
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
        <h1 className="text-xl font-bold text-white/90">Suscripción</h1>
        <p className="text-sm text-white/45 mt-0.5">Gestioná tu plan y facturación</p>
      </div>

      {/* ── Estado actual ── */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white/70">Estado actual</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Plan', value: planActual.nombre, badge: PLAN_BADGE[status.plan] },
            { label: 'Empleados activos', value: `${status.empleados_activos}`, badge: null },
            { label: 'Estado', value: status.suscripcion_estado, badge: null },
            { label: 'Activo desde', value: formatFecha(status.suscripcion_inicio), badge: null },
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
              Empleados en onboarding
            </span>
            <span>{status.empleados_activos} / {planActual.empleadosIncluidos} incluidos</span>
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
            {loadingPortal ? 'Abriendo portal...' : 'Gestionar facturación en Stripe →'}
          </button>
        )}
      </div>

      {/* ── Planes disponibles ── */}
      {status.plan === 'trial' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-semibold text-white/70">Elegí tu plan</h2>
            <ProveedorSelector proveedor={proveedor} onChange={setProveedor} />
          </div>

          {/* Aviso proveedor MP */}
          {proveedor === 'mercadopago' && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl
              bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/80">
                MercadoPago procesa pagos únicos. Para renovación automática contactá a{' '}
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
              />
            ))}
          </div>
        </div>
      )}

      {/* Si ya tiene plan pago, mostrar solo el plan actual + opción de cambiar */}
      {status.plan !== 'trial' && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white/70">Tu plan</h2>
          <div className="max-w-sm">
            <PlanCard
              planId={status.plan}
              actual={status.plan}
              empleadosActivos={status.empleados_activos}
              onSelect={handleSelectPlan}
              loading={loadingCheckout}
            />
          </div>
          <p className="text-xs text-white/35">
            Para cambiar o cancelar tu plan, usá el portal de facturación de Stripe arriba.
          </p>
        </div>
      )}
    </div>
  )
}
