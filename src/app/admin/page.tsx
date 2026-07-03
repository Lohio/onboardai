// Server Component: dashboard del admin.
// Hace la carga inicial server-side (sesión + queries en paralelo)
// y delega TODO el JSX/estado/interactividad en <DashboardClient />.
// El skeleton vive en ./loading.tsx (Suspense boundary del segmento).

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { cargarDashboardAdmin, datosDashboardVacios } from '@/lib/dashboardAdmin'
import type { DatosDashboardAdmin } from '@/lib/dashboardAdmin'
import { DashboardClient } from '@/components/admin/dashboard/DashboardClient'

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabaseClient()

  // El middleware ya garantiza sesión + rol, pero manejamos el caso null igual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('empresa_id')
    .eq('id', user.id)
    .single()

  const empresaId: string | null = usuario?.empresa_id ?? null

  let datos: DatosDashboardAdmin = datosDashboardVacios()
  if (empresaId) {
    try {
      datos = await cargarDashboardAdmin(supabase, empresaId)
    } catch (err) {
      // Mismo comportamiento que antes: loguear y renderizar con datos vacíos
      console.error('[Dashboard]', err)
    }
  }

  return <DashboardClient empresaId={empresaId} datosIniciales={datos} />
}
