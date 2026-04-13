import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// ─────────────────────────────────────────────
// POST /api/auth/logout
// Limpia la sesión de Supabase y las cookies de
// caché del middleware (rol, setup, preboarding).
// Las cookies httpOnly solo se pueden borrar desde
// el servidor, por eso se necesita este endpoint.
// ─────────────────────────────────────────────

const COOKIES_CACHE = ['onboard_rol', 'onboard_setup', 'onboard_preboarding']

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    await supabase.auth.signOut()
  } catch {
    // Continuar aunque falle signOut — el cliente igual navega a /auth/login
  }

  const response = NextResponse.json({ ok: true })

  // Limpiar cookies de caché del middleware
  for (const name of COOKIES_CACHE) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    })
  }

  // Limpiar cookies de sesión de Supabase (sb-{projectRef}-auth-token y chunks)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)/)?.[1] ?? ''
  if (projectRef) {
    const base = `sb-${projectRef}-auth-token`
    response.cookies.set(base, '', { maxAge: 0, path: '/' })
    for (let i = 0; i < 5; i++) {
      response.cookies.set(`${base}.${i}`, '', { maxAge: 0, path: '/' })
    }
  }

  return response
}
