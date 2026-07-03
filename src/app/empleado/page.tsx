// Server Component: home del empleado (M5).
// Hace la carga inicial de datos base server-side (sesión + usuario
// + progreso + plan + total de bloques de cultura en paralelo) y
// delega TODO el JSX/estado/interactividad en <EmpleadoHomeClient />.
// El skeleton vive en ./loading.tsx (Suspense boundary del segmento).
//
// La carga lazy por tab (equipo, cultura, tareas, conversaciones) y la
// verificación de encuesta de pulso siguen resolviéndose client-side.

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { cargarHomeEmpleado, datosHomeVacios } from '@/lib/homeEmpleado'
import type { DatosHomeEmpleado } from '@/lib/homeEmpleado'
import { EmpleadoHomeClient } from '@/components/empleado/home/EmpleadoHomeClient'

export default async function EmpleadoHomePage() {
  const supabase = await createServerSupabaseClient()

  // El middleware ya garantiza sesión + rol, pero manejamos el caso null igual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  let datos: DatosHomeEmpleado = datosHomeVacios()
  let errorInicial = false

  try {
    datos = await cargarHomeEmpleado(supabase, user.id)
  } catch (err) {
    // El client muestra el ErrorState con retry (mismo estado de error que antes)
    console.error('[EmpleadoHome] carga server-side:', err)
    errorInicial = true
  }

  return <EmpleadoHomeClient datosIniciales={datos} errorInicial={errorInicial} />
}
