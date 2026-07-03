// Skeleton del dashboard admin — se muestra mientras el Server Component
// de /admin resuelve sus queries (Suspense boundary del segmento).
// Mismo markup que el skeleton que antes vivía dentro de la página.

export default function Loading() {
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 rounded-xl bg-white/[0.04] animate-pulse border border-white/[0.04]" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-2">
          <div className="h-10 rounded-lg bg-white/[0.04] animate-pulse" />
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-64 rounded-xl bg-white/[0.04] animate-pulse" />
        </div>
      </div>
    </div>
  )
}
