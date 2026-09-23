import { afterEach, describe, expect, it } from 'vitest'
import { COMPONENTS } from './catalog'
import { applyDebugSettings, createDefaultDebugSettings, hasInfiniteMoney, withDebugSettings } from './debug'
import { createInitialState, placeTile, simulateTick } from './engine'
import { normalizeGameState } from './persistence'
import { canUnlockTech, directEnergyRate, upgradeBuildingTrack, upgradeCost } from './research'

afterEach(() => applyDebugSettings(createDefaultDebugSettings()))

describe('debug balance sandbox', () => {
  it('is disabled by default and restores the official balance', () => {
    const state = createInitialState()
    expect(state.debug.enabled).toBe(false)
    expect(hasInfiniteMoney(state)).toBe(false)
    expect(COMPONENTS.wind.directEnergy).toBe(0.2)
  })

  it('uses the configured initial money for a new debug game', () => {
    const debug = createDefaultDebugSettings()
    debug.enabled = true
    debug.initialCredits = 123_456
    expect(createInitialState(debug).credits).toBe(123_456)
  })

  it('builds and upgrades without spending when infinite money is active', () => {
    const debug = createDefaultDebugSettings()
    debug.enabled = true
    debug.infiniteMoney = true
    debug.upgradeBaseCosts.wind.output = 987_654
    let state = { ...createInitialState(debug), credits: 0 }
    state = placeTile(state, 0, 'wind')
    expect(state.tiles[0]?.kind).toBe('wind')
    expect(state.credits).toBe(0)
    expect(upgradeCost(state, 'wind')).toBe(987_654)
    state = upgradeBuildingTrack(state, 'wind', 'output')
    expect(state.sectorEconomies.coast.buildingLevels.wind).toBe(2)
    expect(state.credits).toBe(0)
  })

  it('applies component and technology values immediately', () => {
    const debug = createDefaultDebugSettings()
    debug.enabled = true
    debug.componentValues.wind.directEnergy = 7
    debug.technologyCosts.solar = 9
    let state = createInitialState(debug)
    state = { ...state, researchPoints: 9 }
    expect(directEnergyRate(state, 'wind')).toBe(7)
    expect(canUnlockTech(state, 'solar')).toBe(true)
    state = placeTile(state, 0, 'wind')
    expect(simulateTick(state).report.directEnergy).toBe(7)
  })

  it('restores official runtime values when Debug is disabled without losing its tuning', () => {
    const debug = createDefaultDebugSettings()
    debug.enabled = true
    debug.componentValues.wind.directEnergy = 11
    let state = createInitialState(debug)
    expect(directEnergyRate(state, 'wind')).toBe(11)
    state = withDebugSettings(state, { ...state.debug, enabled: false })
    expect(directEnergyRate(state, 'wind')).toBe(0.2)
    expect(state.debug.componentValues.wind.directEnergy).toBe(11)
  })

  it('persists and reapplies debug configuration through save normalization', () => {
    const debug = createDefaultDebugSettings()
    debug.enabled = true
    debug.componentValues.solar.directEnergy = 4321
    const loaded = normalizeGameState(JSON.parse(JSON.stringify(createInitialState(debug))))
    expect(loaded?.debug.enabled).toBe(true)
    expect(loaded?.debug.componentValues.solar.directEnergy).toBe(4321)
    expect(COMPONENTS.solar.directEnergy).toBe(4321)
  })

  it('seeds tier-II tuning when loading an older debug profile', () => {
    const legacy: any = JSON.parse(JSON.stringify(createInitialState()))
    legacy.version = 14
    delete legacy.debug.componentValues.sales2
    delete legacy.debug.componentValues.research2
    delete legacy.debug.upgradeBaseCosts.sales2
    delete legacy.debug.upgradeBaseCosts.research2
    const loaded = normalizeGameState(legacy)
    expect(loaded?.debug.componentValues.sales2.salesRate).toBe(50)
    expect(loaded?.debug.componentValues.research2.researchRate).toBe(1)
    expect(loaded?.debug.upgradeBaseCosts.sales2.output).toBe(8_000)
    expect(loaded?.debug.upgradeBaseCosts.research2.output).toBe(10_000)
  })

  it('does not apply tuning from an invalid imported save', () => {
    const debug = createDefaultDebugSettings()
    debug.enabled = true
    debug.componentValues.wind.directEnergy = 999
    const malformed: any = JSON.parse(JSON.stringify(createInitialState(debug)))
    delete malformed.sectorEconomies
    applyDebugSettings(createDefaultDebugSettings())
    expect(normalizeGameState(malformed)).toBeNull()
    expect(COMPONENTS.wind.directEnergy).toBe(0.2)
  })
})
