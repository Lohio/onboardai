// Server Component: vista de encuestas de pulso del admin (resumen por día 7/30/60).
// Hace la carga inicial server-side (sesión + queries en paralelo)
// y delega TODO el JSX/estado/interactividad en <EncuestasClient />.
// El skeleton vive en ./loading.tsx (Suspense boundary del segmento).

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { cargarEncuestasAdmin, datosEncuestasVacios } from '@/lib/encuestasAdmin'
import type { DatosEncuestasAdmin } from '@/lib/encuestasAdmin'
import { EncuestasClient } from '@/components/admin/reportes/EncuestasClient'

export default async function EncuestasAdminPage() {
  const supabase = await createServerSupabaseClient()

  // El middleware ya garantiza sesión + rol, pero manejamos el caso null igual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('empresa_id, rol')
    .eq('id', user.id)
    .single()

  if (!perfil || !['admin', 'dev'].includes(perfil.rol)) {
    redirect('/auth/login')
  }

  const empresaId: string | null = perfil?.empresa_id ?? null
  const rol: string = perfil?.rol ?? 'admin'

  let datos: DatosEncuestasAdmin = datosEncuestasVacios()
  let errorInicial = false
  try {
    datos = await cargarEncuestasAdmin(supabase, empresaId, rol)
  } catch (err) {
    // Mismo comportamiento que antes: loguear y dejar que el client muestre ErrorState
    console.error('[encuestas admin]', err)
    errorInicial = true
  }

  return (
    <EncuestasClient
      empresaId={empresaId}
      rol={rol}
      datosIniciales={datos}
      errorInicial={errorInicial}
    />
  )
}
