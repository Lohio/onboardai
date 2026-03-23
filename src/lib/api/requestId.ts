// Genera un ID único por request para correlación en logs
export function generateRequestId(): string {
  return crypto.randomUUID()
}
