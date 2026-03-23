import { z } from 'zod'

// Primitivos reutilizables en todos los schemas de la API
export const emailSchema = z.string().email().trim().toLowerCase().max(255)
export const uuidSchema = z.string().uuid()
export const passwordSchema = z.string().min(8).max(128)
export const nombreSchema = z.string().trim().min(1).max(200)
export const mensajeSchema = z.string().trim().min(1).max(2000)
export const modalidadSchema = z.enum(['presencial', 'remoto', 'hibrido'])
export const rolEmpleadoSchema = z.enum(['empleado', 'admin'])
