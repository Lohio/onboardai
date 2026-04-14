// GET /api/billing/status
// Retorna el estado de suscripción de la empresa del admin autenticado.
// Resiliente: funciona aunque billing.sql no se haya ejecutado todavía.

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('empresa_id, rol')
      .eq('id', user.id)
      .single()

    if (!usuario || usuario.rol !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // Seleccionar solo columnas que siempre existen + las de billing de forma segura
    const { data: empresa } = await supabase
      .from('empresas')
      .select('plan, nombre')
      .eq('id', usuario.empresa_id)
      .single()

    if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    // Intentar columnas de billing (solo existen si se ejecutó billing.sql)
    let billingExtra = {
      plan_empleados: 3,
      suscripcion_estado: 'trial',
      suscripcion_inicio: null as string | null,
      suscripcion_fin: null as string | null,
      proveedor_pago: null as string | null,
      stripe_customer_id: null as string | null,
    }

    try {
      const { data: billingData } = await supabase
        .from('empresas')
        .select('plan_empleados, suscripcion_estado, suscripcion_inicio, suscripcion_fin, proveedor_pago, stripe_customer_id')
        .eq('id', usuario.empresa_id)
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
    } catch {
      // Columnas de billing aún no existen — usamos defaults
    }

    // Contar empleados activos
    const { count } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', usuario.empresa_id)
      .eq('rol', 'empleado')

    return NextResponse.json({
      plan: empresa.plan ?? 'trial',
      ...billingExtra,
      empleados_activos: count ?? 0,
    })
  } catch (err) {
    console.error('[billing/status]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
