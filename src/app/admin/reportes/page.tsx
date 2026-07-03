// Server Component: vista de reportes del admin (Kanban por franja 30/60/90 días).
// Hace la carga inicial server-side (sesión + queries en paralelo)
// y delega TODO el JSX/estado/interactividad en <ReportesClient />.
// El skeleton vive en ./loading.tsx (Suspense boundary del segmento).

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { cargarReportesAdmin, datosReportesVacios } from '@/lib/reportesAdmin'
import type { DatosReportesAdmin } from '@/lib/reportesAdmin'
import { ReportesClient } from '@/components/admin/reportes/ReportesClient'

export default async function ReportesPage() {
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

  let datos: DatosReportesAdmin = datosReportesVacios()
  let errorInicial = false
  if (empresaId) {
    try {
      datos = await cargarReportesAdmin(supabase, empresaId)
    } catch (err) {
      // Mismo comportamiento que antes: loguear y dejar que el client muestre ErrorState
      console.error('[Reportes]', err)
      errorInicial = true
    }
  }

  return (
    <ReportesClient
      empresaId={empresaId}
      datosIniciales={datos}
      errorInicial={errorInicial}
    />
  )
}
