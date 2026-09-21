import type { GameState, SectorKey } from '../game/types'
import { COAST_BUILDABLE_SET } from '../game/terrain'
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
    bumps: [[5, -1], [-1, 1], [-1, 5], [8, 2], [8, 8], [1, 10], [6, 10], [7, 10]],
    islets: [[-3, -2], [-2, -2], [10, 3], [11, 3], [-3, 9], [10, 12], [11, 12], [11, 11]],
  },
}

function hash(x: number, y: number): number {
  let h = (x * 73856093) ^ (y * 19349663)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995)
  return Math.abs(h ^ (h >>> 15))
}

export function buildIsland(rows: number, cols: number, sector: SectorKey, occupiedIndices: number[] = []): Island {
  const shape = SHAPES[sector]
  const grid = { x: WATER_MARGIN + 1, y: WATER_MARGIN + 1, cols, rows }
  const totalCols = cols + 2 + WATER_MARGIN * 2
  const totalRows = rows + 2 + WATER_MARGIN * 2
  const decorLand = new Set([...shape.bumps, ...shape.islets].map(([x, y]) => `${x},${y}`))
  const occupied = new Set(occupiedIndices)

  const inGridBounds = (x: number, y: number) => x >= grid.x && x < grid.x + cols && y >= grid.y && y < grid.y + rows
  const isBuildable = (x: number, y: number) => {
    if (!inGridBounds(x, y)) return false
    const index = (y - grid.y) * cols + (x - grid.x)
    return sector === 'desert' || COAST_BUILDABLE_SET.has(index) || occupied.has(index)
  }
  const isLand = (x: number, y: number): boolean => isBuildable(x, y) || decorLand.has(`${x - grid.x},${y - grid.y}`)
  const kindAt = (x: number, y: number): TerrainKind => (isLand(x, y) ? 'land' : 'water')

  const tiles: IslandTile[] = []
  for (let y = 0; y < totalRows; y++) {
    for (let x = 0; x < totalCols; x++) {
      const kind = kindAt(x, y)
      const gridIndex = isBuildable(x, y) ? (y - grid.y) * cols + (x - grid.x) : null
      let decor: IslandTile['decor'] = null
      if (kind === 'land' && gridIndex === null) decor = hash(x, y) % 4 === 0 ? 'rock' : 'ambient'
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

/** Ambiente visual según la progresión: cada reinversión cambia de piel. */
export function environmentFor(game: GameState): EnvironmentKey {
  void game
  return 'terrestrial'
}
