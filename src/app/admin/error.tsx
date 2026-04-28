'use client'

import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AdminError boundary]', error)
  }, [error])

  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-lg w-full rounded-2xl border border-red-500/20 bg-red-500/5 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-red-400">Error en el panel</h2>
        <pre className="text-xs text-white/60 whitespace-pre-wrap break-all bg-black/20 rounded-lg p-3 max-h-48 overflow-y-auto">
          {error?.message ?? 'Error desconocido'}
          {'\n\n'}
          {error?.stack ?? ''}
        </pre>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15
            text-sm text-white/70 transition-colors duration-150"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
