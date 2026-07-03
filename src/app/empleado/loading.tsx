// Skeleton del home del empleado — se muestra mientras el Server Component
// de /empleado resuelve sus queries (Suspense boundary del segmento).
// Mismo markup que el skeleton que antes vivía dentro de la página.

import { cn } from '@/lib/utils'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-md', className)} />
}

export default function Loading() {
  return (
    <div className="min-h-dvh bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 space-y-4">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 flex-1 rounded-xl" />)}
          </div>
          <div className="space-y-3 pt-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
