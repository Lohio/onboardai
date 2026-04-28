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

/** Secret para firmar la cookie de rol — previene que el cliente la falsifique */
const COOKIE_SECRET = process.env.ENCRYPTION_KEY ?? ''

// ─────────────────────────────────────────────────────────────
// HMAC: firma y verificación de la cookie de rol
// Aunque la cookie es httpOnly, un usuario puede crearla
// manualmente con devtools. La firma HMAC impide esto.
// ─────────────────────────────────────────────────────────────

async function firmarRol(rol: UserRole, userId: string): Promise<string> {
  if (!COOKIE_SECRET) return rol
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(COOKIE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(`${rol}:${userId}`))
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
  return `${rol}:${hex}`
}

async function verificarRolCookie(valor: string, userId: string): Promise<UserRole | null> {
  if (!COOKIE_SECRET) {
    return esRolValido(valor) ? valor : null
  }
  const sep = valor.lastIndexOf(':')
  if (sep === -1) return null
  const rol = valor.slice(0, sep)
  const sig = valor.slice(sep + 1)
  if (!esRolValido(rol)) return null

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(COOKIE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(`${rol}:${userId}`))
  const expected = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)

  // Comparación en tiempo constante para prevenir timing attacks
  if (sig.length !== expected.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0 ? rol : null
}

// ─────────────────────────────────────────────────────────────
// CSP dinámica con nonce — elimina unsafe-inline
// ─────────────────────────────────────────────────────────────

function buildCSP(nonce: string): string {
  return [
    "default-src 'self'",
    // 'unsafe-inline' se ignora en browsers modernos cuando hay nonce presente —
    // sirve solo como fallback para browsers sin soporte de nonces.
    // 'strict-dynamic' se evita porque ignora 'self', bloqueando los chunks de Next.js.
    `script-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io",
    "frame-ancestors 'none'",
  ].join('; ')
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Devuelve la ruta de inicio según el rol del usuario */
function homeByRol(rol: UserRole): string {
  if (rol === 'dev') return '/dev'
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
  // Nonce por request para CSP — elimina 'unsafe-inline'
  const nonce = btoa(crypto.randomUUID())
  const csp = buildCSP(nonce)
  const withCSP = (r: NextResponse) => { r.headers.set('content-security-policy', csp); return r }

  // Propagar nonce a Server Components vía cabecera interna
  const reqHeaders = new Headers(request.headers)
  reqHeaders.set('x-nonce', nonce)

  // Supabase SSR requiere propagar cookies tanto en request como en response
  let supabaseResponse = NextResponse.next({ request: { headers: reqHeaders } })

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
          supabaseResponse = NextResponse.next({ request: { headers: reqHeaders } })
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
    if (pathname.startsWith('/auth')) return withCSP(supabaseResponse)

    const loginResponse = NextResponse.redirect(new URL('/auth/login', request.url))
    // Limpiar cookies de caché para que el próximo login lea el rol fresco
    for (const name of [COOKIE_ROL, COOKIE_SETUP, COOKIE_PREBOARDING]) {
      loginResponse.cookies.set(name, '', { maxAge: 0, path: '/' })
    }
    return loginResponse
  }

  // ── 2. Obtener rol (con caché en cookie) ─────────────────────
  let rol: UserRole | null = null

  // Intentar leer el rol desde la cookie cacheada
  const rolCacheado = request.cookies.get(COOKIE_ROL)?.value
  if (rolCacheado) {
    rol = await verificarRolCookie(rolCacheado, user.id)
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
        return withCSP(supabaseResponse)
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
        return withCSP(supabaseResponse)
      }

      rol = perfil.rol

      // Cachear el rol en cookie httpOnly firmada con HMAC (5 min)
      supabaseResponse.cookies.set(COOKIE_ROL, await firmarRol(rol, user.id), {
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
      return withCSP(supabaseResponse)
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
  if (pathname.startsWith('/dev')) {
    if (rol !== 'dev') {
      return NextResponse.redirect(new URL(homeByRol(rol), request.url))
    }
    return withCSP(supabaseResponse)
  }

  // ── 6. dev: acceso total al resto de rutas ───────────────────
  if (rol === 'dev') return withCSP(supabaseResponse)

  // ── 7. /admin/* → solo admin (empleado → redirect /empleado) ─
  if (pathname.startsWith('/admin')) {
    if (rol !== 'admin') {
      return NextResponse.redirect(new URL('/empleado/perfil', request.url))
    }

    // /admin/setup siempre accesible para admin — no verificar setup aquí
    if (pathname === '/admin/setup') {
      return withCSP(supabaseResponse)
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

    return withCSP(supabaseResponse)
  }

  // ── 8. /empleado/* → empleado y admin ───────────────────────
  // Admin puede visitar /empleado/* para ver la vista del empleado.
  // /empleado sin subpath → redirect al home del rol correspondiente.
  if (pathname === '/empleado') {
    return NextResponse.redirect(new URL(homeByRol(rol), request.url))
  }

  return withCSP(supabaseResponse)
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
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)).*)',
  ],
}
