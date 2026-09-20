import { COMPONENTS } from './catalog'
import { componentCapacity, conversionRate, coolingRate, EMPTY_UPGRADES, energyCreditValue, fuelCapacity, maintenanceCostMultiplier, renewableMultiplier, storageCapacity, storageRate, transferRate } from './research'
import type { ComponentKind, ContractKind, EnergyContract, GameState, SectorKey, TickReport, Tile } from './types'

export const ENERGY_VALUE = 2
export const SCIENCE_PER_ENERGY = 0.05
export const SELL_REFUND = 0.5
export const WEAR_PER_CYCLE = 0.05
export const AUTO_MAINTENANCE_THRESHOLD = 25
export const DESERT_UNLOCK_ENERGY = 25000
export const PRESTIGE_UNLOCK_ENERGY = 100000

export function createContract(completed: number, totalEnergy: number): EnergyContract {
  const thermalUnlocked = totalEnergy >= (COMPONENTS.core.unlockEnergy ?? 0)
  const sequence: ContractKind[] = thermalUnlocked ? ['renewable', 'energy', 'thermal'] : ['renewable', 'energy']
  const kind = sequence[completed % sequence.length]
  const target = Math.round(100 * Math.pow(1.45, Math.min(completed, 12)))
  const details: Record<ContractKind, Pick<EnergyContract, 'title' | 'description'>> = {
    renewable: { title: 'Suministro renovable', description: 'Produce energía mediante eólica y solar.' },
    energy: { title: 'Demanda regional', description: 'Genera energía con cualquier tecnología.' },
    thermal: { title: 'Contrato térmico', description: 'Convierte calor en energía mediante turbinas.' },
  }
  return {
    id: `${kind}-${completed}`,
    kind,
    ...details[kind],
    target,
    progress: 0,
    rewardCredits: target * 3,
    rewardScience: Math.max(2, Math.round(target * 0.04 * 10) / 10),
  }
}

export function createInitialState(): GameState {
  const coastTiles: GameState['tiles'] = Array.from({ length: 80 }, () => null)
  const desertTiles: GameState['tiles'] = Array.from({ length: 80 }, () => null)
  return {
    version: 9,
    rows: 10,
    cols: 8,
    tiles: coastTiles,
    credits: 650,
    totalEnergy: 0,
    science: 0,
    upgrades: { ...EMPTY_UPGRADES },
    tick: 0,
    explosions: 0,
    totalFuelSpent: 0,
    totalMaintenanceSpent: 0,
    activeContract: createContract(0, 0),
    contractsCompleted: 0,
    activeSector: 'coast',
    sectorLayouts: { coast: coastTiles, desert: desertTiles },
    prestige: 0,
    selectedKind: 'wind',
    toolMode: 'build',
    paused: false,
    speed: 1,
  }
}

export function adjacentIndices(index: number, rows: number, cols: number): number[] {
  const row = Math.floor(index / cols)
  const col = index % cols
  const adjacent: number[] = []
  if (row > 0) adjacent.push(index - cols)
  if (row < rows - 1) adjacent.push(index + cols)
  if (col > 0) adjacent.push(index - 1)
  if (col < cols - 1) adjacent.push(index + 1)
  return adjacent
}

export function isReactorKind(kind: ComponentKind): boolean {
  return typeof COMPONENTS[kind].fuelCycles === 'number'
}

function makeTile(state: GameState, kind: ComponentKind, index: number): Tile {
  return { id: `${kind}-${state.tick}-${index}`, kind, heat: 0, enabled: true, flow: 0, fuel: fuelCapacity(state, kind), autoRefuel: true, condition: 100, autoMaintain: false, charge: 0 }
}

export function placeTile(state: GameState, index: number, kind: ComponentKind): GameState {
  const definition = COMPONENTS[kind]
  if (index < 0 || index >= state.tiles.length || state.tiles[index] || state.credits < definition.cost || !isComponentUnlocked(state, kind)) return state

  const tiles = [...state.tiles]
  tiles[index] = makeTile(state, kind, index)
  return { ...state, tiles, credits: state.credits - definition.cost }
}

export function isComponentUnlocked(state: GameState, kind: ComponentKind): boolean {
  return state.totalEnergy >= (COMPONENTS[kind].unlockEnergy ?? 0)
}

export function isSectorUnlocked(state: GameState, sector: SectorKey): boolean {
  return sector === 'coast' || state.totalEnergy >= DESERT_UNLOCK_ENERGY
}

