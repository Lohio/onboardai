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

/** Verifica la firma HMAC-SHA256 del webhook de MercadoPago */
async function verificarFirmaMP(req: NextRequest, dataId: string): Promise<boolean> {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return true // sin secret configurado, pasar (log advertencia)

  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id') ?? ''
  if (!xSignature) return false

  const parts = Object.fromEntries(xSignature.split(',').map(p => { const [k, v] = p.split('='); return [k.trim(), v?.trim() ?? ''] }))
  const ts = parts['ts'] ?? ''
  const v1 = parts['v1'] ?? ''
  if (!ts || !v1) return false

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts}`
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(manifest))
  const expected = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')

  // Comparación en tiempo constante
  if (v1.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < v1.length; i++) diff |= v1.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { type: string; data?: { id?: string } }

    // Solo procesar notificaciones de pago
    if (body.type !== 'payment' || !body.data?.id) {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data.id

    // Verificar firma antes de procesar
    const firmaValida = await verificarFirmaMP(req, String(paymentId))
    if (!firmaValida) {
      console.warn('[mp-webhook] Firma inválida — request rechazado')
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
    }
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
