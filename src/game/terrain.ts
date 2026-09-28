import type { SectorKey } from './types'

// Isla inicial: 36 celdas conectadas en una silueta asimétrica dentro de la
// matriz 10×8. Mantener los índices aquí permite migrar partidas sin perder
// edificios y compartir la misma regla entre motor y presentación.
export const COAST_BUILDABLE_INDICES = [
  11, 12,
  18, 19, 20, 21,
  25, 26, 27, 28, 29, 30,
  32, 33, 34, 35, 36, 37, 38,
  41, 42, 43, 44, 45, 46, 47,
  49, 50, 51, 52, 53, 54,
  58, 59, 60, 61,
] as const

export const COAST_BUILDABLE_SET = new Set<number>(COAST_BUILDABLE_INDICES)

// Distrito Neón: 72 celdas (el doble de la costa inicial) separadas por una
// franja completa de agua. La presentación distribuye las 48 celdas principales
// y las 24 secundarias en dos siluetas construibles escalonadas y no rectangulares.
export const CYBERPUNK_BUILDABLE_INDICES = [
  0, 1, 2, 3, 4, 5, 6, 7,
  8, 9, 10, 11, 12, 13, 14, 15,
  16, 17, 18, 19, 20, 21, 22, 23,
  24, 25, 26, 27, 28, 29, 30, 31,
  32, 33, 34, 35, 36, 37, 38, 39,
  40, 41, 42, 43, 44, 45, 46, 47,
  56, 57, 58, 59, 60, 61, 62, 63,
  64, 65, 66, 67, 68, 69, 70, 71,
  72, 73, 74, 75, 76, 77, 78, 79,
] as const

export const CYBERPUNK_BUILDABLE_SET = new Set<number>(CYBERPUNK_BUILDABLE_INDICES)

// El Distrito Neón no se dibuja con la grilla cruda: rota su topología y
// desplaza franjas enteras para que la zona construible forme entrantes. Esa
// transformación NO conserva la vecindad, así que motor y presentación tienen
// que leerla del mismo sitio o el juego simula una red distinta de la que se ve.
const CYBERPUNK_MAIN_SHIFT = [2, 2, 0, 0, 1, 1, 0, 0]
const CYBERPUNK_SECONDARY_SHIFT = [1, 1, 0, 0, 0, 1, 1, 0]

/** Posición de una casilla en el mapa, sin el desplazamiento de la isla. */
export function cellPosition(sector: SectorKey, index: number, cols: number): { x: number; y: number } {
  const row = Math.floor(index / cols)
  const col = index % cols
  if (sector !== 'desert') return { x: col, y: row }
  if (row < 6) return { x: row + CYBERPUNK_MAIN_SHIFT[col], y: col }
  if (row >= 7) return { x: 11 + (row - 7) + CYBERPUNK_SECONDARY_SHIFT[col], y: 2 + col }
  return { x: 0, y: row }
}

const buildableFor = (sector: SectorKey) => sector === 'desert' ? CYBERPUNK_BUILDABLE_SET : COAST_BUILDABLE_SET
const neighbourCache = new Map<string, number[][]>()

/**
 * Vecinos ortogonales de cada casilla tal como quedan dibujados en el mapa.
 * Es la única definición de "estar pegados" que debe usar el juego.
 */
export function neighbourTable(sector: SectorKey, rows: number, cols: number): number[][] {
  const key = `${sector}:${rows}x${cols}`
  const cached = neighbourCache.get(key)
  if (cached) return cached

  const total = rows * cols
  const buildable = buildableFor(sector)
  const indexAt = new Map<string, number>()
  for (let index = 0; index < total; index += 1) {
    const { x, y } = cellPosition(sector, index, cols)
    const at = `${x},${y}`
    // Las casillas no construibles pueden compartir posición; nunca llevan
    // piezas, así que la construible siempre gana el lugar.
    if (!indexAt.has(at) || buildable.has(index)) indexAt.set(at, index)
  }

  const table: number[][] = []
  for (let index = 0; index < total; index += 1) {
    const { x, y } = cellPosition(sector, index, cols)
    const neighbours: number[] = []
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const found = indexAt.get(`${x + dx},${y + dy}`)
      if (found !== undefined && found !== index) neighbours.push(found)
    }
    table.push(neighbours)
  }
  neighbourCache.set(key, table)
  return table
}

export function neighbourIndices(sector: SectorKey, index: number, rows: number, cols: number): number[] {
  return neighbourTable(sector, rows, cols)[index] ?? []
}