export function switchSector(state: GameState, sector: SectorKey): GameState {
  if (sector === state.activeSector || !isSectorUnlocked(state, sector)) return state
  const sectorLayouts = { ...state.sectorLayouts, [state.activeSector]: state.tiles }
  const tiles = sectorLayouts[sector].map((tile) => tile ? { ...tile } : null)
  return { ...state, activeSector: sector, sectorLayouts, tiles }
}

export function reinvestPlant(state: GameState): GameState {
  if (state.totalEnergy < PRESTIGE_UNLOCK_ENERGY) return state
  return { ...createInitialState(), prestige: state.prestige + 1 }
}

export function sellTile(state: GameState, index: number): GameState {
  const tile = state.tiles[index]
  if (!tile) return state
  const tiles = [...state.tiles]
  tiles[index] = null
  const refund = Math.floor(COMPONENTS[tile.kind].cost * SELL_REFUND)
  return { ...state, tiles, credits: state.credits + refund }
}

export function toggleTile(state: GameState, index: number): GameState {
  const tile = state.tiles[index]
  if (!tile) return state
  const tiles = [...state.tiles]
  tiles[index] = { ...tile, enabled: !tile.enabled }
  return { ...state, tiles }
}

export function toggleAutoRefuel(state: GameState, index: number): GameState {
  const tile = state.tiles[index]
  if (!tile || !isReactorKind(tile.kind)) return state
  const tiles = [...state.tiles]
  tiles[index] = { ...tile, autoRefuel: !tile.autoRefuel }
  return { ...state, tiles }
}

export function refuelPrice(state: GameState, index: number): number | null {
  const tile = state.tiles[index]
  if (!tile || !isReactorKind(tile.kind)) return null
  const capacity = fuelCapacity(state, tile.kind)
  if (tile.fuel >= capacity) return 0
  const fullCost = COMPONENTS[tile.kind].refuelCost ?? 0
  return Math.ceil(fullCost * (capacity - tile.fuel) / capacity)
}

export function refuelTile(state: GameState, index: number): GameState {
  const tile = state.tiles[index]
  if (!tile || !isReactorKind(tile.kind)) return state
  const capacity = fuelCapacity(state, tile.kind)
  if (tile.fuel >= capacity) return state
  const cost = refuelPrice(state, index) ?? 0
  if (state.credits < cost) return state
  const tiles = [...state.tiles]
  tiles[index] = { ...tile, fuel: capacity }
  return { ...state, tiles, credits: state.credits - cost, totalFuelSpent: state.totalFuelSpent + cost }
}

export function conditionEfficiency(tile: Tile): number {
  return tile.condition >= 50 ? 1 : 0.5 + tile.condition / 100
}

export function maintenancePrice(state: GameState, index: number): number | null {
  const tile = state.tiles[index]
  if (!tile) return null
  if (tile.condition >= 100) return 0
  return Math.ceil(COMPONENTS[tile.kind].cost * 0.4 * (100 - tile.condition) / 100 * maintenanceCostMultiplier(state))
}

export function maintainTile(state: GameState, index: number): GameState {
  const tile = state.tiles[index]
  if (!tile || tile.condition >= 100) return state
  const cost = maintenancePrice(state, index) ?? 0
  if (state.credits < cost) return state
  const tiles = [...state.tiles]
  tiles[index] = { ...tile, condition: 100 }
  return { ...state, tiles, credits: state.credits - cost, totalMaintenanceSpent: state.totalMaintenanceSpent + cost }
}

export function toggleAutoMaintenance(state: GameState, index: number): GameState {
  const tile = state.tiles[index]
  if (!tile) return state
  const tiles = [...state.tiles]
  tiles[index] = { ...tile, autoMaintain: !tile.autoMaintain }
  return { ...state, tiles }
}

export function restorePlantLayout(state: GameState, tiles: GameState['tiles'], creditAdjustment: number): GameState {
  return {
    ...state,
    tiles,
    credits: Math.max(0, state.credits + creditAdjustment),
  }
}

const REACTORS = new Set<ComponentKind>(['core', 'thorium', 'fusion'])
const DIRECT_GENERATORS = new Set<ComponentKind>(['wind', 'solar'])
const HEAT_CARRIERS = new Set<ComponentKind>(['core', 'thorium', 'fusion', 'exchanger', 'pipe', 'accumulator'])
const TRANSPORTERS = new Set<ComponentKind>(['exchanger', 'pipe', 'accumulator'])

function pullHeat(tiles: Array<Tile | null>, sources: number[], requested: number, destination?: Tile): number {
  let remaining = requested
  let moved = 0
  const ordered = [...sources].sort((a, b) => (tiles[b]?.heat ?? 0) - (tiles[a]?.heat ?? 0))

  for (const sourceIndex of ordered) {
    const source = tiles[sourceIndex]
    if (!source || source.heat <= 0 || remaining <= 0) continue
    const amount = Math.min(source.heat, remaining)
    source.heat -= amount
    source.flow += amount
    remaining -= amount
    moved += amount
  }
  if (destination) destination.flow += moved
  return moved
}

