import { describe, it, expect } from 'vitest'
import {
  detectarTema,
  fechaLegible,
  respuestaPorTema,
  generarTokenInvitacion,
  type DatosBienvenida,
  type Tema,
} from '@/lib/bienvenidaCore'

const base: DatosBienvenida = {
  nombreEmpleado:    'Sofía',
  nombreEmpresa:     'MailAmericas',
  fechaIngreso:      '2026-06-09',
  horaIngreso:       '9:00',
  direccion:         'Av. Corrientes 1234, CABA',
  mapsUrl:           'https://maps.google.com/x',
  comoLlegar:        'Línea B, estación Uruguay',
  referenteNombre:   'Juan Pérez',
  referenteContacto: 'juan@empresa.com',
}

const vacio: DatosBienvenida = {
  nombreEmpleado:    'Sofía',
  nombreEmpresa:     'MailAmericas',
  fechaIngreso:      null,
  horaIngreso:       null,
  direccion:         null,
  mapsUrl:           null,
  comoLlegar:        null,
  referenteNombre:   null,
  referenteContacto: null,
}

describe('detectarTema', () => {
  it('detecta ubicacion con "¿Dónde queda?"', () => {
    expect(detectarTema('¿Dónde queda la oficina?')).toBe<Tema>('ubicacion')
  })
  it('detecta ubicacion con "cómo llego"', () => {
    expect(detectarTema('cómo llego a la oficina')).toBe<Tema>('ubicacion')
  })
  it('detecta hora con "a qué hora llego"', () => {
    expect(detectarTema('a qué hora llego')).toBe<Tema>('hora')
  })
  it('detecta hora con "cuándo entro"', () => {
    expect(detectarTema('cuándo entro el primer día')).toBe<Tema>('hora')
  })
  it('detecta referente con "por quién pregunto"', () => {
    expect(detectarTema('por quién pregunto cuando llegue')).toBe<Tema>('referente')
  })
  it('detecta referente con "quién me recibe"', () => {
    expect(detectarTema('quién me recibe')).toBe<Tema>('referente')
  })
  it('detecta resumen con "contame mi primer día"', () => {
    expect(detectarTema('contame mi primer día')).toBe<Tema>('resumen')
  })
  it('detecta resumen con "✨ Mi primer día" (botón con emoji)', () => {
    expect(detectarTema('✨ Mi primer día')).toBe<Tema>('resumen')
  })
  it('ignora emojis del botón de ubicación', () => {
    expect(detectarTema('📍 Dónde queda')).toBe<Tema>('ubicacion')
  })
  it('ignora emojis del botón de hora', () => {
    expect(detectarTema('🕘 A qué hora llego')).toBe<Tema>('hora')
  })
  it('ignora emojis del botón de referente', () => {
    expect(detectarTema('🙋 Por quién pregunto')).toBe<Tema>('referente')
  })
  it('cae en "otro" para preguntas fuera de scope', () => {
    expect(detectarTema('cuánto voy a cobrar')).toBe<Tema>('otro')
  })
  it('cae en "otro" para preguntas sobre cultura', () => {
    expect(detectarTema('cuáles son los valores de la empresa')).toBe<Tema>('otro')
  })
})

describe('fechaLegible', () => {
  it('formatea una fecha ISO en español', () => {
    const resultado = fechaLegible('2026-06-09')
    expect(resultado).not.toBe('tu primer día')
    expect(resultado).toContain('junio')
  })
  it('retorna fallback para null', () => {
    expect(fechaLegible(null)).toBe('tu primer día')
  })
})

describe('respuestaPorTema con datos completos', () => {
  it('ubicacion incluye dirección y link de maps', () => {
    const t = respuestaPorTema('ubicacion', base)
    expect(t).toContain('Corrientes 1234')
    expect(t).toContain('maps.google.com')
    expect(t).toContain('Línea B')
  })
  it('hora incluye la hora configurada', () => {
    expect(respuestaPorTema('hora', base)).toContain('9:00')
  })
  it('referente nombra al referente y su email', () => {
    const t = respuestaPorTema('referente', base)
    expect(t).toContain('Juan Pérez')
    expect(t).toContain('juan@empresa.com')
  })
  it('resumen incluye empresa, fecha, dirección y referente', () => {
    const t = respuestaPorTema('resumen', base)
    expect(t).toContain('MailAmericas')
    expect(t).toContain('9:00')
    expect(t).toContain('Corrientes 1234')
    expect(t).toContain('Juan Pérez')
  })
  it('resumen no contiene artefactos de .replace()', () => {
    const t = respuestaPorTema('resumen', base)
    expect(t).not.toContain(' Preguntá por')
  })
})

describe('respuestaPorTema con datos faltantes', () => {
  it('ubicacion sin dirección da mensaje de "todavía no tengo"', () => {
    expect(respuestaPorTema('ubicacion', vacio)).toContain('Todavía no tengo')
  })
  it('hora sin horaIngreso dice que lo confirmará', () => {
    expect(respuestaPorTema('hora', vacio)).toContain('confirmen')
  })
  it('referente sin nombre dirige a recepción', () => {
    expect(respuestaPorTema('referente', vacio)).toContain('recepción')
  })
  it('resumen sin datos no lanza excepción', () => {
    expect(() => respuestaPorTema('resumen', vacio)).not.toThrow()
    const t = respuestaPorTema('resumen', vacio)
    expect(t).toContain('MailAmericas')
  })
})

describe('generarTokenInvitacion', () => {
  it('genera exactamente 32 caracteres hex', () => {
    expect(generarTokenInvitacion()).toMatch(/^[0-9a-f]{32}$/)
  })
  it('genera tokens únicos en llamadas sucesivas', () => {
    const tokens = Array.from({ length: 10 }, generarTokenInvitacion)
    const unicos = new Set(tokens)
    expect(unicos.size).toBe(10)
  })
})
