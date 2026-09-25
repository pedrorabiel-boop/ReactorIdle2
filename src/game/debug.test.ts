import { afterEach, describe, expect, it } from 'vitest'
import { COMPONENTS } from './catalog'
import { applyDebugSettings, createDefaultDebugSettings, hasInfiniteMoney, withDebugSettings } from './debug'
import { createInitialState, isComponentUnlocked, isComponentVisible, placeTile, simulateTick } from './engine'
import { normalizeGameState } from './persistence'
import { canUnlockTech, componentCapacity, conversionRate, directEnergyRate, upgradeBuildingTrack, upgradeCost } from './research'

afterEach(() => applyDebugSettings(createDefaultDebugSettings()))

describe('debug balance sandbox', () => {
  it('is disabled by default and restores the official balance', () => {
    const state = createInitialState()
    expect(state.debug.enabled).toBe(false)
    expect(state.debug.unlockAllBuildings).toBe(false)
    expect(hasInfiniteMoney(state)).toBe(false)
    expect(COMPONENTS.wind.directEnergy).toBe(0.2)
  })

  it('temporarily unlocks and reveals every building without purchasing technologies', () => {
    const debug = createDefaultDebugSettings()
    debug.enabled = true
    debug.infiniteMoney = true
    debug.unlockAllBuildings = true
    let state = createInitialState(debug)
    expect(state.unlockedTechs.fusion).toBe(false)
    expect(isComponentUnlocked(state, 'pipe2')).toBe(true)
    expect(isComponentVisible(state, 'research')).toBe(true)
    state = placeTile(state, 0, 'pipe2')
    expect(state.tiles[0]?.kind).toBe('pipe2')
    expect(state.unlockedTechs.fusion).toBe(false)

    state = withDebugSettings(state, { ...state.debug, enabled: false })
    expect(isComponentUnlocked(state, 'pipe2')).toBe(false)
    expect(isComponentVisible(state, 'research')).toBe(false)
    expect(placeTile(state, 1, 'pipe2')).toBe(state)
    expect(state.tiles[0]?.kind).toBe('pipe2')
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

  it('applies turbine and pipe tuning to existing buildings without tier multipliers', () => {
    const debug = createDefaultDebugSettings()
    debug.enabled = true
    debug.infiniteMoney = true
    let state = createInitialState(debug)
    state = { ...state, unlockedTechs: { solar: true, thermal: true, thorium: true, fusion: true, expansion: false } }
    state = placeTile(state, 0, 'generator')
    state = placeTile(state, 1, 'pipe')
    const tuned = {
      ...state.debug,
      componentValues: {
        ...state.debug.componentValues,
        generator: { ...state.debug.componentValues.generator, capacity: 8_765, conversionRate: 4_321 },
        pipe: { ...state.debug.componentValues.pipe, capacity: 9_876 },
      },
    }
    state = withDebugSettings(state, tuned)
    expect(state.tiles[0]?.kind).toBe('generator')
    expect(state.tiles[1]?.kind).toBe('pipe')
    expect(conversionRate(state)).toBe(4_321)
    expect(componentCapacity(state, 'generator')).toBe(8_765)
    expect(componentCapacity(state, 'pipe')).toBe(9_876)
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
    delete legacy.debug.componentValues.generator2
    delete legacy.debug.componentValues.pipe2
    delete legacy.debug.upgradeBaseCosts.sales2
    delete legacy.debug.upgradeBaseCosts.research2
    delete legacy.debug.upgradeBaseCosts.generator2
    delete legacy.debug.upgradeBaseCosts.pipe2
    const loaded = normalizeGameState(legacy)
    expect(loaded?.debug.componentValues.sales2.salesRate).toBe(30_000)
    expect(loaded?.debug.componentValues.research2.researchRate).toBe(500)
    expect(loaded?.debug.componentValues.generator2.conversionRate).toBe(6_250_000)
    expect(loaded?.debug.componentValues.pipe2.capacity).toBe(75_000_000_000)
    expect(loaded?.debug.componentValues.pipe2.referenceTransferRate).toBe(12_500_000_000)
    expect(loaded?.debug.upgradeBaseCosts.sales2.output).toBe(150_000_000)
    expect(loaded?.debug.upgradeBaseCosts.research2.output).toBe(150_000_000)
    expect(loaded?.debug.upgradeBaseCosts.generator2.output).toBe(187_500_000)
    expect(loaded?.debug.upgradeBaseCosts.pipe2.output).toBe(67_200_000_000)
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
