import { describe, expect, it } from 'vitest'
import { COMPONENTS } from './catalog'
import { converterNetwork, createInitialState, placeTile, sellTile, simulateTick, toggleTile } from './engine'
import { componentCapacity, upgradeBuildingTrack, upgradeCost, upgradeTracks } from './research'
import type { ComponentKind, GameState } from './types'

const K = 1 + (COMPONENTS.pipe2.networkBonus ?? 0)

const abierto = (): GameState => ({
  ...createInitialState(),
  credits: 1e18,
  unlockedTechs: { solar: true, thermal: true, thorium: true, fusion: true, expansion: true, testsite: true },
})
const construir = (state: GameState, plano: Array<[number, ComponentKind]>) =>
  plano.reduce((acc, [index, kind]) => placeTile(acc, index, kind), state)
const conversion = (state: GameState) => simulateTick(state).report.conversionCapacity
const factor = (state: GameState, index: number) => converterNetwork(state, index).factor

/**
 * Turbina en 33, red que serpentea por las casillas construibles de la costa,
 * y la llave colgada del 26, que toca el 34.
 */
const TRAZADO = [34, 35, 36, 37, 38, 46, 45, 44, 43, 42, 41]
const conRed = (tuberias: number, llave: boolean) => construir(abierto(), [
  [33, 'generator2'],
  ...TRAZADO.slice(0, tuberias).map((index) => [index, 'pipe2'] as [number, ComponentKind]),
  ...(llave ? [[26, 'exchanger'] as [number, ComponentKind]] : []),
])

describe('la red necesita un intercambiador para encenderse', () => {
  it('sin intercambiador no multiplica nada, por grande que sea', () => {
    for (const tuberias of [1, 3, 6, 11]) {
      expect(factor(conRed(tuberias, false), 33), `${tuberias} tuberías sin llave`).toBe(1)
    }
  })

  it('con un intercambiador pegado, multiplica por cada tubería', () => {
    const base = conversion(construir(abierto(), [[33, 'generator2']]))
    for (const tuberias of [1, 3, 6, 11]) {
      const state = conRed(tuberias, true)
      expect(factor(state, 33), `${tuberias} tuberías con llave`).toBeCloseTo(Math.pow(K, tuberias), 10)
      expect(conversion(state)).toBeCloseTo(base * Math.pow(K, tuberias), 4)
    }
  })

  it('el segundo intercambiador no suma nada', () => {
    const uno = conRed(5, true)
    // 27 también toca el 35: una segunda llave en la misma red.
    const dos = construir(uno, [[27, 'exchanger']])
    expect(dos.tiles[27]?.kind).toBe('exchanger')
    expect(factor(dos, 33)).toBeCloseTo(factor(uno, 33), 12)
  })

  it('el intercambiador no cuenta como tubería: no engorda la red', () => {
    expect(factor(conRed(5, true), 33)).toBeCloseTo(Math.pow(K, 5), 10)
  })

  it('quitar o apagar la llave apaga la red entera', () => {
    let state = conRed(5, true)
    expect(factor(state, 33)).toBeCloseTo(Math.pow(K, 5), 10)
    state = toggleTile(state, 26)
    expect(factor(state, 33), 'llave apagada').toBe(1)
    state = toggleTile(state, 26)
    expect(factor(state, 33)).toBeCloseTo(Math.pow(K, 5), 10)
    state = sellTile(state, 26)
    expect(factor(state, 33), 'llave demolida').toBe(1)
  })

  it('una red grande rinde más que dos pequeñas, con llave en las dos', () => {
    // Unida: 34-35-36-37, llave en 26. Turbinas en 33 y 38.
    const unida = construir(abierto(), [[33, 'generator2'], [38, 'generator2'], [26, 'exchanger'],
      [34, 'pipe2'], [35, 'pipe2'], [36, 'pipe2'], [37, 'pipe2']])
    // Partida: 34-35 y 37-38 (el 36 vacío las separa), con llave cada una.
    const partida = construir(abierto(), [[33, 'generator2'], [45, 'generator2'], [26, 'exchanger'], [30, 'exchanger'],
      [34, 'pipe2'], [35, 'pipe2'], [37, 'pipe2'], [38, 'pipe2']])
    expect(partida.tiles[30]?.kind).toBe('exchanger')   // 30 toca el 38
    expect(conversion(unida) / conversion(partida)).toBeCloseTo(Math.pow(K, 2), 6)
  })

  it('una red encendida y otra dormida: solo cuenta la encendida', () => {
    // La turbina del 36 toca 34-35 (con llave en 26) y 37-38 (sin llave).
    const state = construir(abierto(), [[36, 'generator2'], [26, 'exchanger'],
      [34, 'pipe2'], [35, 'pipe2'], [37, 'pipe2'], [38, 'pipe2']])
    const red = converterNetwork(state, 36)
    expect(red.tuberias).toBe(2)
    expect(red.dormidas).toBe(2)
    expect(red.factor).toBeCloseTo(K * K, 10)
  })
})

