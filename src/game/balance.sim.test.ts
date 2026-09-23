import { describe, expect, it } from 'vitest'
import { AUTO_REBUILD_COSTS, ECONOMY, TECHNOLOGIES, UPGRADE_BASE_COSTS, levelMultiplier } from './balance'
import { COMPONENTS } from './catalog'
import { createInitialState, isComponentUnlocked } from './engine'
import { nextUpgradeGainPercent, upgradeCost } from './research'

describe('promoted official balance', () => {
  it('matches every global value from the promoted Debug profile', () => {
    expect(ECONOMY).toMatchObject({ startingCredits: 1, baseStorage: 20, baseSalesRate: 0, energyPrice: 1, sellRefund: 0.85, repairRate: 0.35, maxOfflineSeconds: 14_400, secondIslandCost: 1_000_000_000_000, maxBuildingLevel: 10, outputGrowth: 1.35, upgradeGrowth: 2.2, upgradeBaseMultiplier: 15 })
    expect(Object.fromEntries(Object.entries(TECHNOLOGIES).map(([key, technology]) => [key, technology.cost]))).toEqual({ solar: 150, thermal: 60_000, thorium: 300_000, fusion: 20_000_000, expansion: 100_000_000 })
    expect(AUTO_REBUILD_COSTS).toEqual({ wind: 15, solar: 3_000, core: 150_000, thorium: 9_000_000, fusion: 60_000_000 })
  })

  it('matches every component value from the promoted Debug profile', () => {
    expect(COMPONENTS).toMatchObject({
      wind: { cost: 1, capacity: 0, directEnergy: 0.2, fuelCycles: 10, refuelCost: 1 },
      solar: { cost: 10_000, capacity: 0, directEnergy: 100, fuelCycles: 150, refuelCost: 10_000 },
      sales: { cost: 250, capacity: 0, salesRate: 50 },
      sales2: { cost: 250, capacity: 0, salesRate: 50 },
      battery: { cost: 50_000, capacity: 0, storageCapacity: 100_000 },
      research: { cost: 500, capacity: 0, researchRate: 1 },
      research2: { cost: 500, capacity: 0, researchRate: 1 },
      controller: { cost: 100_000_000, capacity: 0, controllerBonus: 0.1 },
      core: { cost: 1_000_000, capacity: 20_000, production: 7_500, fuelCycles: 200, refuelCost: 1_000_000 },
      thorium: { cost: 1_250_000_000, capacity: 150_000_000, production: 25_000_000, fuelCycles: 75, refuelCost: 1_250_000_000 },
      fusion: { cost: 280_000_000_000, capacity: 75_000_000_000, production: 12_500_000_000, fuelCycles: 34, refuelCost: 280_000_000_000 },
      generator: { cost: 30_000, capacity: 4_000, conversionRate: 1_875 },
      cooler: { cost: 1_000_000, capacity: 0, coolingRate: 50_000 },
      exchanger: { cost: 50_000_000, capacity: 2_000_000 },
      pipe: { cost: 10_000_000, capacity: 300_000 },
      accumulator: { cost: 250_000_000, capacity: 10_000_000 },
    })
    expect(COMPONENTS.exchanger.thermalResistance).toBeCloseTo(2.24071005886228, 12)
    expect(COMPONENTS.pipe.thermalResistance).toBeCloseTo(1.23315173118822, 12)
    expect(COMPONENTS.accumulator.thermalResistance).toBeCloseTo(24.7491582262546, 12)
  })

  it('matches every base upgrade price and the promoted scaling', () => {
    expect(UPGRADE_BASE_COSTS).toEqual({
      wind: { output: 30, capacity: 26, autonomy: 23 },
      solar: { output: 80_000, capacity: 306_000, autonomy: 60_000 },
      sales: { output: 8_000, capacity: 25_500, autonomy: 22_500 },
      sales2: { output: 8_000, capacity: 25_500, autonomy: 22_500 },
      battery: { output: 250_000, capacity: 1_275_000, autonomy: 1_125_000 },
      research: { output: 10_000, capacity: 12_750, autonomy: 11_250 },
      research2: { output: 10_000, capacity: 12_750, autonomy: 11_250 },
      controller: { output: 3_000_000_000, capacity: 2_550_000_000, autonomy: 2_250_000_000 },
      core: { output: 3_500_000, capacity: 2_000_000, autonomy: 2_500_000 },
      thorium: { output: 37_500_000_000, capacity: 31_875_000_000, autonomy: 28_125_000_000 },
      fusion: { output: 8_400_000_000_000, capacity: 7_140_000_000_000, autonomy: 6_300_000_000_000 },
      generator: { output: 150_000, capacity: 90_000, autonomy: 33_750_000 },
      cooler: { output: 30_000_000, capacity: 25_500_000, autonomy: 22_500_000 },
      exchanger: { output: 1_500_000_000, capacity: 1_275_000_000, autonomy: 1_125_000_000 },
      pipe: { output: 300_000_000, capacity: 255_000_000, autonomy: 225_000_000 },
      accumulator: { output: 7_500_000_000, capacity: 6_375_000_000, autonomy: 5_625_000_000 },
    })
    const state = createInitialState()
    expect(upgradeCost(state, 'solar', 'output')).toBe(80_000)
    const levelTwo = { ...state, sectorEconomies: { ...state.sectorEconomies, coast: { ...state.sectorEconomies.coast, buildingLevels: { ...state.sectorEconomies.coast.buildingLevels, solar: 2 } } } }
    expect(upgradeCost(levelTwo, 'solar', 'output')).toBe(176_000)
    expect(nextUpgradeGainPercent(state, 'solar', 'output')).toBeCloseTo(35)
  })

  it('keeps paid producers profitable over their base lifetime', () => {
    for (const kind of ['wind', 'solar', 'core', 'thorium', 'fusion'] as const) {
      const definition = COMPONENTS[kind]
      const grossReturn = (definition.directEnergy ?? definition.production ?? 0) * (definition.fuelCycles ?? 0) / definition.cost
      expect(grossReturn).toBeGreaterThanOrEqual(1.5)
      expect(grossReturn).toBeLessThanOrEqual(2)
    }
  })

  it('keeps thermal unlock structure and generator ratio intact', () => {
    const state = createInitialState()
    const thermalOnly = { ...state, unlockedTechs: { ...state.unlockedTechs, solar: true, thermal: true } }
    expect(isComponentUnlocked(thermalOnly, 'core')).toBe(true)
    expect(isComponentUnlocked(thermalOnly, 'generator')).toBe(true)
    expect(isComponentUnlocked(thermalOnly, 'cooler')).toBe(false)
    expect(isComponentUnlocked(thermalOnly, 'sales2')).toBe(false)
    const thorium = { ...thermalOnly, unlockedTechs: { ...thermalOnly.unlockedTechs, thorium: true } }
    for (const kind of ['thorium', 'cooler', 'pipe', 'exchanger', 'accumulator', 'controller', 'sales2', 'research2'] as const) expect(isComponentUnlocked(thorium, kind)).toBe(true)
    expect(COMPONENTS.generator.conversionRate).toBe(COMPONENTS.core.production! / 4)
    expect(levelMultiplier(10)).toBeCloseTo(Math.pow(1.35, 9) * 2.5)
  })
})
