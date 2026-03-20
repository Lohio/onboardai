// ─────────────────────────────────────────────
// Respuestas de error estandarizadas para API routes
// Usar en lugar de NextResponse.json({ error: '...' }, { status: ... }) sueltos
// ─────────────────────────────────────────────

import { NextResponse } from 'next/server'

export const ApiError = {
  unauthorized: () =>
    NextResponse.json({ error: 'No autorizado' }, { status: 401 }),

  forbidden: () =>
    NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }),

  notFound: (recurso = 'Recurso') =>
    NextResponse.json({ error: `${recurso} no encontrado` }, { status: 404 }),

  badRequest: (mensaje: string) =>
    NextResponse.json({ error: mensaje }, { status: 400 }),

  conflict: (mensaje: string) =>
    NextResponse.json({ error: mensaje }, { status: 409 }),

  tooManyRequests: (mensaje = 'Límite de requests alcanzado') =>
    NextResponse.json({ error: mensaje }, { status: 429 }),

  internal: (mensaje = 'Error interno del servidor') =>
    NextResponse.json({ error: mensaje }, { status: 500 }),
} as const
