import { describe, it, expect } from 'vitest'
import {
  calcularEstadoModulos,
  calcularProgresoPct,
  isModuloDesbloqueado,
} from '@/lib/progreso'

// ─────────────────────────────────────────────────────────
// Helpers de fixtures
// ─────────────────────────────────────────────────────────

function fila(modulo: string, bloque: string, completado: boolean) {
  return { modulo, bloque, completado }
}

// ─────────────────────────────────────────────────────────
// calcularEstadoModulos
// ─────────────────────────────────────────────────────────

describe('calcularEstadoModulos', () => {
  it('M1 siempre true sin importar el progreso', () => {
    const estado = calcularEstadoModulos([], 5)
    expect(estado.M1).toBe(true)
  })

  it('M2 false cuando no hay filas de cultura', () => {
    const estado = calcularEstadoModulos([], 5)
    expect(estado.M2).toBe(false)
  })

  it('M2 false cuando totalBloquesCultura es 0 (empresa sin contenido)', () => {
    const estado = calcularEstadoModulos([], 0)
    expect(estado.M2).toBe(false)
  })

  it('M2 false cuando hay bloques de cultura pero no todos completados', () => {
    const filas = [
      fila('cultura', 'historia', true),
      fila('cultura', 'mision', false),
    ]
    const estado = calcularEstadoModulos(filas, 2)
    expect(estado.M2).toBe(false)
  })

  it('M2 true cuando todos los bloques de cultura están completados', () => {
    const filas = [
      fila('cultura', 'historia', true),
      fila('cultura', 'mision', true),
      fila('cultura', 'valores', true),
    ]
    const estado = calcularEstadoModulos(filas, 3)
    expect(estado.M2).toBe(true)
  })

  it('M2 false si hay más bloques en DB que completados', () => {
    // 3 completados pero la empresa tiene 5 bloques en total
    const filas = [
      fila('cultura', 'historia', true),
      fila('cultura', 'mision', true),
      fila('cultura', 'valores', true),
    ]
    const estado = calcularEstadoModulos(filas, 5)
    expect(estado.M2).toBe(false)
  })

  it('M3 false cuando no hay filas de rol', () => {
    const estado = calcularEstadoModulos([], 5)
    expect(estado.M3).toBe(false)
  })

  it('M3 true cuando hay al menos un bloque de rol completado', () => {
    const filas = [fila('rol', 'puesto', true)]
    const estado = calcularEstadoModulos(filas, 5)
    expect(estado.M3).toBe(true)
  })

  it('M3 false cuando el bloque de rol existe pero NO está completado', () => {
    const filas = [fila('rol', 'puesto', false)]
    const estado = calcularEstadoModulos(filas, 5)
    expect(estado.M3).toBe(false)
  })

  it('M4 false cuando no hay filas de asistente', () => {
    const estado = calcularEstadoModulos([], 5)
    expect(estado.M4).toBe(false)
  })

  it('M4 true cuando hay al menos un bloque de asistente completado', () => {
    const filas = [fila('asistente', 'chat', true)]
    const estado = calcularEstadoModulos(filas, 5)
    expect(estado.M4).toBe(true)
  })

  it('calcula todos los módulos juntos correctamente (estado parcial)', () => {
    const filas = [
      fila('cultura', 'historia', true),
      fila('cultura', 'mision', true),
      fila('rol', 'puesto', false),
    ]
    const estado = calcularEstadoModulos(filas, 2)
    expect(estado).toEqual({ M1: true, M2: true, M3: false, M4: false })
  })

  it('calcula todos los módulos juntos correctamente (onboarding completo)', () => {
    const filas = [
      fila('cultura', 'historia', true),
      fila('cultura', 'mision', true),
      fila('rol', 'puesto', true),
      fila('asistente', 'chat', true),
    ]
    const estado = calcularEstadoModulos(filas, 2)
    expect(estado).toEqual({ M1: true, M2: true, M3: true, M4: true })
  })

  it('ignora filas de otros módulos al calcular M2', () => {
    // Filas de rol y asistente no deben afectar M2
    const filas = [
      fila('rol', 'puesto', true),
      fila('asistente', 'chat', true),
    ]
    const estado = calcularEstadoModulos(filas, 3)
    expect(estado.M2).toBe(false)
  })

  it('no rompe con filas de módulos desconocidos', () => {
    const filas = [fila('modulo_raro', 'bloque_raro', true)]
    expect(() => calcularEstadoModulos(filas, 3)).not.toThrow()
  })
})