function simulateSectorTick(state: GameState): { state: GameState; report: TickReport } {
  const tiles = state.tiles.map((tile) => (tile ? { ...tile, flow: 0 } : null))
  let credits = state.credits
  let refuelCost = 0
  let maintenanceCost = 0
  let generatedEnergy = 0
  let directEnergy = 0
  let thermalEnergy = 0
  let batteryEnergy = 0
  let storedEnergy = 0

  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index]
    if (!tile || !tile.enabled || !tile.autoMaintain || tile.condition > AUTO_MAINTENANCE_THRESHOLD) continue
    const cost = maintenancePrice({ ...state, tiles }, index) ?? 0
    if (credits < cost) continue
    credits -= cost
    maintenanceCost += cost
    tile.condition = 100
  }

  for (const tile of tiles) {
    if (!tile || !DIRECT_GENERATORS.has(tile.kind) || !tile.enabled) continue
    const produced = (COMPONENTS[tile.kind].directEnergy ?? 0) * renewableMultiplier(state, tile.kind) * conditionEfficiency(tile)
    directEnergy += produced
    tile.flow = produced
  }

  const batteries = tiles.filter((tile): tile is Tile => Boolean(tile && tile.kind === 'battery' && tile.enabled))
  const controllers = tiles.filter((tile) => tile?.kind === 'controller' && tile.enabled).length
  const reserveTarget = controllers * 10
  let availableToStore = controllers > 0 ? Math.max(0, directEnergy - reserveTarget) : directEnergy * 0.25
  for (const battery of batteries) {
    if (availableToStore <= 0) break
    const amount = Math.min(availableToStore, storageRate(state) * conditionEfficiency(battery), storageCapacity(state) - battery.charge)
    battery.charge += amount
    battery.flow = amount
    storedEnergy += amount
    availableToStore -= amount
  }
  directEnergy -= storedEnergy
  generatedEnergy += directEnergy

  let dischargeNeed = controllers > 0 ? Math.max(0, reserveTarget - directEnergy) : directEnergy <= 0 ? Number.POSITIVE_INFINITY : 0
  for (const battery of batteries) {
    if (dischargeNeed <= 0) break
    const amount = Math.min(dischargeNeed, storageRate(state) * conditionEfficiency(battery), battery.charge)
    battery.charge -= amount
    battery.flow = -amount
    batteryEnergy += amount
    dischargeNeed -= amount
  }
  generatedEnergy += batteryEnergy

  for (const tile of tiles) {
    if (!tile || !REACTORS.has(tile.kind) || !tile.enabled) continue
    if (tile.fuel <= 0) {
      const cost = COMPONENTS[tile.kind].refuelCost ?? 0
      if (!tile.autoRefuel || credits < cost) continue
      tile.fuel = fuelCapacity(state, tile.kind)
      credits -= cost
      refuelCost += cost
    }
    tile.heat += (COMPONENTS[tile.kind].production ?? 0) * conditionEfficiency(tile)
    tile.fuel = Math.max(0, tile.fuel - 1)
  }

  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index]
    if (!tile || !tile.enabled || !TRANSPORTERS.has(tile.kind)) continue
    const neighbors = adjacentIndices(index, state.rows, state.cols).filter((neighborIndex) => {
      const neighbor = tiles[neighborIndex]
      return neighbor && HEAT_CARRIERS.has(neighbor.kind) && neighbor.heat > tile.heat
    })
    const capacityLeft = componentCapacity(state, tile.kind) - tile.heat
    const moved = pullHeat(tiles, neighbors, Math.min(transferRate(state, tile.kind as 'exchanger' | 'pipe' | 'accumulator') * conditionEfficiency(tile), capacityLeft), tile)
    tile.heat += moved
  }

  let cooledHeat = 0

  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index]
    if (!tile || tile.kind !== 'generator' || !tile.enabled) continue
    const sources = adjacentIndices(index, state.rows, state.cols).filter((neighborIndex) => {
      const kind = tiles[neighborIndex]?.kind
      return kind ? HEAT_CARRIERS.has(kind) : false
    })
    const converted = pullHeat(tiles, sources, conversionRate(state) * conditionEfficiency(tile), tile)
    thermalEnergy += converted
    generatedEnergy += converted
  }

  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index]
    if (!tile || tile.kind !== 'cooler' || !tile.enabled) continue
    const sources = adjacentIndices(index, state.rows, state.cols).filter((neighborIndex) => {
      const kind = tiles[neighborIndex]?.kind
      return kind ? HEAT_CARRIERS.has(kind) : false
    })
    cooledHeat += pullHeat(tiles, sources, coolingRate(state) * conditionEfficiency(tile), tile)
  }

  let explosions = 0
  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index]
    if (!tile) continue
    if (tile.heat > componentCapacity(state, tile.kind)) {
      tiles[index] = null
      explosions += 1
    }
  }

  for (const tile of tiles) {
    if (!tile || !tile.enabled) continue
    tile.condition = Math.max(0, Math.round((tile.condition - WEAR_PER_CYCLE) * 100) / 100)
  }

  const generatedScience = generatedEnergy * SCIENCE_PER_ENERGY
  const contractGain = state.activeContract.kind === 'renewable' ? directEnergy + storedEnergy : state.activeContract.kind === 'thermal' ? thermalEnergy : generatedEnergy
  const activeContract = {
    ...state.activeContract,
    progress: Math.min(state.activeContract.target, state.activeContract.progress + contractGain),
  }

  return {
    state: {
      ...state,
      tiles,
      credits: credits + generatedEnergy * energyCreditValue(state),
      totalEnergy: state.totalEnergy + generatedEnergy,
      science: state.science + generatedScience,
      tick: state.tick + 1,
      explosions: state.explosions + explosions,
      totalFuelSpent: state.totalFuelSpent + refuelCost,
      totalMaintenanceSpent: state.totalMaintenanceSpent + maintenanceCost,
      activeContract,
      sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: tiles },
    },
    report: { generatedEnergy, generatedScience, cooledHeat, explosions, refuelCost, maintenanceCost, directEnergy, thermalEnergy, batteryEnergy, storedEnergy },
  }
}

