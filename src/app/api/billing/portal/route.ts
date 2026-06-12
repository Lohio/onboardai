// POST /api/billing/portal
// Crea una sesión del Stripe Customer Portal para gestionar la suscripción

import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { ApiError } from '@/lib/errors'
import { getStripe } from '@/lib/stripe'

export const POST = withHandler(
  {
    auth: 'session',
    rol: 'admin',
    bodyType: 'none',
  },
  async ({ supabase, user, requestId }) => {
    const { data: empresa } = await supabase
      .from('empresas')
      .select('stripe_customer_id')
      .eq('id', user!.empresaId)
      .single()

    if (!empresa?.stripe_customer_id) {
      return ApiError.badRequest('No hay suscripción Stripe activa', requestId)
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://heeroai-lohios-projects.vercel.app'
    const stripe = getStripe()

    const session = await stripe.billingPortal.sessions.create({
      customer: empresa.stripe_customer_id,
      return_url: `${baseUrl}/admin/suscripcion`,
    })

    return NextResponse.json({ url: session.url })
  }
)
