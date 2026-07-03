// Skeleton de la lista de empleados — se muestra mientras el Server Component
// de /admin/empleados resuelve sus queries (Suspense boundary del segmento).
// Reproduce el layout de dos paneles con el skeleton de la lista a la izquierda.

export default function Loading() {
  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="space-y-1.5">
          <div className="h-6 w-40 rounded-lg bg-white/[0.06] animate-pulse" />
          <div className="h-4 w-24 rounded bg-white/[0.04] animate-pulse" />
        </div>
        <div className="h-8 w-32 rounded-xl bg-white/[0.06] animate-pulse" />
      </div>

      {/* Layout dos paneles */}
      <div className="flex gap-4 min-h-0 flex-1">
        {/* Panel izquierdo — lista */}
        <div className="flex flex-col flex-shrink-0 glass-card rounded-xl overflow-hidden w-full md:w-[40%]">
          {/* Filtros */}
          <div className="p-3 border-b border-white/[0.06] space-y-2 flex-shrink-0">
            <div className="h-8 rounded-lg bg-white/[0.04] animate-pulse" />
            <div className="h-8 rounded-lg bg-white/[0.04] animate-pulse" />
          </div>
          {/* Lista */}
          <div className="flex-1 overflow-hidden">
            <div className="space-y-px">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-white/[0.06] flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-white/[0.06] rounded w-32" />
                    <div className="h-2.5 bg-white/[0.04] rounded w-20" />
                  </div>
                  <div className="w-16 h-1.5 bg-white/[0.04] rounded-full" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/[0.06]" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel derecho — detalle vacío */}
        <div className="flex-1 min-w-0 glass-card rounded-xl overflow-hidden hidden md:flex md:flex-col" />
      </div>
    </div>
  )
}
