// POST /api/billing/checkout
// Crea una sesión de pago en Stripe o MercadoPago según el proveedor solicitado

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getStripe, STRIPE_PRICES } from '@/lib/stripe'
import { getMPPreference } from '@/lib/mercadopago-server'
import { PLANES } from '@/lib/billing'
import type { PlanId, ProveedorPago } from '@/types'

export async function POST(req: NextRequest) {
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
      return NextResponse.json({ error: 'Solo admins pueden gestionar suscripciones' }, { status: 403 })
    }

    const body = await req.json() as { plan: PlanId; proveedor: ProveedorPago }
    const { plan, proveedor } = body

    if (!PLANES[plan] || plan === 'trial') {
      return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
    }

    const { data: empresa } = await supabase
      .from('empresas')
      .select('id, nombre, stripe_customer_id')
      .eq('id', usuario.empresa_id)
      .single()

    if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://onboardai-lohios-projects.vercel.app'

    // ── Stripe ────────────────────────────────────────────────────────────────
    if (proveedor === 'stripe') {
      const stripe = getStripe()
      const priceId = STRIPE_PRICES[plan]
      if (!priceId) {
        return NextResponse.json({ error: 'Price ID de Stripe no configurado' }, { status: 500 })
      }

      let customerId = empresa.stripe_customer_id as string | undefined

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: empresa.nombre,
          metadata: { empresa_id: empresa.id },
        })
        customerId = customer.id
        await supabase
          .from('empresas')
          .update({ stripe_customer_id: customerId })
          .eq('id', empresa.id)
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/admin/suscripcion?success=1`,
        cancel_url: `${baseUrl}/admin/suscripcion?canceled=1`,
        metadata: { empresa_id: empresa.id, plan },
        subscription_data: { metadata: { empresa_id: empresa.id, plan } },
      })

      return NextResponse.json({ url: session.url })
    }

    // ── MercadoPago ───────────────────────────────────────────────────────────
    if (proveedor === 'mercadopago') {
      const planConfig = PLANES[plan]
      const preference = getMPPreference()

      const result = await preference.create({
        body: {
          items: [
            {
              id: plan,
              title: `Heero ${planConfig.nombre}`,
              description: `Suscripción mensual Heero ${planConfig.nombre}`,
              quantity: 1,
              unit_price: planConfig.precioUSD,
              currency_id: 'USD',
            },
          ],
          back_urls: {
            success: `${baseUrl}/admin/suscripcion?success=1`,
            failure: `${baseUrl}/admin/suscripcion?canceled=1`,
            pending: `${baseUrl}/admin/suscripcion?pending=1`,
          },
          auto_return: 'approved',
          metadata: { empresa_id: empresa.id, plan },
          external_reference: `${empresa.id}:${plan}`,
        },
      })

      return NextResponse.json({ url: result.init_point })
    }

    return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })
  } catch (err) {
    console.error('[billing/checkout]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
