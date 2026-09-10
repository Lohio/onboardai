// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.1, // 10% en prod: suficiente para tendencias, evita overhead por request

  // Replay: 10% de sesiones normales, 100% cuando hay un error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Replay se carga lazy más abajo: rrweb pesa ~60-90 KB gz y no hace falta
  // para pintar la página. Los sample rates de arriba siguen aplicando.
  integrations: [],

  enableLogs: true,
  sendDefaultPii: false, // no enviar cookies/headers de sesión a Sentry

  // No capturar errores en desarrollo local
  enabled: process.env.NODE_ENV === 'production',
});

// Cargar Session Replay fuera del camino crítico de render (solo en prod)
if (process.env.NODE_ENV === 'production') {
  const cargarReplay = () => {
    Sentry.lazyLoadIntegration('replayIntegration')
      .then(replayIntegration => {
        Sentry.addIntegration(replayIntegration({ maskAllText: false, blockAllMedia: false }))
      })
      .catch(() => { /* sin replay si falla la carga: no afecta la app */ })
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(cargarReplay)
  } else {
    setTimeout(cargarReplay, 2000)
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
