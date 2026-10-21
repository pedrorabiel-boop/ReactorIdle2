import { describe, expect, it } from 'vitest'
import { formatCompact, formatMultiplier, formatPlain } from './format'

describe('formatPlain', () => {
  it('deja el numero completo y sin decimales', () => {
    expect(formatPlain(10.4456)).toBe('10')
    expect(formatPlain(1234567.89)).toBe('1.234.567')
  })

  it('trunca en vez de redondear, para no prometer dinero que no hay', () => {
    // Con 9,8 creditos no se puede pagar algo que cuesta 10.
    expect(formatPlain(9.8)).toBe('9')
    expect(formatPlain(999.99)).toBe('999')
  })

  it('conserva decimales por debajo de 1, donde el cero mentiria', () => {
    // Un molino rinde 0,2 E/s: "0/s" se leeria como que no produce nada.
    expect(formatPlain(0.2)).toBe('0,2')
    expect(formatPlain(0)).toBe('0')
  })
})

describe('formatMultiplier', () => {
  it('llega a tres decimales: 1,015 no cabe en dos', () => {
    expect(formatMultiplier(1.015)).toBe('1,015')
    expect(formatMultiplier(1.05)).toBe('1,05')
  })
})

describe('formatCompact en los precios', () => {
  it('abrevia lo que desbordaba y deja intacto el juego temprano', () => {
    expect(formatCompact(250)).toBe('250')
    expect(formatCompact(9_999)).toBe('9.999')
    expect(formatCompact(2_921_591_507_057)).toBe('2,92T')
    expect(formatCompact(2_000_000_000)).toBe('2G')
  })
})
