export type ComponentKind = 'wind' | 'solar' | 'battery' | 'controller' | 'sales' | 'sales2' | 'research' | 'research2' | 'core' | 'thorium' | 'fusion' | 'exchanger' | 'pipe' | 'pipe2' | 'accumulator' | 'generator' | 'generator2' | 'cooler'
export type ToolMode = 'build' | 'demolish' | 'inspect'
export type TechKey = 'solar' | 'thermal' | 'thorium' | 'fusion' | 'expansion'
export type ContractKind = 'renewable' | 'energy' | 'thermal' | 'sales' | 'research'
export type SectorKey = 'coast' | 'desert'
export type UpgradeTrack = 'output' | 'capacity' | 'autonomy'
export type ComponentNumericKey = 'cost' | 'capacity' | 'directEnergy' | 'production' | 'referenceTransferRate' | 'thermalResistance' | 'conversionRate' | 'coolingRate' | 'fuelCycles' | 'refuelCost' | 'storageCapacity' | 'salesRate' | 'researchRate' | 'controllerBonus'
export type DebugEconomyKey = 'baseStorage' | 'baseSalesRate' | 'energyPrice' | 'sellRefund' | 'repairRate' | 'maxOfflineSeconds' | 'secondIslandCost' | 'maxBuildingLevel' | 'maxCyberpunkBuildingLevel' | 'outputGrowth' | 'upgradeGrowth' | 'upgradeBaseMultiplier'

export interface DebugSettings {
  enabled: boolean
  infiniteMoney: boolean
  unlockAllBuildings: boolean
  initialCredits: number
  componentValues: Record<ComponentKind, Partial<Record<ComponentNumericKey, number>>>
  technologyCosts: Record<TechKey, number>
  autoRebuildCosts: Partial<Record<ComponentKind, number>>
  economy: Record<DebugEconomyKey, number>
  upgradeBaseCosts: Record<ComponentKind, Record<UpgradeTrack, number>>
}

export interface EnergyContract { id: string; kind: ContractKind; title: string; description: string; target: number; progress: number; rewardCredits: number; rewardResearch: number }

export interface ComponentDefinition {
  kind: ComponentKind; name: string; shortName: string; description: string; icon: string; cost: number; capacity: number; tech?: TechKey
  directEnergy?: number; production?: number; referenceTransferRate?: number; thermalResistance?: number; conversionRate?: number; coolingRate?: number; fuelCycles?: number
  refuelCost?: number; storageCapacity?: number; salesRate?: number; researchRate?: number; controllerBonus?: number
}

export interface Tile { id: string; kind: ComponentKind; heat: number; enabled: boolean; damaged: boolean; flow: number; fuel: number; autoRefuel: boolean }

export interface SectorEconomy {
  energyStored: number
  buildingLevels: Record<ComponentKind, number>
  capacityLevels: Record<ComponentKind, number>
  autonomyLevels: Record<ComponentKind, number>
}

export interface GameState {
  version: 18; rows: number; cols: number; tiles: Array<Tile | null>; credits: number; totalEnergy: number
  totalEnergySold: number; totalCreditsEarned: number; researchPoints: number; unlockedTechs: Record<TechKey, boolean>
  autoRebuilds: Record<ComponentKind, boolean>
  tick: number; incidents: number; totalFuelSpent: number; totalRepairSpent: number
  activeContract: EnergyContract; contractsCompleted: number; activeSector: SectorKey; sectorLayouts: Record<SectorKey, Array<Tile | null>>
  sectorEconomies: Record<SectorKey, SectorEconomy>; sectorReports: Record<SectorKey, TickReport>
  ownedSectors: Record<SectorKey, boolean>; selectedKind: ComponentKind; toolMode: ToolMode; paused: boolean; speed: 1 | 2 | 4; lastReport: TickReport
  debug: DebugSettings
}

export interface TickReport {
  producedEnergy: number; directEnergy: number; thermalEnergy: number; storedEnergy: number; wastedEnergy: number; soldEnergy: number
  earnedCredits: number; generatedResearch: number; cooledHeat: number; incidents: number; refuelCost: number; repairCost: number
  storageCapacity: number; salesCapacity: number; conversionCapacity: number; heatProduction: number
}
