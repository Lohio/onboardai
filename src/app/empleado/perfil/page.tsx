// Server Component: perfil del empleado (M1).
// Hace la carga inicial server-side (sesión + queries en paralelo,
// passwords descifradas con safeDecrypt) y delega TODO el
// JSX/estado/interactividad en <PerfilClient />.
// El skeleton vive en ./loading.tsx (Suspense boundary del segmento).

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { safeDecrypt } from '@/lib/encryption'
import { cargarPerfilEmpleado, datosPerfilVacios } from '@/lib/perfilEmpleado'
import type { DatosPerfilEmpleado, PerfilPasswords } from '@/lib/perfilEmpleado'
import { PerfilClient } from '@/components/empleado/perfil/PerfilClient'

export default async function PerfilPage() {
  const supabase = await createServerSupabaseClient()

  // El middleware ya garantiza sesión + rol, pero manejamos el caso null igual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  let datos: DatosPerfilEmpleado = datosPerfilVacios()
  let errorInicial = false

  try {
    // Passwords cifradas: se leen y descifran server-side
    // (mismo flujo que GET /api/empleado/perfil/passwords)
    const { data: passRow } = await supabase
      .from('usuarios')
      .select('password_corporativo, password_bitlocker')
      .eq('id', user.id)
      .single()

    const passwords: PerfilPasswords = {
      password_corporativo: safeDecrypt(passRow?.password_corporativo),
      password_bitlocker: safeDecrypt(passRow?.password_bitlocker),
    }

    datos = await cargarPerfilEmpleado(supabase, user.id, passwords)
  } catch (err) {
    // El client muestra el ErrorState con retry (mismo estado de error que antes)
    console.error('[Perfil] carga server-side:', err)
    errorInicial = true
  }

  return <PerfilClient datosIniciales={datos} errorInicial={errorInicial} />
}
