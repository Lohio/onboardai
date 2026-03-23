// ─────────────────────────────────────────────
// Respuestas de error estandarizadas para API routes
// Usar en lugar de NextResponse.json({ error: '...' }, { status: ... }) sueltos
// requestId es opcional — cuando está presente se incluye en el cuerpo JSON
// ─────────────────────────────────────────────

import { NextResponse } from 'next/server'

export const ApiError = {
  unauthorized: (mensaje = 'No autorizado', requestId?: string) =>
    NextResponse.json(
      { error: mensaje, ...(requestId && { requestId }) },
      { status: 401 }
    ),

  forbidden: (requestId?: string) =>
    NextResponse.json(
      { error: 'Acceso denegado', ...(requestId && { requestId }) },
      { status: 403 }
    ),

  notFound: (recurso = 'Recurso', requestId?: string) =>
    NextResponse.json(
      { error: `${recurso} no encontrado`, ...(requestId && { requestId }) },
      { status: 404 }
    ),

  badRequest: (mensaje: string, requestId?: string) =>
    NextResponse.json(
      { error: mensaje, ...(requestId && { requestId }) },
      { status: 400 }
    ),

  conflict: (mensaje: string, requestId?: string) =>
    NextResponse.json(
      { error: mensaje, ...(requestId && { requestId }) },
      { status: 409 }
    ),

  tooManyRequests: (mensaje = 'Límite de requests alcanzado', requestId?: string) =>
    NextResponse.json(
      { error: mensaje, ...(requestId && { requestId }) },
      { status: 429 }
    ),

  internal: (mensaje = 'Error interno del servidor', requestId?: string) =>
    NextResponse.json(
      { error: mensaje, ...(requestId && { requestId }) },
      { status: 500 }
    ),
} as const
