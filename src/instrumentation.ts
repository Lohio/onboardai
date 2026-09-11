import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Valida las variables de entorno al arrancar (antes solo se definía el
    // schema pero no se importaba en ningún lado, así que nunca corría).
    await import("@/lib/schemas/env");
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
