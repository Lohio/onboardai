import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(error)}`
    )
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`)
  }

  const supabase = await createServerSupabaseClient()
  const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError || !data.user) {
    console.error('[auth/callback]', sessionError?.message)
    return NextResponse.redirect(`${origin}/auth/login?error=session_error`)
  }

  // Buscar si ya tiene fila en usuarios
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', data.user.id)
    .single()

  // Usuario existente → login normal
  if (usuario) {
    const destinos: Record<string, string> = {
      dev:      '/superadmin',
      admin:    '/admin',
      empleado: '/empleado/perfil',
    }
    return NextResponse.redirect(`${origin}${destinos[usuario.rol] ?? '/empleado/perfil'}`)
  }

  // Usuario nuevo → crear empresa trial + admin con service role (bypasea RLS)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const nombre = data.user.user_metadata?.full_name
    ?? data.user.user_metadata?.name
    ?? data.user.email?.split('@')[0]
    ?? 'Admin'

  // Crear empresa trial
  const { data: empresa, error: empresaError } = await serviceClient
    .from('empresas')
    .insert({
      nombre:            `Empresa de ${nombre}`,
      plan:              'trial',
      activa:            true,
      setup_completo:    false,
      trial_started_at:  new Date().toISOString(),
    })
    .select('id')
    .single()

  if (empresaError || !empresa) {
    console.error('[auth/callback] Error creando empresa:', empresaError?.message)
    return NextResponse.redirect(`${origin}/auth/login?error=setup_error`)
  }

  // Crear fila admin
  const { error: usuarioError } = await serviceClient
    .from('usuarios')
    .insert({
      id:         data.user.id,
      empresa_id: empresa.id,
      email:      data.user.email,
      nombre,
      rol:        'admin',
    })

  if (usuarioError) {
    console.error('[auth/callback] Error creando usuario:', usuarioError.message)
    // Rollback empresa
    await serviceClient.from('empresas').delete().eq('id', empresa.id)
    return NextResponse.redirect(`${origin}/auth/login?error=setup_error`)
  }

  return NextResponse.redirect(`${origin}/admin/setup`)
}
