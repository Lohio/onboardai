import { z } from 'zod'

// Schema para crear una sesión de checkout (Stripe o MercadoPago).
// 'trial' se excluye a propósito: no es un plan comprable
// (replica el check manual `!PLANES[plan] || plan === 'trial'`).
export const checkoutSchema = z.object({
  plan: z.enum(['pro', 'enterprise']),
  proveedor: z.enum(['stripe', 'mercadopago']),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
