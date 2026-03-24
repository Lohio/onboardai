// ─────────────────────────────────────────────
// Motor de contexto del agente flotante
// Determina qué mensaje proactivo mostrar según
// el módulo, días de onboarding y progreso del empleado.
// ─────────────────────────────────────────────

export interface AgenteParams {
  modulo: 'perfil' | 'cultura' | 'rol' | 'asistente'
  diasOnboarding: number
  progresoTotal: number   // 0–100
  accesosPendientes: number
  moduloCompletado: boolean
  nombreEmpleado: string
}

export interface MensajeProactivo {
  mensaje: string
  ctaPrimario: string
  ctaSecundario: string
}

const CLAVE_SILENCIO = 'agente_silenciado_hasta'

/** Verifica si el agente está en modo silencio por elección del empleado */
export function estasilenciado(): boolean {
  if (typeof window === 'undefined') return false
  const valor = localStorage.getItem(CLAVE_SILENCIO)
  if (!valor) return false
  return new Date(valor) > new Date()
}

/** Silencia los hints proactivos durante 24 horas */
export function silenciarPor24hs(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(
    CLAVE_SILENCIO,
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  )
}

/** Devuelve el mensaje proactivo adecuado según el contexto, o null si no aplica ninguno */
export function getMensajeProactivo(params: AgenteParams, t: (key: string) => string): MensajeProactivo | null {
  const {
    modulo,
    diasOnboarding,
    progresoTotal,
    accesosPendientes,
    moduloCompletado,
    nombreEmpleado,
  } = params

  // Usar solo el primer nombre para el saludo
  const nombre = nombreEmpleado.split(' ')[0] || nombreEmpleado

  // ── Onboarding completo ────────────────────────────────────────
  if (progresoTotal === 100) {
    return {
      mensaje: `¡Completaste el onboarding! 🎉 Ya sos parte del equipo. ¿Tenés alguna pregunta pendiente?`,
      ctaPrimario: 'Hacer una pregunta',
      ctaSecundario: '¡Gracias!',
    }
  }

  // ── Días especiales de encuesta ────────────────────────────────
  if (diasOnboarding === 7 || diasOnboarding === 30 || diasOnboarding === 60) {
    return {
      mensaje: `¡Día ${diasOnboarding} de onboarding! 🎯 Tenés una encuesta corta de 3 preguntas. Tarda 1 minuto.`,
      ctaPrimario: 'Responder ahora',
      ctaSecundario: 'Más tarde',
    }
  }

  // ── Módulo perfil — primer día ─────────────────────────────────
  if (modulo === 'perfil' && diasOnboarding === 1) {
    return {
      mensaje: `¡Bienvenido/a, ${nombre}! 👋 Tu primer paso es revisar tus accesos y completar tu perfil. ¿Empezamos?`,
      ctaPrimario: 'Sí, empecemos',
      ctaSecundario: 'Lo hago después',
    }
  }

  // ── Módulo perfil — accesos pendientes ────────────────────────
  if (modulo === 'perfil' && accesosPendientes > 0) {
    return {
      mensaje: `Tenés ${accesosPendientes} acceso${accesosPendientes > 1 ? 's' : ''} pendiente${accesosPendientes > 1 ? 's' : ''}. Mientras esperás la activación, podés avanzar con el módulo de Cultura.`,
      ctaPrimario: 'Ver Cultura',
      ctaSecundario: 'Entendido',
    }
  }

  // ── Módulo cultura — primeros 7 días sin completar ────────────
  if (modulo === 'cultura' && !moduloCompletado && diasOnboarding <= 7) {
    return {
      mensaje: `El módulo de Cultura te cuenta la historia y valores de la empresa. Las empresas con mejor onboarding lo hacen en los primeros 3 días. ¿Arrancamos?`,
      ctaPrimario: 'Empezar ahora',
      ctaSecundario: 'Más tarde',
    }
  }

  // ── Módulo cultura — más de 3 días sin completar ──────────────
  if (modulo === 'cultura' && diasOnboarding >= 3 && !moduloCompletado) {
    return {
      mensaje: t('hint.cultura.msg').replace('{dias}', String(diasOnboarding)),
      ctaPrimario: t('hint.cultura.cta1'),
      ctaSecundario: t('hint.cultura.cta2'),
    }
  }

  // ── Módulo rol — sin completar ────────────────────────────────
  if (modulo === 'rol' && !moduloCompletado) {
    return {
      mensaje: t('hint.rol.msg'),
      ctaPrimario: t('hint.rol.cta1'),
      ctaSecundario: t('hint.rol.cta2'),
    }
  }

  // ── Caso general: días 7–29 sin completar el módulo actual ────
  const nombreModulo =
    modulo === 'perfil' ? 'Perfil'
    : modulo === 'cultura' ? 'Cultura'
    : modulo === 'rol' ? 'Rol'
    : 'este módulo'

  if (diasOnboarding >= 7 && diasOnboarding < 30 && !moduloCompletado) {
    return {
      mensaje: t('hint.continuar.msg').replace('{dias}', String(diasOnboarding)).replace('{modulo}', nombreModulo),
      ctaPrimario: t('hint.continuar.cta1'),
      ctaSecundario: t('hint.continuar.cta2'),
    }
  }

  // Ninguna condición aplica — no mostrar hint
  return null
}
