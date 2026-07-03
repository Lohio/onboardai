// Skeleton del perfil del empleado (M1).
// Sin 'use client': es markup puro, se usa tanto en
// src/app/empleado/perfil/loading.tsx (server) como en
// PerfilClient (retry client-side).

import { cn } from '@/lib/utils'

function SkeletonLine({ width = 'w-full', className }: { width?: string; className?: string }) {
  return <div className={cn('shimmer rounded-md h-4', width, className)} />
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero skeleton */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="shimmer h-20" />
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-7">
            <div className="shimmer rounded-full w-14 h-14 flex-shrink-0" style={{ border: '4px solid #ffffff' }} />
            <SkeletonLine width="w-28" className="h-5 rounded-full mb-1" />
          </div>
          <div className="mt-3 space-y-2">
            <SkeletonLine width="w-40" className="h-5" />
            <SkeletonLine width="w-28" />
            <div className="flex flex-wrap gap-4 mt-3">
              <SkeletonLine width="w-32" />
              <SkeletonLine width="w-44" />
              <SkeletonLine width="w-20" className="h-5 rounded-md" />
            </div>
          </div>
          <div className="h-px bg-gray-200 my-4" />
          <SkeletonLine width="w-full" className="h-10" />
        </div>
      </div>

      {/* Mi onboarding skeleton */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonLine width="w-28" className="h-4" />
          <SkeletonLine width="w-20" className="h-4" />
        </div>
        <SkeletonLine width="w-full" className="h-1.5 rounded-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="shimmer rounded-lg h-20" />
          ))}
        </div>
      </div>

      {/* Equipo skeleton */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 space-y-3">
        <SkeletonLine width="w-24" className="h-4 mb-4" />
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="shimmer rounded-full w-10 h-10 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonLine width="w-32" />
              <SkeletonLine width="w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Skeleton de página completa (mismo wrapper que el render loading original)
export function PerfilSkeleton() {
  return (
    <div className="min-h-dvh p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="shimmer rounded-md h-8 w-40 mb-6" />
        <ProfileSkeleton />
      </div>
    </div>
  )
}
