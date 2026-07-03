// Skeleton del dashboard interno (dev) — se muestra mientras el Server
// Component de /dev resuelve sus queries (Suspense boundary del segmento).
// Mismo markup que el skeleton que antes vivía dentro de la página.

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="shimmer h-6 w-40 rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shimmer h-28 rounded-xl" />
        ))}
      </div>
      <div className="shimmer h-48 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="shimmer h-44 rounded-xl" />
        <div className="shimmer h-44 rounded-xl" />
      </div>
    </div>
  )
}
