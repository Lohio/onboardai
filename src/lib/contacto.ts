// ─────────────────────────────────────────────
// contacto.ts — Herramienta de contacto por empresa
// Tipo abierto: herramientas conocidas + strings custom
// ─────────────────────────────────────────────

export type HerramientaContacto = 'email' | 'teams' | 'slack' | 'whatsapp' | 'meet' | string

/**
 * Genera la URL de acción según la herramienta configurada.
 * Para herramientas desconocidas hace fallback a mailto: si hay email disponible.
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
      // Herramienta custom: fallback a mailto: si hay email
      return email ? `mailto:${email}` : null
  }
}

// Labels para herramientas conocidas
export const HERRAMIENTA_LABELS: Record<string, string> = {
  email:    'Email',
  teams:    'Teams',
  slack:    'Slack',
  whatsapp: 'WhatsApp',
  meet:     'Meet',
}

/**
 * Devuelve el label de la herramienta.
 * Para herramientas custom, retorna el nombre tal cual está guardado.
 */
export function getHerramientaLabel(h: string): string {
  return HERRAMIENTA_LABELS[h] ?? h
}
