// GET /api/billing/status
// Retorna el estado de suscripción de la empresa del admin autenticado

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

    const { data: empresa } = await supabase
      .from('empresas')
      .select('plan, plan_empleados, suscripcion_estado, suscripcion_inicio, suscripcion_fin, proveedor_pago, stripe_customer_id')
      .eq('id', usuario.empresa_id)
      .single()

    if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    // Contar empleados activos
    const { count } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', usuario.empresa_id)
      .eq('rol', 'empleado')

    return NextResponse.json({
      ...empresa,
      empleados_activos: count ?? 0,
    })
  } catch (err) {
    console.error('[billing/status]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
