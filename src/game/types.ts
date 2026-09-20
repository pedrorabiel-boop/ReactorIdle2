export type ComponentKind = 'wind' | 'solar' | 'battery' | 'controller' | 'core' | 'thorium' | 'fusion' | 'exchanger' | 'pipe' | 'accumulator' | 'generator' | 'cooler'
export type ToolMode = 'build' | 'demolish' | 'inspect'
export type UpgradeKey = 'renewable' | 'storage' | 'maintenance' | 'containment' | 'transfer' | 'turbine' | 'cooling' | 'market' | 'fuel'
export type ContractKind = 'renewable' | 'energy' | 'thermal'
export type SectorKey = 'coast' | 'desert'

export interface EnergyContract {
  id: string
  kind: ContractKind
  title: string
  description: string
  target: number
  progress: number
  rewardCredits: number
  rewardScience: number
}

export interface ComponentDefinition {
  kind: ComponentKind
  name: string
  shortName: string
  description: string
  icon: string
  cost: number
  capacity: number
  production?: number
  transferRate?: number
  conversionRate?: number
  coolingRate?: number
  unlockEnergy?: number
  fuelCycles?: number
  refuelCost?: number
  directEnergy?: number
  storageCapacity?: number
  storageRate?: number
}

export interface Tile {
  id: string
  kind: ComponentKind
  heat: number
  enabled: boolean
  flow: number
  fuel: number
  autoRefuel: boolean
  condition: number
  autoMaintain: boolean
  charge: number
}

export interface GameState {
  version: 9
  rows: number
  cols: number
  tiles: Array<Tile | null>
  credits: number
  totalEnergy: number
  science: number
  upgrades: Record<UpgradeKey, number>
  tick: number
  explosions: number
  totalFuelSpent: number
  totalMaintenanceSpent: number
  activeContract: EnergyContract
  contractsCompleted: number
  activeSector: SectorKey
  sectorLayouts: Record<SectorKey, Array<Tile | null>>
  prestige: number
  selectedKind: ComponentKind
  toolMode: ToolMode
  paused: boolean
  speed: 1 | 2 | 4
}

export interface TickReport {
  generatedEnergy: number
  generatedScience: number
  cooledHeat: number
  explosions: number
  refuelCost: number
  maintenanceCost: number
  directEnergy: number
  thermalEnergy: number
  batteryEnergy: number
  storedEnergy: number
}
