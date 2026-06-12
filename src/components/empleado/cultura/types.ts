// ─────────────────────────────────────────────
// Tipos compartidos del módulo de cultura (empleado)
// ─────────────────────────────────────────────

export type BloqueKey = 'historia' | 'mision' | 'como_trabajamos' | 'expectativas' | 'hitos'

export interface Pregunta {
  pregunta: string
  opciones: string[]
  correcta: number
}