function emptyTickReport(): TickReport {
  return { generatedEnergy: 0, generatedScience: 0, cooledHeat: 0, explosions: 0, refuelCost: 0, maintenanceCost: 0, directEnergy: 0, thermalEnergy: 0, batteryEnergy: 0, storedEnergy: 0 }
}

function addTickReports(total: TickReport, report: TickReport): TickReport {
  return {
    generatedEnergy: total.generatedEnergy + report.generatedEnergy,
    generatedScience: total.generatedScience + report.generatedScience,
    cooledHeat: total.cooledHeat + report.cooledHeat,
    explosions: total.explosions + report.explosions,
    refuelCost: total.refuelCost + report.refuelCost,
    maintenanceCost: total.maintenanceCost + report.maintenanceCost,
    directEnergy: total.directEnergy + report.directEnergy,
    thermalEnergy: total.thermalEnergy + report.thermalEnergy,
    batteryEnergy: total.batteryEnergy + report.batteryEnergy,
    storedEnergy: total.storedEnergy + report.storedEnergy,
  }
}

export function simulateTick(state: GameState): { state: GameState; report: TickReport } {
  const originalSector = state.activeSector
  let next: GameState = {
    ...state,
    sectorLayouts: { ...state.sectorLayouts, [originalSector]: state.tiles },
  }
  let report = emptyTickReport()
  const sectors: SectorKey[] = isSectorUnlocked(state, 'desert') ? ['coast', 'desert'] : ['coast']

  for (const sector of sectors) {
    const sectorState = { ...next, activeSector: sector, tiles: next.sectorLayouts[sector] }
    const result = simulateSectorTick(sectorState)
    next = result.state
    report = addTickReports(report, result.report)
  }

  return {
    state: {
      ...next,
      activeSector: originalSector,
      tiles: next.sectorLayouts[originalSector],
      tick: state.tick + 1,
    },
    report,
  }
}

export function claimContract(state: GameState): GameState {
  const contract = state.activeContract
  if (contract.progress < contract.target) return state
  const contractsCompleted = state.contractsCompleted + 1
  const totalEnergy = state.totalEnergy
  return {
    ...state,
    credits: state.credits + contract.rewardCredits,
    science: state.science + contract.rewardScience,
    contractsCompleted,
    activeContract: createContract(contractsCompleted, totalEnergy),
  }
}

export function simulateMany(state: GameState, ticks: number): GameState {
  let next = state
  for (let index = 0; index < ticks; index += 1) next = simulateTick(next).state
  return next
}

export function totalHeat(state: GameState): number {
  return state.tiles.reduce((total, tile) => total + (tile?.heat ?? 0), 0)
}

export function countKind(state: GameState, kind: ComponentKind): number {
  return state.tiles.filter((tile) => tile?.kind === kind).length
}
