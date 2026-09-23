import { AUTO_REBUILD_COSTS, ECONOMY, levelMultiplier, TECHNOLOGIES, UPGRADE_BASE_COSTS } from './balance'
import { COMPONENTS } from './catalog'
import { canAfford, configuredUpgradeBaseCost, spendCredits } from './debug'
import type { ComponentKind, GameState, TechKey, UpgradeTrack } from './types'

const economy = (state: GameState) => state.sectorEconomies[state.activeSector]
const SCALING_THERMAL_NETWORK = new Set<ComponentKind>(['exchanger', 'pipe', 'accumulator'])
export const thermalTierScale = (state: GameState) => state.unlockedTechs.fusion ? 250_000 : state.unlockedTechs.thorium ? 500 : 1
export const componentLevel = (state: GameState, kind: ComponentKind) => economy(state).buildingLevels[kind] ?? 1
export const capacityLevel = (state: GameState, kind: ComponentKind) => economy(state).capacityLevels[kind] ?? 1
export const autonomyLevel = (state: GameState, kind: ComponentKind) => economy(state).autonomyLevels[kind] ?? 1
export const componentMultiplier = (state: GameState, kind: ComponentKind) => levelMultiplier(componentLevel(state, kind))
export const capacityMultiplier = (state: GameState, kind: ComponentKind) => levelMultiplier(capacityLevel(state, kind))
export const autonomyMultiplier = (state: GameState, kind: ComponentKind) => levelMultiplier(autonomyLevel(state, kind))
export const componentCapacity = (state: GameState, kind: ComponentKind) => COMPONENTS[kind].capacity * capacityMultiplier(state, kind) * (SCALING_THERMAL_NETWORK.has(kind) ? thermalTierScale(state) : 1)
export const fuelCapacity = (state: GameState, kind: ComponentKind) => (COMPONENTS[kind].fuelCycles ?? 0) * autonomyMultiplier(state, kind)
export const directEnergyRate = (state: GameState, kind: ComponentKind) => (COMPONENTS[kind].directEnergy ?? 0) * componentMultiplier(state, kind) * (state.activeSector === 'desert' && kind === 'solar' ? 1.25 : 1)
export const productionRate = (state: GameState, kind: ComponentKind) => (COMPONENTS[kind].production ?? 0) * componentMultiplier(state, kind)
export const conversionRate = (state: GameState) => (COMPONENTS.generator.conversionRate ?? 0) * componentMultiplier(state, 'generator') * thermalTierScale(state)
export const coolingRate = (state: GameState) => (COMPONENTS.cooler.coolingRate ?? 0) * componentMultiplier(state, 'cooler') * thermalTierScale(state)
export const thermalResistance = (state: GameState, kind: ComponentKind) => {
  const baseline = COMPONENTS.pipe.thermalResistance ?? 1
  const resistance = COMPONENTS[kind].thermalResistance
  return resistance === undefined ? baseline : resistance / componentMultiplier(state, kind)
}
export const storagePerBattery = (state: GameState) => (COMPONENTS.battery.storageCapacity ?? 0) * componentMultiplier(state, 'battery') * thermalTierScale(state)
export const salesPerOffice = (state: GameState) => (COMPONENTS.sales.salesRate ?? 0) * componentMultiplier(state, 'sales') * thermalTierScale(state)
export const researchPerFacility = (state: GameState) => (COMPONENTS.research.researchRate ?? 0) * componentMultiplier(state, 'research')
export const autoRebuildCost = (state: GameState, kind: ComponentKind) => state.debug.enabled ? state.debug.autoRebuildCosts[kind] ?? Number.POSITIVE_INFINITY : AUTO_REBUILD_COSTS[kind] ?? Number.POSITIVE_INFINITY
export function canUnlockAutoRebuild(state: GameState, kind: ComponentKind): boolean { return Boolean(COMPONENTS[kind].fuelCycles) && !state.autoRebuilds[kind] && state.researchPoints >= autoRebuildCost(state, kind) }
export function unlockAutoRebuild(state: GameState, kind: ComponentKind): GameState { const cost = autoRebuildCost(state, kind); return canUnlockAutoRebuild(state, kind) ? { ...state, researchPoints: state.researchPoints - cost, autoRebuilds: { ...state.autoRebuilds, [kind]: true } } : state }
export function upgradeTracks(kind: ComponentKind): UpgradeTrack[] {
  const def = COMPONENTS[kind]
  const tracks: UpgradeTrack[] = []
  if (def.directEnergy || def.production || def.thermalResistance || def.conversionRate || def.coolingRate || def.storageCapacity || def.salesRate || def.researchRate || def.controllerBonus) tracks.push('output')
  if (def.capacity > 0) tracks.push('capacity')
  if (def.fuelCycles) tracks.push('autonomy')
  return tracks
}
export function upgradeLevel(state: GameState, kind: ComponentKind, track: UpgradeTrack): number { return track === 'output' ? componentLevel(state, kind) : track === 'capacity' ? capacityLevel(state, kind) : autonomyLevel(state, kind) }
export function upgradeCost(state: GameState, kind: ComponentKind, track: UpgradeTrack = 'output'): number {
  const fallback = UPGRADE_BASE_COSTS[kind][track]
  return Math.round(configuredUpgradeBaseCost(state, kind, track, fallback) * Math.pow(ECONOMY.upgradeGrowth, upgradeLevel(state, kind, track) - 1))
}
export function nextUpgradeGainPercent(state: GameState, kind: ComponentKind, track: UpgradeTrack): number {
  const level = upgradeLevel(state, kind, track)
  if (level >= ECONOMY.maxBuildingLevel) return 0
  return (levelMultiplier(level + 1) / levelMultiplier(level) - 1) * 100
}
export function upgradeBuildingTrack(state: GameState, kind: ComponentKind, track: UpgradeTrack): GameState {
  if (!upgradeTracks(kind).includes(track)) return state
  const level = upgradeLevel(state, kind, track); const cost = upgradeCost(state, kind, track)
  if (level >= ECONOMY.maxBuildingLevel || !canAfford(state, cost)) return state
  const currentEconomy = economy(state)
  if (track === 'output') return { ...state, credits: spendCredits(state, cost), sectorEconomies: { ...state.sectorEconomies, [state.activeSector]: { ...currentEconomy, buildingLevels: { ...currentEconomy.buildingLevels, [kind]: level + 1 } } } }
  if (track === 'capacity') return { ...state, credits: spendCredits(state, cost), sectorEconomies: { ...state.sectorEconomies, [state.activeSector]: { ...currentEconomy, capacityLevels: { ...currentEconomy.capacityLevels, [kind]: level + 1 } } } }
  const oldCapacity = fuelCapacity(state, kind)
  const autonomyLevels = { ...currentEconomy.autonomyLevels, [kind]: level + 1 }
  const upgraded = { ...state, sectorEconomies: { ...state.sectorEconomies, [state.activeSector]: { ...currentEconomy, autonomyLevels } } }
  const newCapacity = fuelCapacity(upgraded, kind)
  const currentLayouts = { ...state.sectorLayouts, [state.activeSector]: state.tiles }
  const activeTiles = currentLayouts[state.activeSector].map((tile) => tile?.kind === kind ? { ...tile, fuel: oldCapacity > 0 ? tile.fuel / oldCapacity * newCapacity : newCapacity } : tile)
  const sectorLayouts = { ...currentLayouts, [state.activeSector]: activeTiles }
  return { ...upgraded, credits: spendCredits(state, cost), sectorLayouts, tiles: activeTiles }
}
/** Compatibilidad interna para simuladores: mejora la producción del tipo en el mapa activo. */
export const upgradeBuildingType = (state: GameState, kind: ComponentKind) => upgradeBuildingTrack(state, kind, 'output')
export function canUnlockTech(state: GameState, key: TechKey): boolean { const tech = TECHNOLOGIES[key]; return !state.unlockedTechs[key] && (!tech.requires || state.unlockedTechs[tech.requires]) && state.researchPoints >= tech.cost }
export function unlockTech(state: GameState, key: TechKey): GameState { return canUnlockTech(state, key) ? { ...state, researchPoints: state.researchPoints - TECHNOLOGIES[key].cost, unlockedTechs: { ...state.unlockedTechs, [key]: true } } : state }
