// src/lib/mercadopago-server.ts
// Cliente MercadoPago — solo importar en server components o API routes

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

let _mp: MercadoPagoConfig | null = null

export function getMercadoPago(): MercadoPagoConfig {
  if (_mp) return _mp
  const token = process.env.MP_ACCESS_TOKEN
  if (!token) throw new Error('MP_ACCESS_TOKEN no configurada')
  _mp = new MercadoPagoConfig({ accessToken: token })
  return _mp
}

export function getMPPreference() {
  return new Preference(getMercadoPago())
}

export function getMPPayment() {
  return new Payment(getMercadoPago())
}
