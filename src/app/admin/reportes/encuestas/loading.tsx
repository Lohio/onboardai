// Skeleton de la vista de encuestas de pulso (admin) — se muestra mientras el
// Server Component de /admin/reportes/encuestas resuelve sus queries
// (Suspense boundary del segmento). Mismo markup que el skeleton que antes
// vivía dentro de la página.

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        <div className="shimmer h-8 w-48 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="shimmer glass-card rounded-xl h-36" />)}
        </div>
        <div className="shimmer glass-card rounded-xl h-64" />
      </div>
    </div>
  )
}
