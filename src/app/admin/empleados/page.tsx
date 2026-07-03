// Server Component: lista de empleados del admin.
// Hace la carga inicial server-side (sesión + rol + queries en paralelo)
// y delega TODO el JSX/estado/interactividad en <EmpleadosListaClient />.
// El skeleton vive en ./loading.tsx (Suspense boundary del segmento).

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { cargarListaEmpleados } from '@/lib/listaEmpleados'
import type { EmpleadoConProgreso } from '@/lib/listaEmpleados'
import { EmpleadosListaClient } from '@/components/admin/empleados/EmpleadosListaClient'
import type { UserRole } from '@/types'

export default async function EmpleadosPage() {
  const supabase = await createServerSupabaseClient()

  // El middleware ya garantiza sesión + rol, pero manejamos el caso null igual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: adminData } = await supabase
    .from('usuarios')
    .select('empresa_id, rol')
    .eq('id', user.id)
    .single()

  if (!adminData || !['admin', 'dev'].includes(adminData.rol)) {
    redirect('/auth/login')
  }

  const rolAdmin = adminData.rol as UserRole
  const empresaId: string | null = adminData.empresa_id ?? null

  let empleados: EmpleadoConProgreso[] = []
  let errorInicial = false
  if (empresaId) {
    try {
      empleados = await cargarListaEmpleados(supabase, empresaId)
    } catch (err) {
      console.error('Error cargando empleados:', err)
      errorInicial = true
    }
  }

  return (
    <EmpleadosListaClient
      empresaId={empresaId}
      rolAdmin={rolAdmin}
      empleadosIniciales={empleados}
      errorInicial={errorInicial}
    />
  )
}
