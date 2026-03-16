import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 1. Verificar sesión
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Sin sesión → login
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // 2. Obtener rol desde la tabla usuarios
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  const rol = usuario?.rol

  // 3. Proteger /admin/* → solo admins
  if (pathname.startsWith('/admin')) {
    if (rol !== 'admin') {
      return NextResponse.redirect(new URL('/empleado/perfil', request.url))
    }
  }

  // 4. Proteger /empleado/* → solo empleados
  //    (admins redirigen al dashboard de admin)
  if (pathname.startsWith('/empleado')) {
    if (rol === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/empleado/:path*'],
}
