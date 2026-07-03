// Server Component: panel de usuarios (dev).
// Hace la carga inicial server-side (sesión + rol + queries en paralelo)
// y delega TODO el JSX/estado/interactividad en <UsuariosDevClient />.
// El skeleton vive en ./loading.tsx (Suspense boundary del segmento).

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { cargarUsuariosDev, datosUsuariosVacios } from '@/lib/usuariosDev'
import type { DatosUsuariosDev } from '@/lib/usuariosDev'
import { UsuariosDevClient } from '@/components/dev/usuarios/UsuariosDevClient'

export default async function UsuariosPage() {
  const supabase = await createServerSupabaseClient()

  // El middleware ya garantiza sesión + rol dev, pero manejamos ambos casos igual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: ud } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
  if (!ud || ud.rol !== 'dev') redirect('/admin')

  let datos: DatosUsuariosDev = datosUsuariosVacios()
  let errorInicial = false
  try {
    datos = await cargarUsuariosDev(supabase)
  } catch (err) {
    console.error('Error cargando usuarios:', err)
    errorInicial = true
  }

  return <UsuariosDevClient datosIniciales={datos} currentDevId={user.id} errorInicial={errorInicial} />
}
