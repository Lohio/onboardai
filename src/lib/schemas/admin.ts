import { z } from 'zod'
import { emailSchema, passwordSchema, nombreSchema, uuidSchema, modalidadSchema, rolEmpleadoSchema } from './shared'

// Schema para crear un empleado nuevo
export const crearEmpleadoSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  nombre: nombreSchema,
  puesto: z.string().trim().max(200).optional(),
  area: z.string().trim().max(200).optional(),
  fecha_ingreso: z.string().datetime().optional(),
  modalidad_trabajo: modalidadSchema.optional(),
  manager_id: uuidSchema.optional(),
  buddy_id: uuidSchema.optional(),
  sobre_mi: z.string().trim().max(1000).optional(),
  rol: rolEmpleadoSchema.optional(),
})

// Schema para actualizar un empleado: todos los campos opcionales, sin email ni password
export const actualizarEmpleadoSchema = crearEmpleadoSchema
  .omit({ password: true, email: true })
  .extend({
    password_corporativo: z.string().trim().max(500).nullable().optional(),
    password_bitlocker:   z.string().trim().max(500).nullable().optional(),
  })
  .partial()

// Schema para operaciones de preboarding
export const preboardingSchema = z.object({
  usuarioId: uuidSchema,
})

// Schema para crear una API key
export const crearApiKeySchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  scopes: z.array(
    z.enum(['empleados:read', 'empleados:write', 'progreso:read', 'encuestas:read', 'webhooks:write'])
  ).min(1),
  expiresInDays: z.number().int().positive().optional(),
})

export type CrearEmpleadoInput = z.infer<typeof crearEmpleadoSchema>
export type ActualizarEmpleadoInput = z.infer<typeof actualizarEmpleadoSchema>
export type PreboardingInput = z.infer<typeof preboardingSchema>
export type CrearApiKeyInput = z.infer<typeof crearApiKeySchema>
