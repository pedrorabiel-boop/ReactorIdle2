import { describe, expect, it } from 'vitest'
import { ECONOMY, TECHNOLOGIES, levelMultiplier } from './balance'
import { COMPONENTS } from './catalog'
import { createInitialState, isComponentUnlocked } from './engine'
import { nextUpgradeGainPercent, upgradeCost } from './research'
import type { ComponentKind } from './types'

interface TierStep {
  previous: 'wind' | 'solar' | 'core' | 'thorium'
  next: 'solar' | 'core' | 'thorium' | 'fusion'
  previousUnits: number
}

const TIER_STEPS: TierStep[] = [
  { previous: 'wind', next: 'solar', previousUnits: 16 },
  { previous: 'solar', next: 'core', previousUnits: 16 },
  { previous: 'core', next: 'thorium', previousUnits: 5 },
  { previous: 'thorium', next: 'fusion', previousUnits: 2.5 },
]

const baseOutput = (kind: ComponentKind) => COMPONENTS[kind].directEnergy ?? COMPONENTS[kind].production ?? 0
const maxOutput = (kind: ComponentKind) => baseOutput(kind) * levelMultiplier(ECONOMY.maxBuildingLevel)

describe('tier progression balance', () => {
  it('makes every new generator 10 to 15 times stronger than the previous maxed tier', () => {
    const rows = TIER_STEPS.map(({ previous, next, previousUnits }) => {
      const previousMax = maxOutput(previous)
      const outputJump = baseOutput(next) / previousMax
      const minutesToBuy = COMPONENTS[next].cost / (previousMax * previousUnits * 60)
      return { previous, next, previousMax, outputJump, minutesToBuy }
    })

    console.table(rows.map(({ previous, next, outputJump, minutesToBuy }) => ({
      tier: `${previous} -> ${next}`,
      salto: `${outputJump.toFixed(2)}x`,
      minutos: minutesToBuy.toFixed(2),
    })))

    for (const row of rows) {
      expect(row.outputJump).toBeGreaterThanOrEqual(10)
      expect(row.outputJump).toBeLessThanOrEqual(15)
      expect(row.minutesToBuy).toBeGreaterThanOrEqual(1)
      expect(row.minutesToBuy).toBeLessThanOrEqual(3)
    }
  })

  it('gives each paid producer a 150 to 200 percent gross lifetime return', () => {
    for (const kind of ['wind', 'solar', 'core', 'thorium', 'fusion'] as const) {
      const definition = COMPONENTS[kind]
      const grossReturn = baseOutput(kind) * (definition.fuelCycles ?? 0) / definition.cost
      expect(grossReturn).toBeGreaterThanOrEqual(1.5)
      expect(grossReturn).toBeLessThanOrEqual(2)
    }
  })

  it('starts production upgrades at thirty tower prices and keeps their impact at 35 percent', () => {
    const state = createInitialState()
    for (const kind of ['wind', 'solar', 'core', 'thorium', 'fusion'] as const) {
      expect(upgradeCost(state, kind, 'output')).toBe(COMPONENTS[kind].cost * 30)
      expect(nextUpgradeGainPercent(state, kind, 'output')).toBeCloseTo(35)
    }
  })

  it('raises each consecutive upgrade by 2.25 times to prevent bulk purchases', () => {
    const state = createInitialState()
    const first = upgradeCost(state, 'solar')
    const levelTwo = {
      ...state,
      sectorEconomies: {
        ...state.sectorEconomies,
        coast: {
          ...state.sectorEconomies.coast,
          buildingLevels: { ...state.sectorEconomies.coast.buildingLevels, solar: 2 },
        },
      },
    }
    expect(upgradeCost(levelTwo, 'solar') / first).toBeCloseTo(ECONOMY.upgradeGrowth)
  })

  it('unlocks only core and generator with thermal research', () => {
    const state = createInitialState()
    const thermalOnly = {
      ...state,
      unlockedTechs: { ...state.unlockedTechs, solar: true, thermal: true },
    }
    expect(isComponentUnlocked(thermalOnly, 'core')).toBe(true)
    expect(isComponentUnlocked(thermalOnly, 'generator')).toBe(true)
    expect(isComponentUnlocked(thermalOnly, 'cooler')).toBe(false)
    expect(isComponentUnlocked(thermalOnly, 'pipe')).toBe(false)
    expect(isComponentUnlocked(thermalOnly, 'exchanger')).toBe(false)
    expect(isComponentUnlocked(thermalOnly, 'accumulator')).toBe(false)
  })

  it('places thermal logistics one hundred times beyond basic thermal research', () => {
    expect(TECHNOLOGIES.logistics.cost).toBeGreaterThanOrEqual(TECHNOLOGIES.thermal.cost * 100)
  })

  it('starts each generator turbine at exactly one quarter of a base core', () => {
    expect(COMPONENTS.generator.conversionRate).toBe(COMPONENTS.core.production! / 4)
  })
})
