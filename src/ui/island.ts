import type { GameState, SectorKey } from '../game/types'
import { COAST_BUILDABLE_SET, CYBERPUNK_BUILDABLE_SET } from '../game/terrain'
import type { EnvironmentKey, Neighbors, TerrainKind } from './pixel/sprites'

export const TILE = 48 // 16 px lógicos × 3
export const WATER_MARGIN = 3 // tiles de agua alrededor de la grilla (los salientes ocupan el primero)

export interface IslandTile {
  x: number
  y: number
  kind: TerrainKind
  /** Índice de casilla del motor si el tile es construible. */
  gridIndex: number | null
  /** Decoración ambiental (árbol/hongo/pilón) o roca. */
  decor: 'ambient' | 'rock' | null
  neighbors: Neighbors
}

export interface Island {
  cols: number
  rows: number
  grid: { x: number; y: number; cols: number; rows: number }
  tiles: IslandTile[]
}

// Forma de la isla por sector. La isla es exactamente la grilla del motor (toda
// casilla es construible, incluidas las que tocan el mar). Los "salientes" son
// tiles de tierra decorativos pegados al borde y los islotes flotan alrededor;
// ambos llevan siempre árbol o roca para que se lea que no son construibles.
// Coordenadas relativas a la esquina superior izquierda de la grilla.
const SHAPES: Record<SectorKey, { bumps: Array<[number, number]>; islets: Array<[number, number]> }> = {
  coast: {
    bumps: [[2, -1], [3, -1], [-1, 2], [8, 4], [8, 5], [-1, 7], [5, 10], [3, 10]],
    islets: [[-3, 11], [-2, 11], [-2, 12], [10, -3], [11, -3], [11, -2], [-3, 3], [10, 12]],
  },
  desert: {
    bumps: [[1, -1], [2, -1], [5, -1], [-1, 1], [-1, 3], [8, 2], [8, 4], [1, 6], [5, 6], [7, 6], [4, 8], [8, 8], [2, 9], [2, 11], [11, 10], [11, 11], [3, 12], [6, 12], [9, 12], [10, 12]],
    islets: [[-3, 7], [-2, 7], [10, 5], [11, 5], [-2, 13], [10, 15], [11, 15], [12, 14]],
  },
}

const CYBERPUNK_INTERIOR_DECOR = new Map<number, IslandTile['decor']>([
  [10, 'ambient'],
  [29, 'rock'],
  [43, 'ambient'],
  [68, 'rock'],
])

function hash(x: number, y: number): number {
  let h = (x * 73856093) ^ (y * 19349663)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  return Math.abs(h ^ (h >>> 15))
}

export function buildIsland(rows: number, cols: number, sector: SectorKey, occupiedIndices: number[] = []): Island {
  const shape = SHAPES[sector]
  const cyberpunk = sector === 'desert'
  const grid = { x: WATER_MARGIN + 1, y: WATER_MARGIN + 1, cols: cols + (cyberpunk ? 3 : 0), rows: rows + (cyberpunk ? 2 : 0) }
  const totalCols = grid.cols + 2 + WATER_MARGIN * 2
  const totalRows = grid.rows + 2 + WATER_MARGIN * 2
  const decorLand = new Set([...shape.bumps, ...shape.islets].map(([x, y]) => `${x},${y}`))
  const occupied = new Set(occupiedIndices)

  const allowed = sector === 'coast' ? COAST_BUILDABLE_SET : CYBERPUNK_BUILDABLE_SET
  const positionForIndex = (index: number) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    if (!cyberpunk) return { x: grid.x + col, y: grid.y + row }
    if (row >= 7) return { x: grid.x + col + 3, y: grid.y + row + 2 }
    if (row === 6) return { x: grid.x + col + 1, y: grid.y + row + 1 }
    return { x: grid.x + col, y: grid.y + row }
  }
  const indexByPosition = new Map<string, number>()
  for (let index = 0; index < rows * cols; index += 1) {
    if (!allowed.has(index) && !occupied.has(index)) continue
    const position = positionForIndex(index)
    indexByPosition.set(`${position.x},${position.y}`, index)
  }
  const gridIndexAt = (x: number, y: number) => indexByPosition.get(`${x},${y}`) ?? null
  const isLand = (x: number, y: number): boolean => gridIndexAt(x, y) !== null || decorLand.has(`${x - grid.x},${y - grid.y}`)
  const kindAt = (x: number, y: number): TerrainKind => (isLand(x, y) ? 'land' : 'water')

  const tiles: IslandTile[] = []
  for (let y = 0; y < totalRows; y++) {
    for (let x = 0; x < totalCols; x++) {
      const kind = kindAt(x, y)
      const gridIndex = gridIndexAt(x, y)
      let decor: IslandTile['decor'] = null
      if (kind === 'land' && gridIndex === null) decor = hash(x, y) % 4 === 0 ? 'rock' : 'ambient'
      else if (cyberpunk && gridIndex !== null) decor = CYBERPUNK_INTERIOR_DECOR.get(gridIndex) ?? null
      const neighbors: Neighbors = kind === 'water'
        ? {
            n: kindAt(x, y - 1), e: kindAt(x + 1, y), s: kindAt(x, y + 1), w: kindAt(x - 1, y),
            ne: kindAt(x + 1, y - 1), nw: kindAt(x - 1, y - 1), se: kindAt(x + 1, y + 1), sw: kindAt(x - 1, y + 1),
          }
        : {}
      tiles.push({ x, y, kind, gridIndex, decor, neighbors })
    }
  }
  return { cols: totalCols, rows: totalRows, grid, tiles }
}

/** Ambiente visual propio de cada región. */
export function environmentFor(game: GameState): EnvironmentKey {
  return game.activeSector === 'desert' ? 'futuristic' : 'terrestrial'
}
