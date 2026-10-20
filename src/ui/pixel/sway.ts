import type { PropSprite } from './props'

/**
 * Fotogramas de mecido para un sprite.
 *
 * Mecerlos con `rotate()` es lo obvio y se ve mal: media vuelta de grado
 * resamplea el dibujo y rompe la rejilla de pixeles, justo lo contrario de lo
 * que buscamos. Esto los cizalla por pixeles ENTEROS -la copa se desplaza uno,
 * la base no se mueve-, que es como lo dibujaria alguien a mano y deja cada
 * pixel donde estaba.
 *
 * El ciclo es 0, +1, 0, -1: una oscilacion de verdad y no un salto.
 */
const OFFSETS = [0, 1, 0, -1]

export const SWAY_FRAMES = OFFSETS.length

/** Desplaza cada fila segun su altura: arriba todo, abajo nada. */
function shear(rows: string[], amount: number): string[] {
  if (amount === 0) return rows
  const h = rows.length
  return rows.map((row, y) => {
    // Perfil cuadratico: el movimiento se concentra en la parte alta, que es
    // la que un tallo mueve de verdad.
    const t = 1 - y / (h - 1)
    const shift = Math.round(amount * t * t)
    if (shift === 0) return row
    const pad = '.'.repeat(Math.abs(shift))
    return shift > 0 ? pad + row.slice(0, -shift) : row.slice(-shift) + pad
  })
}

const cache = new Map<string, string[][]>()

/** Las poses de un prop, de izquierda a derecha en la hoja. */
export function swayFrames(name: string, prop: PropSprite, amount: number): string[][] {
  const key = `${name}:${amount}`
  let frames = cache.get(key)
  if (!frames) {
    frames = OFFSETS.map((offset) => shear(prop.rows, offset * amount))
    cache.set(key, frames)
  }
  return frames
}
