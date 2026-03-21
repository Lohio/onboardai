import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { UserRole } from '@/types'

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────

/** Cookie que cachea el rol para evitar una query a Supabase por cada request */
const COOKIE_ROL = 'onboard_rol'

/**
 * Cookie que indica si el empleado está en modo pre-boarding.
 * Valor: "1" si preboarding_activo=true y fecha_ingreso > hoy.
 * Leída por el layout del empleado sin necesidad de una query extra.
 */
const COOKIE_PREBOARDING = 'onboard_preboarding'

/** Cookie que cachea si el setup inicial fue completado (evita query a empresas en cada request) */
const COOKIE_SETUP = 'onboard_setup'

/** Duración del caché de rol: 5 minutos en segundos */
const COOKIE_ROL_MAX_AGE = 60 * 5

/** Roles válidos para validar el valor de la cookie */
const ROLES_VALIDOS: UserRole[] = ['empleado', 'admin', 'dev']

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Devuelve la ruta de inicio según el rol del usuario */
function homeByRol(rol: UserRole): string {
  if (rol === 'dev') return '/superadmin'  // ← cambiar /dev por /superadmin
  if (rol === 'admin') return '/admin'
  return '/empleado/perfil'
}

/** Type guard: verifica que el string sea un UserRole válido */
function esRolValido(valor: string): valor is UserRole {
  return (ROLES_VALIDOS as string[]).includes(valor)
}

// ─────────────────────────────────────────────────────────────
// Middleware principal
// ─────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  // Supabase SSR requiere propagar cookies tanto en request como en response
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

  // Sin sesión → login (si ya estamos en /auth/* dejamos pasar)
  if (!user) {
    if (pathname.startsWith('/auth')) return supabaseResponse
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // ── 2. Obtener rol (con caché en cookie) ─────────────────────
  let rol: UserRole | null = null

  // Intentar leer el rol desde la cookie cacheada
  const rolCacheado = request.cookies.get(COOKIE_ROL)?.value
  if (rolCacheado && esRolValido(rolCacheado)) {
    rol = rolCacheado
  }

  // Si no hay caché válido, consultar Supabase
  if (!rol) {
    try {
      const { data: perfil, error } = await supabase
        .from('usuarios')
        .select('rol, preboarding_activo, fecha_ingreso')
        .eq('id', user.id)
        .single()

      if (error) {
        // Fail open: si falla la query dejamos pasar para no romper la app
        console.error('[middleware] Error al obtener rol desde Supabase:', error)
        return supabaseResponse
      }

      // Usuario autenticado en Auth pero sin fila en tabla usuarios
      if (!perfil) {
        const url = new URL('/auth/login', request.url)
        url.searchParams.set('error', 'no_profile')
        return NextResponse.redirect(url)
      }

      if (!esRolValido(perfil.rol)) {
        // Fail open ante un valor inesperado en la base de datos
        console.error('[middleware] Rol inválido recibido de Supabase:', perfil.rol)
        return supabaseResponse
      }

      rol = perfil.rol

      // Cachear el rol en cookie httpOnly de corta duración (5 min)
      supabaseResponse.cookies.set(COOKIE_ROL, rol, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: COOKIE_ROL_MAX_AGE,
        path: '/',
      })

      // Cachear estado pre-boarding: activo si la bandera está encendida
      // y fecha_ingreso todavía no llegó. El frontend lo lee para mostrar
      // el banner y bloquear M3/M4 sin una query adicional.
      const enPreboarding =
        perfil.preboarding_activo === true &&
        !!perfil.fecha_ingreso &&
        new Date(perfil.fecha_ingreso) > new Date()

      supabaseResponse.cookies.set(COOKIE_PREBOARDING, enPreboarding ? '1' : '0', {
        httpOnly: false, // legible desde el cliente (no contiene datos sensibles)
        sameSite: 'strict',
        maxAge: COOKIE_ROL_MAX_AGE,
        path: '/',
      })
    } catch (err) {
      // Fail open ante errores de red u otros inesperados
      console.error('[middleware] Error inesperado al obtener rol:', err)
      return supabaseResponse
    }
  }

  // ── 3. Usuario con sesión activa intenta acceder a /auth/* ───
  // Ya está logueado: redirigir a su home
  if (pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL(homeByRol(rol), request.url))
  }

  // ── 4. Raíz / → redirect según rol ──────────────────────────
  if (pathname === '/') {
    return NextResponse.redirect(new URL(homeByRol(rol), request.url))
  }

  // ── 5. /dev/* → solo rol 'dev' ──────────────────────────────
  if (pathname.startsWith('/superadmin')) {
    if (rol !== 'dev') {
      return NextResponse.redirect(new URL(homeByRol(rol), request.url))
    }
    return supabaseResponse
  }

  // ── 6. dev: acceso total al resto de rutas ───────────────────
  if (rol === 'dev') return supabaseResponse

  // ── 7. /admin/* → solo admin (empleado → redirect /empleado) ─
  if (pathname.startsWith('/admin')) {
    if (rol !== 'admin') {
      return NextResponse.redirect(new URL('/empleado/perfil', request.url))
    }

    // /admin/setup siempre accesible para admin — no verificar setup aquí
    if (pathname === '/admin/setup') {
      return supabaseResponse
    }

    // Para cualquier otra ruta /admin, verificar si completó el setup.
    // Usamos cookie de caché corta para no consultar la DB en cada request.
    const setupCacheado = request.cookies.get(COOKIE_SETUP)?.value

    if (setupCacheado !== '1') {
      // Consultar empresas en la DB
      try {
        const { data: usuario } = await supabase
          .from('usuarios')
          .select('empresa_id')
          .eq('id', user.id)
          .single()

        if (usuario?.empresa_id) {
          const { data: empresa } = await supabase
            .from('empresas')
            .select('setup_completo')
            .eq('id', usuario.empresa_id)
            .single()

          if (empresa && !empresa.setup_completo) {
            return NextResponse.redirect(new URL('/admin/setup', request.url))
          }

          // Setup completo — cachear en cookie para próximos requests (1 hora)
          supabaseResponse.cookies.set(COOKIE_SETUP, '1', {
            httpOnly: true,
            sameSite: 'strict',
            maxAge: 60 * 60,
            path: '/',
          })
        }
      } catch (err) {
        // Fail open: si falla la query de empresas, dejamos pasar
        console.warn('[middleware] Error verificando setup:', err)
      }
    }

    return supabaseResponse
  }

  // ── 8. /empleado/* → empleado y admin ───────────────────────
  // Admin puede visitar /empleado/* para ver la vista del empleado.
  // /empleado sin subpath → redirect al home del rol correspondiente.
  if (pathname === '/empleado') {
    return NextResponse.redirect(new URL(homeByRol(rol), request.url))
  }

  return supabaseResponse
}

// ─────────────────────────────────────────────────────────────
// Matcher: rutas donde corre el middleware
// Excluye _next/static, _next/image, favicon y archivos estáticos
// ─────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Correr en todas las rutas excepto:
     * - _next/static  (assets estáticos de Next.js)
     * - _next/image   (optimización de imágenes)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Archivos con extensión (imágenes, fuentes, íconos, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)).*)',
  ],
}
