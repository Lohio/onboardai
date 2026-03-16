// ─────────────────────────────────────────────
// contacto.ts — Herramienta de contacto por empresa
// ─────────────────────────────────────────────

export type HerramientaContacto = 'email' | 'teams' | 'slack' | 'whatsapp' | 'meet'

/**
 * Genera la URL de acción según la herramienta configurada.
 * Devuelve null si la herramienta no soporta URLs basadas en email (ej. WhatsApp).
 */
export function buildContactUrl(herramienta: HerramientaContacto, email: string): string | null {
  switch (herramienta) {
    case 'email':
      return `mailto:${email}`
    case 'teams':
      return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}`
    case 'slack':
      return null // Slack no tiene deep links confiables por email — se usa copiar
    case 'whatsapp':
      return null // Necesita número de teléfono, no email
    case 'meet':
      return `mailto:${email}?subject=Reunión de onboarding`
    default:
      return `mailto:${email}`
  }
}

export const HERRAMIENTA_LABELS: Record<HerramientaContacto, string> = {
  email:    'Email',
  teams:    'Teams',
  slack:    'Slack',
  whatsapp: 'WhatsApp',
  meet:     'Meet',
}
