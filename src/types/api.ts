import { NextRequest } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { UserRole } from './index'

// Contexto disponible en todos los handlers de la API
export interface ApiContext<TBody = unknown> {
  req: NextRequest
  body: TBody
  user: {
    id: string
    empresaId: string
    rol: UserRole
  } | null
  supabase: SupabaseClient
  requestId: string
  params: Record<string, string>
}

// Respuesta estándar de la API
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  requestId?: string
}
