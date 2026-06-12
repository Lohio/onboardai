// GET /api/billing/status
// Retorna el estado de suscripción de la empresa del admin autenticado.
// Resiliente: funciona aunque billing.sql no se haya ejecutado todavía.

import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { ApiError } from '@/lib/errors'

export const GET = withHandler(
  {
    auth: 'session',
    rol: 'admin',
    bodyType: 'none',
  },
  async ({ supabase, user, requestId }) => {
    // Seleccionar solo columnas que siempre existen + las de billing de forma segura
    const { data: empresa } = await supabase
      .from('empresas')
      .select('plan, nombre')
      .eq('id', user!.empresaId)
      .single()

    if (!empresa) return ApiError.notFound('Empresa', requestId)

    // Intentar columnas de billing (solo existen si se ejecutó billing.sql)
    let billingExtra = {
      plan_empleados: 3,
      suscripcion_estado: 'trial',
      suscripcion_inicio: null as string | null,
      suscripcion_fin: null as string | null,
      proveedor_pago: null as string | null,
      stripe_customer_id: null as string | null,
    }

    // Si las columnas no existen la query falla y billingData es null — usamos defaults
    const { data: billingData } = await supabase
      .from('empresas')
      .select('plan_empleados, suscripcion_estado, suscripcion_inicio, suscripcion_fin, proveedor_pago, stripe_customer_id')
      .eq('id', user!.empresaId)
      .single()

    if (billingData) {
      billingExtra = {
        plan_empleados:     billingData.plan_empleados ?? 3,
        suscripcion_estado: billingData.suscripcion_estado ?? 'trial',
        suscripcion_inicio: billingData.suscripcion_inicio ?? null,
        suscripcion_fin:    billingData.suscripcion_fin ?? null,
        proveedor_pago:     billingData.proveedor_pago ?? null,
        stripe_customer_id: billingData.stripe_customer_id ?? null,
      }
    }

    // Contar empleados activos
    const { count } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', user!.empresaId)
      .eq('rol', 'empleado')

    const VALID_PLANS = ['trial', 'pro', 'enterprise']
    const planNormalizado = VALID_PLANS.includes(empresa.plan ?? '') ? empresa.plan : 'trial'

    return NextResponse.json({
      plan: planNormalizado,
      ...billingExtra,
      empleados_activos: count ?? 0,
    })
  }
)
