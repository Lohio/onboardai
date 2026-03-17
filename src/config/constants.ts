// ─────────────────────────────────────────────
// Constantes globales de la aplicación
// ─────────────────────────────────────────────

// Semáforo de progreso (umbrales en porcentaje)
export const SEMAFORO_VERDE = 70    // ≥ 70 → teal
export const SEMAFORO_AMARILLO = 30 // ≥ 30 → amber | < 30 → rojo

// Módulos de cultura
export const BLOQUES_CULTURA = ['historia', 'mision', 'como_trabajamos', 'expectativas', 'hitos'] as const
export const DEFAULT_BLOQUES_CULTURA = 5

// Días en que se crean las encuestas de pulso
export const DIAS_ENCUESTA_PULSO = [7, 30, 60] as const

// Paginación
export const PAGE_SIZE_EMPLEADOS = 50

// Historial de mensajes IA cargados por conversación
export const MAX_MENSAJES_HISTORIAL = 20
