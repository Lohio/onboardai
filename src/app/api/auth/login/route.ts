import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// ─────────────────────────────────────────────
// POST /api/auth/login
// Autenticación server-side para evitar problemas
// con el cliente browser de Supabase en Vercel.
// ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email: string; password: string }
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son obligatorios' },
        { status: 400 }
      )
    }

    // Acumular cookies que Supabase quiere setear
    const cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookies) {
            cookies.forEach(c => cookiesToSet.push(c))
          },
        },
      }
    )

    // 1. Autenticar
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (signInError) {
      return NextResponse.json(
        { error: signInError.message },
        { status: 401 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'No se pudo obtener la sesión' },
        { status: 401 }
      )
    }

    // 2. Obtener rol desde la tabla usuarios
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', data.user.id)
      .single()

    if (userError || !usuario) {
      return NextResponse.json(
        { error: 'No se encontró el perfil del usuario' },
        { status: 404 }
      )
    }

    // 3. Construir respuesta con cookies de sesión
    const response = NextResponse.json({ rol: usuario.rol }, { status: 200 })

    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
    })

    return response
  } catch (err) {
    console.error('[login] Error inesperado:', err)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
