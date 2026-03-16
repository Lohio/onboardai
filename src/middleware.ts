import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/types'

// ─────────────────────────────────────────────
// Destinos por defecto según rol
// ─────────────────────────────────────────────

function homeByRol(rol: UserRole): string {
  if (rol === 'dev') return '/dev'
  if (rol === 'admin') return '/admin'
  return '/empleado/perfil'
}

// ─────────────────────────────────────────────
// Middleware principal
// ─────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  // Supabase SSR requiere que todas las cookies se propaguen
  // tanto en la request como en la response.
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

  const { pathname } = request.nextUrl

  // ── 1. Verificar sesión ──────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Sin sesión → login (excepto si ya estamos en /auth/*)
  if (!user) {
    if (pathname.startsWith('/auth')) return supabaseResponse
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // ── 2. Leer perfil desde tabla usuarios ─────────────────────
  const { data: perfil } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  // Usuario autenticado en Supabase Auth pero sin fila en usuarios
  if (!perfil) {
    const url = new URL('/auth/login', request.url)
    url.searchParams.set('error', 'no_profile')
    return NextResponse.redirect(url)
  }

  const rol = perfil.rol as UserRole

  // ── 3. Usuario autenticado accede a /auth/* ──────────────────
  // Redirigir al home correspondiente para no mostrar login si ya logueado
  if (pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL(homeByRol(rol), request.url))
  }

  // ── 4. Acceso a la raíz / ────────────────────────────────────
  if (pathname === '/') {
    return NextResponse.redirect(new URL(homeByRol(rol), request.url))
  }

  // ── 5. Proteger /dev/* → solo rol 'dev' ─────────────────────
  if (pathname.startsWith('/dev')) {
    if (rol !== 'dev') {
      return NextResponse.redirect(new URL(homeByRol(rol), request.url))
    }
    return supabaseResponse
  }

  // ── 6. dev: acceso total al resto de rutas ───────────────────
  if (rol === 'dev') return supabaseResponse

  // ── 8. Proteger /admin/* → solo admin ───────────────────────
  if (pathname.startsWith('/admin')) {
    if (rol !== 'admin') {
      return NextResponse.redirect(new URL('/empleado/perfil', request.url))
    }
  }

  // ── 9. Proteger /empleado/* → empleado y admin ──────────────
  // Los admins pueden visitar /empleado/* (para probar la vista del empleado)
  // pero si acceden a la raíz /empleado los mandamos a su dashboard
  if (pathname === '/empleado') {
    return NextResponse.redirect(new URL(homeByRol(rol), request.url))
  }

  return supabaseResponse
}

// ─────────────────────────────────────────────
// Matcher: rutas donde corre el middleware
// Excluye: _next/static, _next/image, favicon, archivos con extensión
// ─────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Correr en todas las rutas excepto:
     * - _next/static (assets estáticos de Next.js)
     * - _next/image  (optimización de imágenes)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Archivos con extensión (imágenes, fuentes, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)).*)',
  ],
}
