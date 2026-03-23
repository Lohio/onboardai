// ─────────────────────────────────────────────
// cors.ts — Helpers de CORS para la API pública /api/v1/*
// Solo se aplica en rutas bajo /api/v1/
// ─────────────────────────────────────────────

import { NextResponse } from 'next/server'

// Headers CORS para respuestas de la API pública
export const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
} as const

// Valida el origin del request contra los orígenes permitidos de la empresa
// origins: array de strings desde empresas.api_cors_origins
// Retorna el origin a setear en el header, o null si no permitido
export function getAllowedOrigin(
  requestOrigin: string | null,
  allowedOrigins: string[]
): string | null {
  if (!requestOrigin || allowedOrigins.length === 0) return null
  if (allowedOrigins.includes('*')) return '*'
  if (allowedOrigins.includes(requestOrigin)) return requestOrigin
  return null
}

// Agrega los headers CORS a una NextResponse existente
export function addCorsHeaders(
  response: NextResponse,
  origin: string | null
): NextResponse {
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}
