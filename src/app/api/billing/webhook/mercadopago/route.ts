// POST /api/billing/webhook/mercadopago
// Webhook handler para notificaciones de MercadoPago

import { NextRequest, NextResponse } from 'next/server'
import { getMPPayment } from '@/lib/mercadopago-server'
import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { type: string; data?: { id?: string } }

    // Solo procesar notificaciones de pago
    if (body.type !== 'payment' || !body.data?.id) {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data.id
    const mpPayment = getMPPayment()
    const payment = await mpPayment.get({ id: paymentId })

    if (!payment) return NextResponse.json({ received: true })

    const externalRef = payment.external_reference ?? ''
    const [empresaId, plan] = externalRef.split(':')

    if (!empresaId || !plan) {
      console.warn('[mp-webhook] external_reference inválido:', externalRef)
      return NextResponse.json({ received: true })
    }

    const supabase = getServiceSupabase()
    const estado = payment.status === 'approved' ? 'completado' : 'fallido'

    if (payment.status === 'approved') {
      await supabase
        .from('empresas')
        .update({
          plan,
          suscripcion_estado: 'activa',
          mp_subscription_id: String(payment.id),
          suscripcion_inicio: new Date().toISOString(),
          proveedor_pago: 'mercadopago',
        })
        .eq('id', empresaId)
    }

    await supabase.from('pagos').insert({
      empresa_id: empresaId,
      proveedor: 'mercadopago',
      proveedor_pago_id: String(payment.id),
      monto: payment.transaction_amount ?? 0,
      moneda: payment.currency_id ?? 'USD',
      estado,
      plan,
      descripcion: `Pago MercadoPago — plan ${plan}`,
    })

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[mp-webhook]', err)
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 })
  }
}
