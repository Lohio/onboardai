// Skeleton del panel de usuarios (dev) — se muestra mientras el Server
// Component de /dev/usuarios resuelve sus queries (Suspense boundary del segmento).
// Mismo markup que el skeleton que antes vivía dentro de la página.

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="h-6 w-32 rounded bg-white/[0.04] animate-pulse" />
          <div className="h-4 w-40 rounded bg-white/[0.03] animate-pulse mt-1.5" />
        </div>
        <div className="h-4 w-28 rounded bg-white/[0.04] animate-pulse" />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="h-9 flex-1 rounded-lg bg-white/[0.04] animate-pulse" />
        <div className="h-9 w-40 rounded-lg bg-white/[0.04] animate-pulse" />
        <div className="h-9 w-40 rounded-lg bg-white/[0.04] animate-pulse" />
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shimmer h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