describe('el intercambiador como llave', () => {
  it('cuesta 1 G, igual que la Tubería II que enciende', () => {
    expect(COMPONENTS.exchanger.cost).toBe(1_000_000_000)
    expect(COMPONENTS.exchanger.cost).toBe(COMPONENTS.pipe2.cost)
  })

  it('solo se desbloquea con el Test Site, el último mapa', () => {
    expect(COMPONENTS.exchanger.tech).toBe('testsite')
  })

  it('solo se le sube la tolerancia: encender la red no es un número que suba', () => {
    expect(upgradeTracks('exchanger')).toEqual(['capacity'])
    const state = abierto()
    // La tolerancia sí se compra, y la primera cuesta 5 G.
    expect(upgradeCost(state, 'exchanger', 'capacity')).toBe(5_000_000_000)
    const subido = upgradeBuildingTrack(state, 'exchanger', 'capacity')
    expect(componentCapacity(subido, 'exchanger')).toBeGreaterThan(componentCapacity(state, 'exchanger'))
    // Las otras dos siguen cerradas, también por la puerta de atrás.
    for (const track of ['output', 'autonomy'] as const) {
      expect(upgradeBuildingTrack(state, 'exchanger', track), track).toBe(state)
    }
  })

  it('la Tubería II sí conserva su tolerancia: no se queda sin nada que subir', () => {
    expect(upgradeTracks('pipe2')).toEqual(['capacity'])
  })
})

describe('la llave no puede ser el eslabón débil', () => {
  /**
   * La difusión nivela calor ABSOLUTO entre vecinos sin mirar la capacidad del
   * destino, así que el intercambiador carga tanto calor como la tubería que
   * toca. Cuando toleraba 2 M contra los 10 M de la Tubería II, reventaba
   * siempre primero: a cualquier nivel aguantaba un quinto, y para igualarla
   * hacían falta seis niveles más de los que el mapa permite.
   */
  it('tolera lo mismo que la Tubería II que enciende, a cualquier nivel', () => {
    expect(COMPONENTS.exchanger.capacity).toBe(COMPONENTS.pipe2.capacity)
    const state = abierto()
    for (const nivel of [1, 5, 10]) {
      const subido = { ...state, sectorEconomies: { ...state.sectorEconomies, coast: { ...state.sectorEconomies.coast, capacityLevels: { ...state.sectorEconomies.coast.capacityLevels, exchanger: nivel, pipe2: nivel } } } }
      expect(componentCapacity(subido, 'exchanger'), `nivel ${nivel}`).toBe(componentCapacity(subido, 'pipe2'))
    }
  })

  it('conduce igual que antes: subir la tolerancia no la hizo más lenta', () => {
    expect(COMPONENTS.exchanger.thermalResistance).toBeCloseTo(2.24071005886228, 12)
  })
})
