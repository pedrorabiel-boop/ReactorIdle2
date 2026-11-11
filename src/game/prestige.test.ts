import { describe, expect, it } from 'vitest'
import { ECONOMY } from './balance'
import { COMPONENTS } from './catalog'
import { canPrestige, createInitialState, pendingAutoRebuilds, pendingTechs, performPrestige, placeTile, prestigeMultiplier, prestigeResearchMultiplier, prestigeThreshold, sellStoredEnergy, simulateTick, toggleUpgradeVisibility } from './engine'
import { upgradeBuildingTrack, upgradeBuildingTrackMax, upgradeLevel, maxUpgradeLevel } from './research'
import type { GameState } from './types'

const withStored = (state: GameState, energyStored: number): GameState =>
  ({ ...state, sectorEconomies: { ...state.sectorEconomies, [state.activeSector]: { ...state.sectorEconomies[state.activeSector], energyStored } } })

describe('prestige', () => {
  it('opens at a multiple of the strongest reactor and stays editable from the sandbox', () => {
    expect(prestigeThreshold()).toBe(COMPONENTS.planck.cost * ECONOMY.prestigeCostMultiple)
    expect(ECONOMY.prestigeCostMultiple).toBe(100)
    const poor = { ...createInitialState(), credits: prestigeThreshold() - 1 }
    expect(canPrestige(poor)).toBe(false)
    expect(performPrestige(poor)).toBe(poor)
    expect(canPrestige({ ...poor, credits: prestigeThreshold() })).toBe(true)
  })

  it('multiplies every sale and compounds with each reset', () => {
    expect(prestigeMultiplier({ ...createInitialState(), prestiges: 0 })).toBe(1)
    expect(prestigeMultiplier({ ...createInitialState(), prestiges: 5 })).toBeCloseTo(Math.pow(1.2, 5), 10)

    const sell = (prestiges: number) => {
      const state = withStored({ ...createInitialState(), credits: 0, prestiges }, 100)
      return sellStoredEnergy(state).credits
    }
    expect(sell(1) / sell(0)).toBeCloseTo(ECONOMY.prestigeSalesBonus, 10)
    expect(sell(3) / sell(0)).toBeCloseTo(Math.pow(ECONOMY.prestigeSalesBonus, 3), 10)
  })

  it('wipes the run but keeps the count, the sandbox and nothing else', () => {
    let state: GameState = { ...createInitialState(), credits: prestigeThreshold(), researchPoints: 9_999, prestiges: 2 }
    state = { ...state, unlockedTechs: { ...state.unlockedTechs, solar: true, thermal: true }, ownedSectors: { coast: true, desert: true, testsite: true } }
    state = placeTile(state, 25, 'wind')
    expect(state.tiles[25]).not.toBeNull()
    // Construir gasta: hay que volver al umbral para poder reiniciar.
    state = { ...state, credits: prestigeThreshold() }

    const after = performPrestige(state)
    expect(after.prestiges).toBe(3)
    expect(after.credits).toBe(ECONOMY.startingCredits)
    expect(after.researchPoints).toBe(0)
    expect(after.tick).toBe(0)
    expect(after.unlockedTechs.solar).toBe(false)
    expect(after.ownedSectors.desert).toBe(false)
    expect(after.ownedSectors.testsite).toBe(false)
    for (const tiles of Object.values(after.sectorLayouts)) expect(tiles.every((tile) => tile === null)).toBe(true)
    expect(after.debug).toEqual(state.debug)
  })
})

describe('upgrade sheet state', () => {
  it('buys every level the credits can reach in one press', () => {
    const rich = { ...createInitialState(), credits: 1e15 }
    let one = upgradeBuildingTrack(rich, 'wind', 'output')
    one = upgradeBuildingTrack(one, 'wind', 'output')
    const many = upgradeBuildingTrackMax(rich, 'wind', 'output')
    expect(upgradeLevel(many, 'wind', 'output')).toBe(maxUpgradeLevel(rich))
    expect(upgradeLevel(many, 'wind', 'output')).toBeGreaterThan(upgradeLevel(one, 'wind', 'output'))
    expect(many.credits).toBeLessThan(one.credits)
  })

  it('stops where the money stops and never overshoots the cap', () => {
    const tight = { ...createInitialState(), credits: 40 }
    const next = upgradeBuildingTrackMax(tight, 'wind', 'output')
    expect(upgradeLevel(next, 'wind', 'output')).toBeGreaterThan(upgradeLevel(tight, 'wind', 'output'))
    expect(upgradeLevel(next, 'wind', 'output')).toBeLessThanOrEqual(maxUpgradeLevel(tight))
    expect(next.credits).toBeGreaterThanOrEqual(0)
    // Un segundo intento sin dinero deja el estado intacto.
    expect(upgradeBuildingTrackMax({ ...next, credits: 0 }, 'wind', 'output')).toEqual({ ...next, credits: 0 })
  })

  it('sets aside a type per map and brings it back', () => {
    const state = createInitialState()
    expect(state.sectorEconomies.coast.hiddenUpgrades).toEqual([])
    const hidden = toggleUpgradeVisibility(state, 'wind')
    expect(hidden.sectorEconomies.coast.hiddenUpgrades).toEqual(['wind'])
    // Apartar en un mapa no afecta a los otros.
    expect(hidden.sectorEconomies.desert.hiddenUpgrades).toEqual([])
    expect(toggleUpgradeVisibility(hidden, 'wind').sectorEconomies.coast.hiddenUpgrades).toEqual([])
  })
})

