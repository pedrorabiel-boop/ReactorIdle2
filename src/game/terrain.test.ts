import { describe, expect, it } from 'vitest'
import { cellPosition, neighbourIndices, CYBERPUNK_BUILDABLE_SET } from './terrain'
import { createInitialState, placeTile, simulateTick } from './engine'
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

    let state: GameState = { ...createInitialState(), credits: 1e18, activeSector: 'desert', ownedSectors: { coast: true, desert: true }, unlockedTechs: { solar: true, thermal: true, thorium: true, fusion: true, expansion: true } }
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
