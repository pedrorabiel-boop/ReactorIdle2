import type { GameState, SectorKey } from '../game/types'
import { buildableFor, cellPosition } from '../game/terrain'
import type { EnvironmentKey, Neighbors, TerrainKind } from './pixel/sprites'

export const TILE = 48 // 16 px lógicos × 3
export const WATER_MARGIN = 3 // tiles de agua alrededor de la grilla (los salientes ocupan el primero)
export const FRAME_DEPTH = 3 // grosor del marco de cactus y montañas del Test Site

export interface IslandTile {
  x: number
  y: number
  kind: TerrainKind
  /** Índice de casilla del motor si el tile es construible. */
  gridIndex: number | null
  /** Decoración ambiental (árbol/hongo/pilón) o roca. */
  decor: 'ambient' | 'rock' | 'mountain' | 'boulder' | null
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
  testsite: { bumps: [], islets: [] },
  desert: {
    bumps: [],
    islets: [],
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
  // El Test Site no es una isla: el campo limpio queda rodeado por una banda
  // de tierra que se va poblando de cactus y montañas hacia afuera.
  const testsite = sector === 'testsite'
  const grid = { x: WATER_MARGIN + 1, y: WATER_MARGIN + 1, cols: cols + (cyberpunk ? 6 : 0), rows: rows + (cyberpunk ? 2 : 0) }
  const totalCols = grid.cols + 2 + WATER_MARGIN * 2
  const totalRows = grid.rows + 2 + WATER_MARGIN * 2
  const decorLand = new Set([...shape.bumps, ...shape.islets].map(([x, y]) => `${x},${y}`))
  const occupied = new Set(occupiedIndices)

  const allowed = buildableFor(sector)
  // La silueta vive en el motor (game/terrain) para que la vecindad que se
  // dibuja sea exactamente la que se simula.
  const positionForIndex = (index: number) => {
    const { x, y } = cellPosition(sector, index, cols)
    return { x: grid.x + x, y: grid.y + y }
  }
  const indexByPosition = new Map<string, number>()
  for (let index = 0; index < rows * cols; index += 1) {
    if (!allowed.has(index) && !occupied.has(index)) continue
    const position = positionForIndex(index)
    indexByPosition.set(`${position.x},${position.y}`, index)
  }
  const gridIndexAt = (x: number, y: number) => indexByPosition.get(`${x},${y}`) ?? null
  const buildablePositions = [...indexByPosition.keys()].map((at) => at.split(',').map(Number) as [number, number])
  /** Distancia en casillas al suelo construible más cercano. */
  const frameDistance = (x: number, y: number) => {
    let best = Number.POSITIVE_INFINITY
    for (const [bx, by] of buildablePositions) best = Math.min(best, Math.max(Math.abs(bx - x), Math.abs(by - y)))
    return best
  }
  const outcrops = new Set<string>()
  if (testsite) {
    const reach = new Set<string>()
    const queue: Array<[number, number]> = [[0, 0]]
    const inCanvas = (x: number, y: number) => x >= 0 && y >= 0 && x < grid.cols + 2 + WATER_MARGIN * 2 && y < grid.rows + 2 + WATER_MARGIN * 2
    while (queue.length > 0) {
      const [x, y] = queue.pop()!
      const at = `${x},${y}`
      if (!inCanvas(x, y) || reach.has(at) || gridIndexAt(x, y) !== null) continue
      reach.add(at)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push([x + dx, y + dy])
    }
    for (let y = 0; y < grid.rows + 2 + WATER_MARGIN * 2; y += 1) {
      for (let x = 0; x < grid.cols + 2 + WATER_MARGIN * 2; x += 1) {
        if (gridIndexAt(x, y) === null && !reach.has(`${x},${y}`)) outcrops.add(`${x},${y}`)
      }
    }
  }
  const isLand = (x: number, y: number): boolean => testsite
    ? frameDistance(x, y) <= FRAME_DEPTH
    : gridIndexAt(x, y) !== null || decorLand.has(`${x - grid.x},${y - grid.y}`)
  const kindAt = (x: number, y: number): TerrainKind => (isLand(x, y) ? 'land' : 'water')

  const tiles: IslandTile[] = []
  for (let y = 0; y < totalRows; y++) {
    for (let x = 0; x < totalCols; x++) {
      const kind = kindAt(x, y)
      const gridIndex = gridIndexAt(x, y)
      let decor: IslandTile['decor'] = null
      if (testsite && kind === 'land' && gridIndex === null) {
        // El marco se densifica hacia afuera: cactus sueltos, matorral cerrado
        // y montañas al fondo. Los afloramientos internos quedan como roca.
        const depth = frameDistance(x, y)
        const roll = hash(x, y) % 10
        if (outcrops.has(`${x},${y}`)) decor = 'boulder'
        else if (depth === 1) decor = roll < 4 ? 'ambient' : null
        else if (depth === 2) decor = roll < 8 ? 'ambient' : 'mountain'
        else decor = roll < 8 ? 'mountain' : 'ambient'
      } else if (kind === 'land' && gridIndex === null) decor = hash(x, y) % 4 === 0 ? 'rock' : 'ambient'
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
  if (game.activeSector === 'desert') return 'futuristic'
  if (game.activeSector === 'testsite') return 'wasteland'
  return 'terrestrial'
}
