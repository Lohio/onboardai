// Sistema centralizado de envío de emails vía Resend

import type { EmailTemplate, RenderedEmail } from './types'

const DEFAULT_FROM = 'Heero <noreply@heero.app>'

// ─────────────────────────────────────────────
// Registro de templates
// ─────────────────────────────────────────────

// Cada template exporta una función `render(props) => RenderedEmail`
// Se importan dinámicamente para evitar cargar todo el HTML en memoria

async function renderTemplate(template: EmailTemplate): Promise<RenderedEmail> {
  switch (template.tipo) {
    case 'bienvenida-admin': {
      const { render } = await import('./templates/00-bienvenida-admin')
      return render(template.props)
    }
    case 'bienvenida-colaborador': {
      const { render } = await import('./templates/01-bienvenida-colaborador')
      return render(template.props)
    }
    case 'recordatorio-modulo': {
      const { render } = await import('./templates/02-recordatorio-modulo')
      return render(template.props)
    }
    case 'resumen-semanal-empleado': {
      const { render } = await import('./templates/03-resumen-semanal-empleado')
      return render(template.props)
    }
    case 'alerta-admin': {
      const { render } = await import('./templates/04-alerta-admin')
      return render(template.props)
    }
    case 'cierre-onboarding': {
      const { render } = await import('./templates/05-cierre-onboarding')
      return render(template.props)
    }
    case 'invitacion-workspace': {
      const { render } = await import('./templates/06-invitacion-workspace')
      return render(template.props)
    }
    case 'pulso-semanal': {
      const { render } = await import('./templates/07-pulso-semanal')
      return render(template.props)
    }
    case 'modulo-diario-fallback': {
      const { render } = await import('./templates/08-modulo-diario-fallback')
      return render(template.props)
    }
    case 'resumen-semanal-admin': {
      const { render } = await import('./templates/09-resumen-semanal-admin')
      return render(template.props)
    }
    case 'nuevo-empleado-admin': {
      const { render } = await import('./templates/10-nuevo-empleado-admin')
      return render(template.props)
    }
    case 'prueba-expirando': {
      const { render } = await import('./templates/11-prueba-expirando')
      return render(template.props)
    }
  }
}

// ─────────────────────────────────────────────
// Función principal de envío
// ─────────────────────────────────────────────

interface SendEmailResult {
  ok: boolean
  /** ID del email enviado (solo si se envió vía Resend) */
  emailId?: string
  /** Error si falló el envío */
  error?: string
}

/**
 * Envía un email usando el template indicado.
 * Si no hay RESEND_API_KEY, loguea el email en consola (modo desarrollo).
 */
export async function sendEmail(
  to: string,
  template: EmailTemplate
): Promise<SendEmailResult> {
  const { subject, html } = await renderTemplate(template)
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM
  const resendKey = process.env.RESEND_API_KEY

  // Sin API key: loguear en consola para desarrollo
  if (!resendKey) {
    console.log('[email] RESEND_API_KEY no configurada. Email que se enviaría:')
    console.log(`  De: ${from}`)
    console.log(`  Para: ${to}`)
    console.log(`  Asunto: ${subject}`)
    return { ok: true }
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(resendKey)

    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      html,
    })

    if (error) {
      console.error('[email] Error al enviar vía Resend:', error)
      return { ok: false, error: error.message }
    }

    return { ok: true, emailId: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[email] Error al inicializar Resend:', message)
    return { ok: false, error: message }
  }
}

// Re-exportar tipos para conveniencia
export type { EmailTemplate, RenderedEmail } from './types'
export type {
  BienvenidaAdminProps,
  BienvenidaColaboradorProps,
  RecordatorioModuloProps,
  ResumenSemanalEmpleadoProps,
  AlertaAdminProps,
  CierreOnboardingProps,
  InvitacionWorkspaceProps,
  PulsoSemanalProps,
  ModuloDiarioFallbackProps,
  ResumenSemanalAdminProps,
  NuevoEmpleadoAdminProps,
  PruebaExpirandoProps,
} from './types'