describe('lab sheet contents', () => {
  it('offers only what can be bought now, never what is done or still locked', () => {
    const fresh = createInitialState()
    // Al empezar: solo lo que no tiene requisito pendiente.
    expect(pendingTechs(fresh)).toEqual(['solar', 'expansion'])

    const withSolar = { ...fresh, unlockedTechs: { ...fresh.unlockedTechs, solar: true } }
    // Lo investigado desaparece y entra su siguiente escalon.
    expect(pendingTechs(withSolar)).not.toContain('solar')
    expect(pendingTechs(withSolar)).toContain('thermal')
    // Torio sigue oculto porque le falta Ingenieria termica.
    expect(pendingTechs(withSolar)).not.toContain('thorium')

    const everything = { ...fresh, unlockedTechs: { solar: true, thermal: true, thorium: true, fusion: true, expansion: true, testsite: true } }
    expect(pendingTechs(everything)).toEqual([])
  })

  it('drops an auto rebuild licence from the list once it is owned', () => {
    const state = { ...createInitialState(), credits: 1e18, unlockedTechs: { solar: true, thermal: true, thorium: true, fusion: true, expansion: true, testsite: true } }
    const before = pendingAutoRebuilds(state)
    expect(before).toContain('wind')
    const owned = { ...state, autoRebuilds: { ...state.autoRebuilds, wind: true } }
    expect(pendingAutoRebuilds(owned)).not.toContain('wind')
    expect(pendingAutoRebuilds(owned).length).toBe(before.length - 1)
  })
})

describe('el prestigio también acelera la investigación', () => {
  /**
   * Antes solo multiplicaba la venta, asi que el dinero volvia enseguida tras
   * un reinicio pero los puntos para abrir el Manglar y el Test Site no: habia
   * que dejar un mapa lleno de I+D al maximo corriendo varios minutos, y la
   * partida se paraba ahi por mucho prestigio que llevaras.
   */
  const conIDyPrestigios = (prestiges: number) => {
    let state = { ...createInitialState(), credits: 1e12, prestiges }
    state = placeTile(state, 25, 'research')
    state = placeTile(state, 26, 'research')
    return state
  }
  const rpPorTick = (prestiges: number) => simulateTick(conIDyPrestigios(prestiges)).report.generatedResearch

  it('multiplica los puntos por 1,2 en cada reinicio', () => {
    expect(ECONOMY.prestigeResearchBonus).toBe(1.2)
    const base = rpPorTick(0)
    expect(base).toBeGreaterThan(0)
    for (const n of [1, 3, 7, 20]) {
      expect(rpPorTick(n), `${n} prestigios`).toBeCloseTo(base * Math.pow(1.2, n), 6)
    }
  })

  it('avanza al mismo ritmo que el de venta: un reinicio adelanta las dos monedas', () => {
    for (const prestiges of [0, 1, 10, 25]) {
      const state = { ...createInitialState(), prestiges }
      expect(prestigeResearchMultiplier(state), `${prestiges} prestigios`).toBeCloseTo(prestigeMultiplier(state), 9)
    }
    expect(prestigeResearchMultiplier({ ...createInitialState(), prestiges: 0 })).toBe(1)
  })

  it('los puntos acumulados crecen de verdad en la partida, no solo en el informe', () => {
    const sin = simulateTick(conIDyPrestigios(0)).state.researchPoints
    const con = simulateTick(conIDyPrestigios(5)).state.researchPoints
    expect(con).toBeCloseTo(sin * Math.pow(1.2, 5), 6)
  })
})
