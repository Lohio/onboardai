// src/lib/stripe.ts
// Cliente Stripe — solo importar en server components o API routes

import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY no configurada')
  _stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
  return _stripe
}

// Price IDs por plan
export const STRIPE_PRICES = {
  pro:                  process.env.STRIPE_PRICE_PRO_MONTHLY,
  enterprise:           process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
  pro_extra_seat:       process.env.STRIPE_PRICE_PRO_EXTRA_SEAT,
  enterprise_extra_seat: process.env.STRIPE_PRICE_ENTERPRISE_EXTRA_SEAT,
} as const
