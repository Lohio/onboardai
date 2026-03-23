import { z } from 'zod'
import { uuidSchema, mensajeSchema } from './shared'

// Schema para el chat con el asistente IA (M4)
export const chatSchema = z.object({
  mensaje: mensajeSchema,
  conversacionId: uuidSchema.nullable().optional(),
})

// Schema para el agente de hints contextual
export const agenteSchema = z.object({
  mensaje: mensajeSchema,
  modulo: z.string().max(100).optional(),
  contexto: z.string().max(2000).optional(),
  historial: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(10000),
      })
    )
    .max(20)
    .optional(),
})

// Schema para responder una encuesta de pulso (días 7/30/60)
export const encuestaResponderSchema = z.object({
  encuestaId: uuidSchema,
  respuesta1: z.number().int().min(1).max(5),
  respuesta2: z.number().int().min(1).max(5),
  respuesta3: z.number().int().min(1).max(5),
  comentario: z.string().max(2000).optional(),
})

export type ChatInput = z.infer<typeof chatSchema>
export type AgenteInput = z.infer<typeof agenteSchema>
export type EncuestaResponderInput = z.infer<typeof encuestaResponderSchema>
