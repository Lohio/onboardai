import { z } from 'zod'
import { emailSchema, passwordSchema, nombreSchema } from './shared'

// Schema para el endpoint de login
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
})

// Schema para el registro de un nuevo usuario/empresa
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  nombre: nombreSchema,
  nombreEmpresa: nombreSchema,
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
