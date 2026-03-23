// Logger estructurado compatible con Vercel Log Drain (Datadog / Axiom / Betterstack)

export interface LogEntry {
  timestamp: string
  requestId: string
  level: 'info' | 'warn' | 'error'
  method: string
  path: string
  status: number
  durationMs: number
  userId?: string
  empresaId?: string
  userAgent?: string
  ip?: string
  error?: string
  meta?: Record<string, unknown>
}

export function logRequest(entry: LogEntry): void {
  console.log(JSON.stringify(entry))
}
