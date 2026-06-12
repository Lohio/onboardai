// POST /api/billing/checkout
// Crea una sesión de pago en Stripe o MercadoPago según el proveedor solicitado

import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { checkoutSchema } from '@/lib/schemas/billing'
import { ApiError } from '@/lib/errors'
import { getStripe, STRIPE_PRICES } from '@/lib/stripe'
import { getMPPreference } from '@/lib/mercadopago-server'
import { PLANES } from '@/lib/billing'

export const POST = withHandler(
  {
    auth: 'session',
    rol: 'admin',
    schema: checkoutSchema,
  },
  async ({ body, supabase, user, requestId }) => {
    const { plan, proveedor } = body

    const { data: empresa } = await supabase
      .from('empresas')
      .select('id, nombre, stripe_customer_id')
      .eq('id', user!.empresaId)
      .single()

    if (!empresa) return ApiError.notFound('Empresa', requestId)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://heeroai-lohios-projects.vercel.app'

    // ── Stripe ────────────────────────────────────────────────────────────────
    if (proveedor === 'stripe') {
      const stripe = getStripe()
      const priceId = STRIPE_PRICES[plan]
      if (!priceId) {
        return ApiError.internal('Price ID de Stripe no configurado', requestId)
      }

      let customerId = empresa.stripe_customer_id as string | undefined

      if (!customerId) {
        // ctx.user no incluye email — lo obtenemos del usuario auth de la sesión
        const { data: { user: authUser } } = await supabase.auth.getUser()

        const customer = await stripe.customers.create({
          email: authUser?.email,
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
    // El schema garantiza que proveedor solo puede ser 'stripe' o 'mercadopago'
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
)
