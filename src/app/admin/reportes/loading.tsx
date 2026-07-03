// Skeleton de la vista de reportes admin — se muestra mientras el Server
// Component de /admin/reportes resuelve sus queries (Suspense boundary del segmento).
// Mismo markup que el skeleton que antes vivía dentro de la página.

function SkeletonColumna() {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="shimmer h-4 w-24 rounded mb-1" />
        <div className="shimmer h-3 w-16 rounded" />
      </div>
      <div className="p-3 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="shimmer rounded-lg h-24" />
        ))}
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="shimmer h-5 w-32 rounded-lg" />
          <div className="shimmer h-3.5 w-48 rounded" />
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map(i => <div key={i} className="shimmer h-8 w-20 rounded-lg" />)}
        </div>
      </div>
      {/* Columnas skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <SkeletonColumna key={i} />)}
      </div>
    </div>
  )
}