// ─────────────────────────────────────────────────────────
// calcularProgresoPct
// ─────────────────────────────────────────────────────────

describe('calcularProgresoPct', () => {
  it('0% cuando ningún módulo está completo', () => {
    const pct = calcularProgresoPct({ M1: false, M2: false, M3: false, M4: false })
    expect(pct).toBe(0)
  })

  it('33% cuando solo M1 está completo (caso imposible en práctica pero válido en cálculo)', () => {
    const pct = calcularProgresoPct({ M1: true, M2: false, M3: false, M4: false })
    expect(pct).toBe(33)
  })

  it('67% cuando M1 y M2 están completos', () => {
    const pct = calcularProgresoPct({ M1: true, M2: true, M3: false, M4: false })
    expect(pct).toBe(67)
  })

  it('100% cuando M1, M2 y M3 están completos', () => {
    const pct = calcularProgresoPct({ M1: true, M2: true, M3: true, M4: false })
    expect(pct).toBe(100)
  })

  it('100% también cuando M4 está completo (M4 no cuenta en el %)', () => {
    const pct = calcularProgresoPct({ M1: true, M2: true, M3: true, M4: true })
    expect(pct).toBe(100)
  })

  it('M4 no afecta el porcentaje — misma % con o sin M4', () => {
    const sinM4 = calcularProgresoPct({ M1: true, M2: true, M3: false, M4: false })
    const conM4 = calcularProgresoPct({ M1: true, M2: true, M3: false, M4: true })
    expect(sinM4).toBe(conM4)
  })

  it('devuelve un número entero (Math.round)', () => {
    const pct = calcularProgresoPct({ M1: true, M2: false, M3: false, M4: false })
    expect(Number.isInteger(pct)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────
// isModuloDesbloqueado
// ─────────────────────────────────────────────────────────

describe('isModuloDesbloqueado', () => {
  const estadoTodo = [true, true, true, true]
  const estadoNada = [false, false, false, false]
  const estadoParcial = [true, true, false, false] // M1 y M2 ok, M3 y M4 no

  it('M1 (idx 0) siempre está desbloqueado', () => {
    expect(isModuloDesbloqueado(0, estadoNada, false)).toBe(true)
    expect(isModuloDesbloqueado(0, estadoNada, true)).toBe(true)
  })

  it('M2 (idx 1) desbloqueado solo si M1 está completo', () => {
    expect(isModuloDesbloqueado(1, [true, false, false, false], false)).toBe(true)
    expect(isModuloDesbloqueado(1, [false, false, false, false], false)).toBe(false)
  })

  it('M3 (idx 2) desbloqueado solo si M2 está completo', () => {
    expect(isModuloDesbloqueado(2, [true, false, false, false], false)).toBe(false) // M2 no completo → M3 locked
    expect(isModuloDesbloqueado(2, estadoTodo, false)).toBe(true)
  })

  it('M3 bloqueado en preboarding aunque M2 esté completo', () => {
    expect(isModuloDesbloqueado(2, estadoTodo, true)).toBe(false)
  })

  it('M4 bloqueado en preboarding aunque M3 esté completo', () => {
    expect(isModuloDesbloqueado(3, estadoTodo, true)).toBe(false)
  })

  it('M4 (idx 3) desbloqueado fuera de preboarding si M3 completo', () => {
    expect(isModuloDesbloqueado(3, estadoTodo, false)).toBe(true)
  })

  it('M4 bloqueado fuera de preboarding si M3 no completo', () => {
    expect(isModuloDesbloqueado(3, estadoParcial, false)).toBe(false)
  })
})
