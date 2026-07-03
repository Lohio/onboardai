// Skeleton del perfil — se muestra mientras el Server Component
// de /empleado/perfil resuelve sus queries (Suspense boundary del segmento).

import { PerfilSkeleton } from '@/components/empleado/perfil/PerfilSkeleton'

export default function Loading() {
  return <PerfilSkeleton />
}
