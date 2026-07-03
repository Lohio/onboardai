// Server Component: panel de empresas (dev).
// Hace la carga inicial server-side (sesión + rol + queries en paralelo)
// y delega TODO el JSX/estado/interactividad en <EmpresasDevClient />.
// El skeleton vive en ./loading.tsx (Suspense boundary del segmento).

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { cargarEmpresasDev, datosEmpresasVacios } from '@/lib/empresasDev'
import type { DatosEmpresasDev } from '@/lib/empresasDev'
import { EmpresasDevClient } from '@/components/dev/empresas/EmpresasDevClient'

export default async function EmpresasPage() {
  const supabase = await createServerSupabaseClient()

  // El middleware ya garantiza sesión + rol dev, pero manejamos ambos casos igual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: ud } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
  if (!ud || ud.rol !== 'dev') redirect('/admin')

  let datos: DatosEmpresasDev = datosEmpresasVacios()
  let errorInicial = false
  try {
    datos = await cargarEmpresasDev(supabase)
  } catch (err) {
    console.error('Error cargando empresas:', err)
    errorInicial = true
  }

  return <EmpresasDevClient datosIniciales={datos} errorInicial={errorInicial} />
}
