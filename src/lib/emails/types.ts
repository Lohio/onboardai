// Tipos del sistema de emails

// ─────────────────────────────────────────────
// Props por template
// ─────────────────────────────────────────────

/** 00 — Email de bienvenida al admin que creó su cuenta */
export interface BienvenidaAdminProps {
  nombreAdmin: string
  nombreEmpresa: string
  linkDashboard: string
  fechaVencimientoPrueba: string
}

/** 01 — Email de bienvenida al colaborador (preboarding) */
export interface BienvenidaColaboradorProps {
  nombre: string
  empresa: string
  puesto: string
  fechaIngreso: string
  buddyNombre: string | null
  linkActivacion: string
}

/** 02 — Recordatorio de módulo pendiente */
export interface RecordatorioModuloProps {
  nombre: string
  moduloNombre: string
  linkModulo: string
  diaNumero: number
}

/** 03 — Resumen semanal de progreso para el empleado */
export interface ResumenSemanalEmpleadoProps {
  nombre: string
  semanaNumero: number
  modulosCompletados: number
  tareasCompletadas: number
  progresoTotal: number
  proximaSemana: string
}

/** 04 — Alerta al admin por inactividad de un empleado */
export interface AlertaAdminProps {
  nombreAdmin: string
  nombreEmpleado: string
  diasSinActividad: number
  progresoActual: number
}

/** 05 — Celebración de cierre de onboarding */
export interface CierreOnboardingProps {
  nombre: string
  empresa: string
  diasTotales: number
  modulosCompletados: number
  preguntasRealizadas: number
}

/** 06 — Invitación a unirse al workspace de comunicación */
export interface InvitacionWorkspaceProps {
  nombre: string
  empresa: string
  canal: 'slack' | 'google_chat'
  workspaceName: string
  linkUnirse: string
}

/** 07 — Invitación a completar encuesta de pulso semanal */
export interface PulsoSemanalProps {
  nombre: string
  semanaNumero: number
  linkEncuesta: string
}

/** 08 — Envío principal del módulo del día */
export interface ModuloDiarioFallbackProps {
  nombre: string
  moduloNombre: string
  diaNumero: number
  linkModulo: string
}

/** 09 — Resumen semanal para el admin con KPIs del equipo */
export interface ResumenSemanalAdminProps {
  adminNombre: string
  empresa: string
  empleadosActivos: number
  modulosCompletadosTotal: number
  empleadosEnRiesgo: number
  tasaEngagement: number
  linkDashboard: string
}

/** 10 — Notificación al admin de nuevo colaborador agregado */
export interface NuevoEmpleadoAdminProps {
  adminNombre: string
  empleadoNombre: string
  empleadoPuesto: string
  fechaIngreso: string
  buddyNombre: string | null
  linkDashboard: string
}

/** 11 — Aviso de vencimiento de prueba gratuita */
export interface PruebaExpirandoProps {
  adminNombre: string
  empresa: string
  diasRestantes: number
  empleadosOnboarding: number
  linkContratar: string
}

// ─────────────────────────────────────────────
// Union type de templates
// ─────────────────────────────────────────────

export type EmailTemplate =
  | { tipo: 'bienvenida-admin'; props: BienvenidaAdminProps }
  | { tipo: 'bienvenida-colaborador'; props: BienvenidaColaboradorProps }
  | { tipo: 'recordatorio-modulo'; props: RecordatorioModuloProps }
  | { tipo: 'resumen-semanal-empleado'; props: ResumenSemanalEmpleadoProps }
  | { tipo: 'alerta-admin'; props: AlertaAdminProps }
  | { tipo: 'cierre-onboarding'; props: CierreOnboardingProps }
  | { tipo: 'invitacion-workspace'; props: InvitacionWorkspaceProps }
  | { tipo: 'pulso-semanal'; props: PulsoSemanalProps }
  | { tipo: 'modulo-diario-fallback'; props: ModuloDiarioFallbackProps }
  | { tipo: 'resumen-semanal-admin'; props: ResumenSemanalAdminProps }
  | { tipo: 'nuevo-empleado-admin'; props: NuevoEmpleadoAdminProps }
  | { tipo: 'prueba-expirando'; props: PruebaExpirandoProps }

// ─────────────────────────────────────────────
// Resultado de un template renderizado
// ─────────────────────────────────────────────

export interface RenderedEmail {
  subject: string
  html: string
}
