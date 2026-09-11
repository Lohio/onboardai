// ─────────────────────────────────────────────
// suscripcionLocal — mini store para useSyncExternalStore sobre localStorage.
// El evento 'storage' del navegador solo se dispara en OTRAS pestañas, así
// que los cambios hechos en la misma pestaña se avisan a mano con notify().
// ─────────────────────────────────────────────

export function crearSuscripcionLocal() {
  const listeners = new Set<() => void>()
  return {
    subscribe(cb: () => void) {
      listeners.add(cb)
      window.addEventListener('storage', cb)
      return () => {
        listeners.delete(cb)
        window.removeEventListener('storage', cb)
      }
    },
    notify() {
      listeners.forEach(cb => cb())
    },
  }
}
