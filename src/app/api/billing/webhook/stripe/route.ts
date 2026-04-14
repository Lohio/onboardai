// POST /api/billing/webhook/stripe
// Webhook handler para eventos de Stripe

import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

// Supabase con service role para bypassear RLS
function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Configuración de webhook faltante' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Firma inválida:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  const supabase = getServiceSupabase()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const empresaId = session.metadata?.empresa_id
        const plan = session.metadata?.plan
        if (!empresaId || !plan) break

        await supabase
          .from('empresas')
          .update({
            plan,
            suscripcion_estado: 'activa',
            stripe_subscription_id: session.subscription as string,
            suscripcion_inicio: new Date().toISOString(),
            proveedor_pago: 'stripe',
          })
          .eq('id', empresaId)

        // Registrar pago
        await supabase.from('pagos').insert({
          empresa_id: empresaId,
          proveedor: 'stripe',
          proveedor_pago_id: session.payment_intent as string,
          monto: (session.amount_total ?? 0) / 100,
          moneda: session.currency ?? 'usd',
          estado: 'completado',
          plan,
          descripcion: `Checkout Stripe — plan ${plan}`,
        })
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: empresa } = await supabase
          .from('empresas')
          .select('id, plan')
          .eq('stripe_customer_id', customerId)
          .single()

        if (empresa) {
          await supabase
            .from('empresas')
            .update({ suscripcion_estado: 'activa' })
            .eq('id', empresa.id)

          await supabase.from('pagos').insert({
            empresa_id: empresa.id,
            proveedor: 'stripe',
            proveedor_pago_id: invoice.id,
            monto: invoice.amount_paid / 100,
            moneda: invoice.currency,
            estado: 'completado',
            plan: empresa.plan,
            descripcion: 'Renovación mensual Stripe',
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: empresa } = await supabase
          .from('empresas')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (empresa) {
          await supabase
            .from('empresas')
            .update({ suscripcion_estado: 'vencida' })
            .eq('id', empresa.id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const empresaId = sub.metadata?.empresa_id

        if (empresaId) {
          await supabase
            .from('empresas')
            .update({
              plan: 'trial',
              suscripcion_estado: 'cancelada',
              stripe_subscription_id: null,
            })
            .eq('id', empresaId)
        }
        break
      }

      default:
        // Ignorar eventos no manejados
        break
    }
  } catch (err) {
    console.error('[stripe-webhook] Error procesando evento:', event.type, err)
    return NextResponse.json({ error: 'Error procesando evento' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
