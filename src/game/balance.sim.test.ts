import { describe, expect, it } from 'vitest'
import { LIFETIME_ORDER, TECH_ORDER } from './balance'
import { COMPONENTS } from './catalog'
import { buyDesertSector, createInitialState, globalSalesCapacity, placeTile, refuelTile, sellStoredEnergy, simulateTick } from './engine'
import { canUnlockAutoRebuild, canUnlockTech, unlockAutoRebuild, unlockTech, upgradeBuildingType, upgradeCost } from './research'
import type { ComponentKind, GameState } from './types'

interface Milestones { research?: number; solar?: number; thermal?: number; logistics?: number; thorium?: number; fusion?: number; expansion?: number; island?: number }
const RESERVED = new Set([1, 8, 9, 10, 17])
function count(state: GameState, kind: ComponentKind) { return state.tiles.filter((tile) => tile?.kind === kind).length }
function placeNext(state: GameState, kind: ComponentKind, range: number[]): GameState { const index = range.find((candidate) => !state.tiles[candidate] && !RESERVED.has(candidate)); return index === undefined ? state : placeTile(state, index, kind) }

function runBalancedOpening(maxSeconds = 18_000): { state: GameState; milestones: Milestones } {
  let state = createInitialState()
  const milestones: Milestones = {}
  const ranges = { wind: [...Array(15).keys()].map((i) => i + 20), solar: [...Array(14).keys()].map((i) => i + 35), sales: [...Array(8).keys()].map((i) => i + 49), research: [...Array(16).keys()].map((i) => i + 57), battery: [73, 74, 75], controller: [76, 77] }
  for (let second = 0; second <= maxSeconds; second += 1) {
    if (state.energyStored > 0 && count(state, 'sales') === 0) state = sellStoredEnergy(state)
    for (let index = 0; index < state.tiles.length; index += 1) if (state.tiles[index] && state.tiles[index]!.fuel <= 0 && COMPONENTS[state.tiles[index]!.kind].fuelCycles) state = refuelTile(state, index)
    if (count(state, 'wind') < 15 && state.credits >= 1) state = placeNext(state, 'wind', ranges.wind)
    if (state.totalEnergySold >= 5 && globalSalesCapacity(state) < Math.max(5, state.lastReport.producedEnergy) && state.credits >= 25) state = placeNext(state, 'sales', ranges.sales)
    if (state.totalCreditsEarned >= 50 && count(state, 'research') < 16 && state.credits >= COMPONENTS.research.cost) { state = placeNext(state, 'research', ranges.research); milestones.research ??= second }
    for (const key of TECH_ORDER) if (canUnlockTech(state, key)) { state = unlockTech(state, key); milestones[key as keyof Milestones] ??= second }
    for (const kind of LIFETIME_ORDER) if (canUnlockAutoRebuild(state, kind)) state = unlockAutoRebuild(state, kind)
    if (state.unlockedTechs.solar && count(state, 'solar') < 14 && state.credits >= 20) state = placeNext(state, 'solar', ranges.solar)
    if (state.unlockedTechs.solar && count(state, 'battery') < 2 && state.credits >= 100) state = placeNext(state, 'battery', ranges.battery)
    if (state.unlockedTechs.thermal && !state.tiles[9] && state.credits >= 1_000) { state = placeTile(state, 9, 'core'); for (const index of [1, 8, 10, 17]) state = placeTile(state, index, 'generator') }
    if (state.unlockedTechs.automation && count(state, 'controller') < 2 && state.credits >= 800) state = placeNext(state, 'controller', ranges.controller)
    if (count(state, 'research') >= 4 && state.buildingLevels.research < 10 && state.credits >= upgradeCost(state, 'research') * 1.5) state = upgradeBuildingType(state, 'research')
    if (count(state, 'solar') >= 8 && state.buildingLevels.solar < 12 && state.credits >= upgradeCost(state, 'solar') * 1.5) state = upgradeBuildingType(state, 'solar')
    if (count(state, 'sales') >= 2 && state.buildingLevels.sales < 10 && state.credits >= upgradeCost(state, 'sales') * 1.5) state = upgradeBuildingType(state, 'sales')
    if (state.unlockedTechs.expansion && !state.ownedSectors.desert && state.credits >= 500_000) { state = buyDesertSector(state); milestones.island = second; break }
    state = simulateTick(state).state
  }
  return { state, milestones }
}

describe('deterministic balance simulation', () => {
  it('prints and validates the seed progression', () => {
    const result = runBalancedOpening()
    console.table(Object.entries(result.milestones).map(([milestone, seconds]) => ({ milestone, minutes: Math.round((seconds as number) / 6) / 10 })))
    expect(result.milestones.research).toBeGreaterThanOrEqual(180)
    expect(result.milestones.research).toBeLessThanOrEqual(360)
    expect(result.milestones.solar).toBeGreaterThanOrEqual(480)
    expect(result.milestones.solar).toBeLessThanOrEqual(900)
    expect(result.milestones.thermal).toBeGreaterThanOrEqual(1_200)
    expect(result.milestones.thermal).toBeLessThanOrEqual(2_100)
    expect(result.milestones.logistics).toBeGreaterThanOrEqual(2_400)
    expect(result.milestones.logistics).toBeLessThanOrEqual(3_600)
    expect(result.milestones.thorium).toBeGreaterThanOrEqual(4_200)
    expect(result.milestones.thorium).toBeLessThanOrEqual(6_600)
    expect(result.milestones.fusion).toBeGreaterThanOrEqual(7_800)
    expect(result.milestones.fusion).toBeLessThanOrEqual(11_400)
    expect(result.milestones.island).toBeGreaterThanOrEqual(10_800)
    expect(result.milestones.island).toBeLessThanOrEqual(18_000)
  }, 30_000)
})
