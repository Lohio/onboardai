import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────
// POST /api/auth/login
// Auth server-side con service role key.
// Devuelve el rol y los tokens de sesión para que
// el browser los setee vía supabase.auth.setSession().
// También setea cookies en formato @supabase/ssr
// para que el middleware reconozca la sesión.
// ─────────────────────────────────────────────

const CHUNK_SIZE = 3180 // límite seguro por debajo de los 4096 bytes de cookie

function setCookiesSSRFormat(
  response: NextResponse,
  projectRef: string,
  session: {
    access_token: string
    token_type: string
    expires_in: number
    expires_at: number
    refresh_token: string
    user: object
  }
) {
  const cookieName = `sb-${projectRef}-auth-token`
  const value = JSON.stringify(session)
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: session.expires_in,
  }

  if (value.length <= CHUNK_SIZE) {
    response.cookies.set(cookieName, value, opts)
  } else {
    // Partir en chunks si el JWT es muy grande
    const chunks: string[] = []
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE))
    }
    chunks.forEach((chunk, i) => {
      response.cookies.set(`${cookieName}.${i}`, chunk, opts)
    })
  }
}

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

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta' },
        { status: 500 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Autenticar
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (signInError) {
      return NextResponse.json({ error: signInError.message }, { status: 401 })
    }

    if (!data.user || !data.session) {
      return NextResponse.json(
        { error: 'No se pudo obtener la sesión' },
        { status: 401 }
      )
    }

    // 2. Obtener rol
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

    // 3. Respuesta: devolver rol + tokens para que el browser setee la sesión
    const response = NextResponse.json(
      {
        rol: usuario.rol,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      { status: 200 }
    )

    // 4. Setear cookies en formato @supabase/ssr para que el middleware
    //    reconozca la sesión sin necesidad de otra consulta a Supabase
    const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)/)?.[1] ?? ''
    if (projectRef) {
      setCookiesSSRFormat(response, projectRef, {
        access_token: data.session.access_token,
        token_type: data.session.token_type,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at ?? 0,
        refresh_token: data.session.refresh_token,
        user: data.session.user,
      })
    }

    return response
  } catch (err) {
    console.error('[login] Error inesperado:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
