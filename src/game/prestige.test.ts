import { describe, expect, it } from 'vitest'
import { ECONOMY } from './balance'
import { COMPONENTS } from './catalog'
import { canPrestige, createInitialState, performPrestige, placeTile, prestigeMultiplier, prestigeThreshold, sellStoredEnergy, toggleUpgradeVisibility } from './engine'
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
