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
  .partial()
  .strict()

// Schema para operaciones de preboarding
export const preboardingSchema = z.object({
  usuarioId: uuidSchema,
})

export type CrearEmpleadoInput = z.infer<typeof crearEmpleadoSchema>
export type ActualizarEmpleadoInput = z.infer<typeof actualizarEmpleadoSchema>
export type PreboardingInput = z.infer<typeof preboardingSchema>
