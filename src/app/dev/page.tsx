// Server Component: dashboard interno de superadmin (dev).
// Hace la carga inicial server-side (sesión + rol + métricas en paralelo)
// y delega TODO el JSX/estado/interactividad en <DevDashboardClient />.
// El skeleton vive en ./loading.tsx (Suspense boundary del segmento).

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { cargarDashboardDev, datosDashboardDevVacios } from '@/lib/dashboardDev'
import type { DatosDashboardDev } from '@/lib/dashboardDev'
import { DevDashboardClient } from '@/components/dev/dashboard/DevDashboardClient'

export default async function DevDashboardPage() {
  const supabase = await createServerSupabaseClient()

  // El middleware ya garantiza sesión + rol dev, pero manejamos ambos casos igual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: ud } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()
  if (!ud || ud.rol !== 'dev') redirect(ud?.rol === 'admin' ? '/admin' : '/empleado/perfil')

  let datos: DatosDashboardDev = datosDashboardDevVacios()
  let errorInicial = false
  try {
    datos = await cargarDashboardDev(supabase)
  } catch (err) {
    console.error('Error cargando métricas dev:', err)
    errorInicial = true
  }

  return <DevDashboardClient datosIniciales={datos} errorInicial={errorInicial} />
}
