import { describe, expect, it } from 'vitest'
import { cellPosition, neighbourIndices, CYBERPUNK_BUILDABLE_SET, SECTOR_GRID, TESTSITE_BUILDABLE_INDICES, TESTSITE_BUILDABLE_SET } from './terrain'
import { createInitialState, isComponentUnlocked, placeTile, simulateTick } from './engine'
import { buildIsland } from '../ui/island'
import { COMPONENTS } from './catalog'
import { ECONOMY, TECHNOLOGIES, levelMultiplier } from './balance'
import type { GameState } from './types'

const ROWS = 10
const COLS = 8

describe('geometry of the map', () => {
  it('keeps the coast on the plain grid', () => {
    expect(cellPosition('coast', 27, COLS)).toEqual({ x: 3, y: 3 })
    expect(neighbourIndices('coast', 27, ROWS, COLS).sort((a, b) => a - b)).toEqual([19, 26, 28, 35])
  })

  it('reads the cyberpunk neighbourhood from the drawn layout, not the raw index grid', () => {
    // El Distrito Neón rota la grilla y desplaza franjas: la casilla 1 queda
    // dibujada justo encima de la 18 aunque sus índices no sean contiguos.
    expect(cellPosition('desert', 1, COLS)).toEqual({ x: 2, y: 1 })
    expect(cellPosition('desert', 18, COLS)).toEqual({ x: 2, y: 2 })
    expect(neighbourIndices('desert', 1, ROWS, COLS)).toContain(18)
    expect(neighbourIndices('desert', 18, ROWS, COLS)).toContain(1)
    // Y dos índices contiguos que el dibujo separa no son vecinos.
    expect(cellPosition('desert', 9, COLS)).toEqual({ x: 3, y: 1 })
    expect(cellPosition('desert', 10, COLS)).toEqual({ x: 1, y: 2 })
    expect(neighbourIndices('desert', 9, ROWS, COLS)).not.toContain(10)
  })

  it('is symmetric for every buildable cyberpunk cell', () => {
    for (const index of CYBERPUNK_BUILDABLE_SET) {
      for (const neighbour of neighbourIndices('desert', index, ROWS, COLS)) {
        expect(neighbourIndices('desert', neighbour, ROWS, COLS)).toContain(index)
      }
    }
  })

  it('lays the test site out as one connected field of 150 cells', () => {
    const { rows, cols } = SECTOR_GRID.testsite
    expect(rows).toBe(16)
    expect(cols).toBe(20)
    expect(TESTSITE_BUILDABLE_INDICES).toHaveLength(150)
    expect(TESTSITE_BUILDABLE_SET.size).toBe(150)
    for (const index of TESTSITE_BUILDABLE_INDICES) expect(index).toBeLessThan(rows * cols)

    const seen = new Set<number>([TESTSITE_BUILDABLE_INDICES[0]])
    const queue: number[] = [TESTSITE_BUILDABLE_INDICES[0]]
    while (queue.length > 0) {
      const index = queue.pop()!
      for (const neighbour of neighbourIndices('testsite', index, rows, cols)) {
        if (TESTSITE_BUILDABLE_SET.has(neighbour) && !seen.has(neighbour)) { seen.add(neighbour); queue.push(neighbour) }
      }
    }
    expect(seen.size).toBe(150)

    // El campo se dibuja sobre la grilla plana, así que la vecindad no se tuerce.
    expect(cellPosition('testsite', 46, cols)).toEqual({ x: 6, y: 2 })
    expect(neighbourIndices('testsite', 47, rows, cols)).toContain(46)
  })

  it('leaves room inside the field for the rock outcrops', () => {
    const { rows, cols } = SECTOR_GRID.testsite
    // Todo lo no construible que el exterior no alcanza es un afloramiento.
    const outside = new Set<number>()
    const queue: number[] = []
    for (let index = 0; index < rows * cols; index += 1) {
      const row = Math.floor(index / cols), col = index % cols
      if ((row === 0 || col === 0 || row === rows - 1 || col === cols - 1) && !TESTSITE_BUILDABLE_SET.has(index)) { outside.add(index); queue.push(index) }
    }
    while (queue.length > 0) {
      const index = queue.pop()!
      for (const neighbour of neighbourIndices('testsite', index, rows, cols)) {
        if (!TESTSITE_BUILDABLE_SET.has(neighbour) && !outside.has(neighbour)) { outside.add(neighbour); queue.push(neighbour) }
      }
    }
    let outcrops = 0
    for (let index = 0; index < rows * cols; index += 1) {
      if (!TESTSITE_BUILDABLE_SET.has(index) && !outside.has(index)) outcrops += 1
    }
    expect(outcrops).toBe(9)
  })

  it("gates The Planck's Length behind the test site licence and sizes it beyond any small grid", () => {
    const planck = COMPONENTS.planck
    expect(planck.tech).toBe('testsite')
    expect(TECHNOLOGIES.testsite.cost).toBe(100_000_000)
    expect(TECHNOLOGIES.testsite.requires).toBe('fusion')
    // Su producción exige decenas de Turbina II al máximo: una sola no basta.
    const maxTurbine = (COMPONENTS.generator2.conversionRate ?? 0) * levelMultiplier(ECONOMY.maxCyberpunkBuildingLevel)
    expect((planck.production ?? 0) / maxTurbine).toBeGreaterThan(5)
    // Y la tolerancia le da margen de segundos, no de minutos, si nadie convierte.
    expect(planck.capacity / (planck.production ?? 1)).toBeLessThan(10)

    let state: GameState = { ...createInitialState(), credits: 1e18 }
    expect(isComponentUnlocked(state, 'planck')).toBe(false)
    state = { ...state, unlockedTechs: { solar: true, thermal: true, thorium: true, fusion: true, expansion: true, testsite: true } }
    expect(isComponentUnlocked(state, 'planck')).toBe(true)
  })

  it('never leaves bare ground outside the field, so clean sand always means buildable', () => {
    const { rows, cols } = SECTOR_GRID.testsite
    const island = buildIsland(rows, cols, 'testsite')
    const interactive = island.tiles.filter((tile) => tile.gridIndex !== null)
    expect(interactive).toHaveLength(150)
    expect(interactive.every((tile) => TESTSITE_BUILDABLE_SET.has(tile.gridIndex!))).toBe(true)

    // Todo el suelo que no se puede ocupar lleva algo encima: cactus, roca o
    // montaña. Una casilla de arena limpia es siempre construible.
    const frame = island.tiles.filter((tile) => tile.kind === 'land' && tile.gridIndex === null)
    expect(frame.length).toBeGreaterThan(0)
    expect(frame.filter((tile) => tile.decor === null)).toHaveLength(0)
    // Y al revés: el campo nunca lleva decoración que lo disfrace.
    expect(interactive.every((tile) => tile.decor === null)).toBe(true)
  })

  it('refuses to build on a test site outcrop and allows it on the field', () => {
    const { rows, cols } = SECTOR_GRID.testsite
    const outcrop = (() => {
      for (let index = 0; index < rows * cols; index += 1) {
        if (TESTSITE_BUILDABLE_SET.has(index)) continue
        const around = neighbourIndices('testsite', index, rows, cols)
        if (around.length === 4 && around.some((n) => TESTSITE_BUILDABLE_SET.has(n))) return index
      }
      throw new Error('sin afloramientos')
    })()
    const field = TESTSITE_BUILDABLE_INDICES[0]

    let state: GameState = { ...createInitialState(), credits: 1e18, activeSector: 'testsite', ownedSectors: { coast: true, desert: true, testsite: true }, unlockedTechs: { solar: true, thermal: true, thorium: true, fusion: true, expansion: true, testsite: true } }
    state = { ...state, ...SECTOR_GRID.testsite, tiles: state.sectorLayouts.testsite.map((tile) => tile ? { ...tile } : null) }

    const blocked = placeTile(state, outcrop, 'wind')
    expect(blocked).toBe(state)
    expect(blocked.tiles[outcrop]).toBeNull()

    const built = placeTile(state, field, 'wind')
    expect(built.tiles[field]?.kind).toBe('wind')
  })

  it('keeps the neon district decorations cosmetic, not obstacles', () => {
    // En el Distrito Neón la roca y la vegetación se dibujan encima de casillas
    // construibles: son adorno y desaparecen al construir.
    let state: GameState = { ...createInitialState(), credits: 1e18, activeSector: 'desert', ownedSectors: { coast: true, desert: true, testsite: false }, unlockedTechs: { solar: true, thermal: true, thorium: true, fusion: true, expansion: true, testsite: false } }
    state = { ...state, tiles: state.sectorLayouts.desert.map((tile) => tile ? { ...tile } : null) }
    for (const decorated of [10, 29, 43, 68]) {
      expect(CYBERPUNK_BUILDABLE_SET.has(decorated)).toBe(true)
      expect(placeTile(state, decorated, 'wind').tiles[decorated]?.kind).toBe('wind')
    }
  })

  it('feeds every turbine of a cyberpunk ring that touches the conduit on screen', () => {
    // Cruz dibujada alrededor de (3,3): reactor al centro, Tubería II en los
    // cuatro lados y una turbina detrás de cada tubería. Los índices no son
    // contiguos porque el mapa rota y desplaza la grilla.
    const reactor = 27
    const pipes = [26, 20, 19, 35]
    const turbines = [9, 21, 11, 43]
    for (const [index, spot] of [[reactor, { x: 3, y: 3 }], [26, { x: 3, y: 2 }], [20, { x: 3, y: 4 }], [19, { x: 2, y: 3 }], [35, { x: 4, y: 3 }], [9, { x: 3, y: 1 }], [21, { x: 3, y: 5 }], [11, { x: 1, y: 3 }], [43, { x: 5, y: 3 }]] as const) {
      expect(cellPosition('desert', index as number, COLS)).toEqual(spot)
    }

    let state: GameState = { ...createInitialState(), credits: 1e18, activeSector: 'desert', ownedSectors: { coast: true, desert: true, testsite: true }, unlockedTechs: { solar: true, thermal: true, thorium: true, fusion: true, expansion: true, testsite: true } }
    state = { ...state, tiles: state.sectorLayouts.desert.map((tile) => tile ? { ...tile } : null) }
    state = placeTile(state, reactor, 'core')
    for (const index of pipes) state = placeTile(state, index, 'pipe2')
    for (const index of turbines) state = placeTile(state, index, 'generator2')
    expect([reactor, ...pipes, ...turbines].every((index) => state.sectorLayouts.desert[index])).toBe(true)

    for (let tick = 0; tick < 5; tick += 1) state = simulateTick(state).state
    for (const index of turbines) expect(state.sectorLayouts.desert[index]!.flow).toBeGreaterThan(0)
    expect(state.sectorReports.desert.incidents).toBe(0)
  })
})
