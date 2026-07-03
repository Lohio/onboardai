// Skeleton del panel de empresas (dev) — se muestra mientras el Server
// Component de /dev/empresas resuelve sus queries (Suspense boundary del segmento).
// Mismo markup que el skeleton que antes vivía dentro de la página.

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="h-6 w-32 rounded bg-white/[0.04] animate-pulse" />
          <div className="h-4 w-40 rounded bg-white/[0.03] animate-pulse mt-1.5" />
        </div>
        <div className="h-8 w-32 rounded-lg bg-white/[0.04] animate-pulse" />
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="shimmer h-24 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
