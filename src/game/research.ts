import { AUTO_REBUILD_COSTS, ECONOMY, GIFT_TICKS_PER_THERMAL_TECH, TECHNOLOGIES, THERMAL_TECHS, UPGRADE_BASE_COSTS, levelMultiplier } from './balance'
import { COMPONENTS } from './catalog'
import { canAfford, configuredUpgradeBaseCost, spendCredits } from './debug'
import type { ComponentKind, GameState, TechKey, UpgradeTrack } from './types'

const economy = (state: GameState) => state.sectorEconomies[state.activeSector]
const baselineLevel = (state: GameState) => state.activeSector === 'desert' ? 0 : 1
const effectiveLevel = (state: GameState, level: number) => level - baselineLevel(state) + 1
export const maxUpgradeLevel = (state: GameState) => state.activeSector === 'desert' ? ECONOMY.maxCyberpunkBuildingLevel : ECONOMY.maxBuildingLevel
export const componentLevel = (state: GameState, kind: ComponentKind) => economy(state).buildingLevels[kind] ?? baselineLevel(state)
export const capacityLevel = (state: GameState, kind: ComponentKind) => economy(state).capacityLevels[kind] ?? baselineLevel(state)
export const autonomyLevel = (state: GameState, kind: ComponentKind) => economy(state).autonomyLevels[kind] ?? baselineLevel(state)
export const componentMultiplier = (state: GameState, kind: ComponentKind) => levelMultiplier(effectiveLevel(state, componentLevel(state, kind)))
export const capacityMultiplier = (state: GameState, kind: ComponentKind) => levelMultiplier(effectiveLevel(state, capacityLevel(state, kind)))
export const autonomyMultiplier = (state: GameState, kind: ComponentKind) => levelMultiplier(effectiveLevel(state, autonomyLevel(state, kind)))
export const componentCapacity = (state: GameState, kind: ComponentKind) => COMPONENTS[kind].capacity * capacityMultiplier(state, kind)
export const fuelCapacity = (state: GameState, kind: ComponentKind) => (COMPONENTS[kind].fuelCycles ?? 0) * autonomyMultiplier(state, kind)
export const directEnergyRate = (state: GameState, kind: ComponentKind) => (COMPONENTS[kind].directEnergy ?? 0) * componentMultiplier(state, kind) * (state.activeSector === 'desert' && kind === 'solar' ? 1.25 : 1)
export const productionRate = (state: GameState, kind: ComponentKind) => (COMPONENTS[kind].production ?? 0) * componentMultiplier(state, kind)
export const conversionRate = (state: GameState, kind: 'generator' | 'generator2' = 'generator') => (COMPONENTS[kind].conversionRate ?? 0) * componentMultiplier(state, kind)
export const coolingRate = (state: GameState) => (COMPONENTS.cooler.coolingRate ?? 0) * componentMultiplier(state, 'cooler')
export const thermalTransferRate = (state: GameState, kind: ComponentKind) => (COMPONENTS[kind].referenceTransferRate ?? 0) * componentMultiplier(state, kind)
export const thermalResistance = (state: GameState, kind: ComponentKind) => {
  const baseline = COMPONENTS.pipe.thermalResistance ?? 1
  const resistance = COMPONENTS[kind].thermalResistance
  return resistance === undefined ? baseline : resistance / componentMultiplier(state, kind)
}
export const storagePerBattery = (state: GameState) => (COMPONENTS.battery.storageCapacity ?? 0) * componentMultiplier(state, 'battery')
export const salesPerOffice = (state: GameState, kind: 'sales' | 'sales2' = 'sales') => (COMPONENTS[kind].salesRate ?? 0) * componentMultiplier(state, kind)
export const researchPerFacility = (state: GameState, kind: 'research' | 'research2' = 'research') => (COMPONENTS[kind].researchRate ?? 0) * componentMultiplier(state, kind)
export const autoRebuildCost = (state: GameState, kind: ComponentKind) => state.debug.enabled ? state.debug.autoRebuildCosts[kind] ?? Number.POSITIVE_INFINITY : AUTO_REBUILD_COSTS[kind] ?? Number.POSITIVE_INFINITY
export function canUnlockAutoRebuild(state: GameState, kind: ComponentKind): boolean { return Boolean(COMPONENTS[kind].fuelCycles) && !state.autoRebuilds[kind] && state.researchPoints >= autoRebuildCost(state, kind) }
export function unlockAutoRebuild(state: GameState, kind: ComponentKind): GameState { const cost = autoRebuildCost(state, kind); return canUnlockAutoRebuild(state, kind) ? { ...state, researchPoints: state.researchPoints - cost, autoRebuilds: { ...state.autoRebuilds, [kind]: true } } : state }
export function upgradeTracks(kind: ComponentKind): UpgradeTrack[] {
  const def = COMPONENTS[kind]
  const tracks: UpgradeTrack[] = []
  if (def.directEnergy || def.production || def.referenceTransferRate || def.thermalResistance || def.conversionRate || def.coolingRate || def.storageCapacity || def.salesRate || def.researchRate || def.controllerBonus) tracks.push('output')
  if (def.capacity > 0) tracks.push('capacity')
  if (def.fuelCycles) tracks.push('autonomy')
  return tracks
}
export function upgradeLevel(state: GameState, kind: ComponentKind, track: UpgradeTrack): number { return track === 'output' ? componentLevel(state, kind) : track === 'capacity' ? capacityLevel(state, kind) : autonomyLevel(state, kind) }
export function upgradeCost(state: GameState, kind: ComponentKind, track: UpgradeTrack = 'output'): number {
  const fallback = UPGRADE_BASE_COSTS[kind][track]
  return Math.round(configuredUpgradeBaseCost(state, kind, track, fallback) * Math.pow(ECONOMY.upgradeGrowth, upgradeLevel(state, kind, track) - baselineLevel(state)))
}
export function nextUpgradeGainPercent(state: GameState, kind: ComponentKind, track: UpgradeTrack): number {
  const level = upgradeLevel(state, kind, track)
  if (level >= maxUpgradeLevel(state)) return 0
  return (levelMultiplier(effectiveLevel(state, level + 1)) / levelMultiplier(effectiveLevel(state, level)) - 1) * 100
}
export function upgradeBuildingTrack(state: GameState, kind: ComponentKind, track: UpgradeTrack): GameState {
  if (!upgradeTracks(kind).includes(track)) return state
  const level = upgradeLevel(state, kind, track); const cost = upgradeCost(state, kind, track)
  if (level >= maxUpgradeLevel(state) || !canAfford(state, cost)) return state
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
export function unlockTech(state: GameState, key: TechKey): GameState {
  if (!canUnlockTech(state, key)) return state
  // Cada salto térmico regala ticks de bonus para estrenar la nueva red.
  const gift = THERMAL_TECHS.includes(key) ? GIFT_TICKS_PER_THERMAL_TECH : 0
  return { ...state, researchPoints: state.researchPoints - TECHNOLOGIES[key].cost, unlockedTechs: { ...state.unlockedTechs, [key]: true }, giftTicks: state.giftTicks + gift }
}
