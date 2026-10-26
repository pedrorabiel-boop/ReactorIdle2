import { describe, expect, it } from 'vitest'
import { COMPONENT_ORDER, sectorBaselineLevel, sectorMaxLevel } from './balance'
import { createInitialState, placeTile } from './engine'
import { normalizeGameState } from './persistence'
import { maxUpgradeLevel, upgradeBuildingTrack } from './research'
import type { GameState, SectorKey } from './types'

const SECTORES: SectorKey[] = ['coast', 'desert', 'testsite']
/** Lo que el navegador hace entre cerrar y abrir: serializar y volver. */
const guardarYCargar = (state: GameState) => normalizeGameState(JSON.parse(JSON.stringify(state)))

const rico = (sector: SectorKey): GameState => ({
  ...createInitialState(),
  credits: 1e18,
  activeSector: sector,
  unlockedTechs: { solar: true, thermal: true, thorium: true, fusion: true, expansion: true, testsite: true },
  ownedSectors: { coast: true, desert: true, testsite: true },
})

describe('la partida sobrevive a cerrar y abrir', () => {
  it('cada mapa tiene su propio techo de niveles', () => {
    expect(sectorMaxLevel('coast')).toBe(10)
    expect(sectorMaxLevel('desert')).toBe(15)
    expect(sectorMaxLevel('testsite')).toBe(20)
  })

  /**
   * Esta era la perdida real: `research` dejaba subir el Test Site hasta 15 y
   * `persistence` recortaba a 10 al cargar, asi que el jugador perdia las
   * mejoras cada vez que cerraba el juego. Las dos reglas viven ahora en
   * `balance`; esto comprueba que siguen de acuerdo en los tres mapas.
   */
  for (const sector of SECTORES) {
    it(`${sector}: el tope que deja comprar es el tope que se guarda`, () => {
      const tope = maxUpgradeLevel(rico(sector))
      expect(tope).toBe(sectorMaxLevel(sector))
      const antes = rico(sector)
      antes.sectorEconomies[sector] = {
        ...antes.sectorEconomies[sector],
        buildingLevels: { ...antes.sectorEconomies[sector].buildingLevels, generator2: tope },
        capacityLevels: { ...antes.sectorEconomies[sector].capacityLevels, pipe2: tope },
        autonomyLevels: { ...antes.sectorEconomies[sector].autonomyLevels, thorium: tope },
      }
      const economia = guardarYCargar(antes)?.sectorEconomies[sector]
      expect(economia?.buildingLevels.generator2, `tope de compra: ${tope}`).toBe(tope)
      expect(economia?.capacityLevels.pipe2).toBe(tope)
      expect(economia?.autonomyLevels.thorium).toBe(tope)
    })

    it(`${sector}: el suelo de niveles es el mismo que usa el juego`, () => {
      const vacio = guardarYCargar(rico(sector))?.sectorEconomies[sector]
      for (const kind of COMPONENT_ORDER) {
        expect(vacio?.buildingLevels[kind], `${kind}`).toBeGreaterThanOrEqual(sectorBaselineLevel(sector))
      }
    })
  }

  it('una mejora comprada de verdad sigue ahi al volver', () => {
    // Por el camino completo, no escribiendo el nivel a mano.
    let state = rico('testsite')
    for (let i = 0; i < 12; i += 1) state = upgradeBuildingTrack(state, 'generator2', 'output')
    const nivel = state.sectorEconomies.testsite.buildingLevels.generator2
    expect(nivel).toBeGreaterThan(10)
    expect(guardarYCargar(state)?.sectorEconomies.testsite.buildingLevels.generator2).toBe(nivel)
  })

  it('no se pierde nada mas del progreso en el viaje', () => {
    let state = rico('desert')
    state = placeTile(state, 8, 'solar')
    state = { ...state, researchPoints: 4_200, prestiges: 3, incidents: 7, totalEnergySold: 1e9, autoRebuilds: { ...state.autoRebuilds, thorium: true } }
    const vuelta = guardarYCargar(state)!
    expect(vuelta.credits).toBe(state.credits)
    expect(vuelta.researchPoints).toBe(state.researchPoints)
    expect(vuelta.prestiges).toBe(state.prestiges)
    expect(vuelta.incidents).toBe(state.incidents)
    expect(vuelta.totalEnergySold).toBe(state.totalEnergySold)
    expect(vuelta.autoRebuilds.thorium).toBe(true)
    expect(vuelta.unlockedTechs).toEqual(state.unlockedTechs)
    expect(vuelta.ownedSectors).toEqual(state.ownedSectors)
    expect(vuelta.sectorLayouts.desert[8]?.kind).toBe('solar')
  })
})

describe('partidas con las piezas retiradas', () => {
  /**
   * El enfriador y el deposito salieron del juego. Una partida guardada con
   * ellos puestos no puede reventar al abrirse, y lo pagado se devuelve.
   */
  const conPiezaVieja = (kind: string) => {
    const state: any = { ...createInitialState(), credits: 1_000 }
    state.sectorLayouts.coast[25] = { id: `${kind}-viejo`, kind, heat: 0, enabled: true, damaged: false, flow: 0, fuel: 0, autoRefuel: false }
    state.tiles = state.sectorLayouts.coast
    return state
  }

  it('las quita del mapa en vez de romperse', () => {
    for (const kind of ['cooler', 'accumulator']) {
      const vuelta = guardarYCargar(conPiezaVieja(kind))
      expect(vuelta, kind).not.toBeNull()
      expect(vuelta?.sectorLayouts.coast[25], kind).toBeNull()
    }
  })

  it('devuelve lo mismo que habria dado demolerlas', () => {
    expect(guardarYCargar(conPiezaVieja('cooler'))?.credits).toBe(1_000 + Math.floor(1_000_000 * 0.85))
    expect(guardarYCargar(conPiezaVieja('accumulator'))?.credits).toBe(1_000 + Math.floor(250_000_000 * 0.85))
  })

  it('si la pieza elegida era una retirada, vuelve al molino', () => {
    const state: any = { ...createInitialState(), selectedKind: 'cooler' }
    expect(guardarYCargar(state)?.selectedKind).toBe('wind')
  })

  it('una partida sin ellas no cambia de dinero', () => {
    const state = { ...createInitialState(), credits: 777 }
    expect(guardarYCargar(state)?.credits).toBe(777)
  })
})
