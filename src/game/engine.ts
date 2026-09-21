import { COMPONENTS } from './catalog'
import { ECONOMY, EMPTY_TECHS, emptyAutoRebuilds, emptyBuildingLevels, TECHNOLOGIES, TECH_ORDER } from './balance'
import { componentCapacity, componentMultiplier, conversionRate, coolingRate, directEnergyRate, fuelCapacity, productionRate, researchPerFacility, salesPerOffice, storagePerBattery, transferRate } from './research'
import type { ComponentKind, ContractKind, EnergyContract, GameState, SectorKey, TickReport, Tile } from './types'

const REACTORS = new Set<ComponentKind>(['core', 'thorium', 'fusion'])
const DIRECT = new Set<ComponentKind>(['wind', 'solar'])
const LIFETIME_PRODUCERS = new Set<ComponentKind>(['wind', 'solar', 'core', 'thorium', 'fusion'])
const CARRIERS = new Set<ComponentKind>(['core', 'thorium', 'fusion', 'exchanger', 'pipe', 'accumulator'])
const TRANSPORTERS = new Set<ComponentKind>(['exchanger', 'pipe', 'accumulator'])

export function emptyTickReport(): TickReport { return { producedEnergy: 0, directEnergy: 0, thermalEnergy: 0, storedEnergy: 0, wastedEnergy: 0, soldEnergy: 0, earnedCredits: 0, generatedResearch: 0, cooledHeat: 0, incidents: 0, refuelCost: 0, repairCost: 0, storageCapacity: ECONOMY.baseStorage, salesCapacity: ECONOMY.baseSalesRate, conversionCapacity: 0, heatProduction: 0 } }

export function createContract(completed: number, maxResearchReward = Number.POSITIVE_INFINITY): EnergyContract {
  const kinds: ContractKind[] = ['renewable', 'sales', 'research', 'thermal', 'energy']
  const kind = kinds[completed % kinds.length]
  const target = Math.round(20 * Math.pow(1.35, Math.min(completed, 18)))
  const copy: Record<ContractKind, [string, string]> = {
    renewable: ['Impulso renovable', 'Produce energía con eólica o solar.'], sales: ['Demanda comercial', 'Vende energía almacenada.'],
    research: ['Programa científico', 'Genera Research Points con instalaciones de I+D.'], thermal: ['Carga térmica', 'Convierte calor en energía.'], energy: ['Suministro regional', 'Produce energía con cualquier tecnología.'],
  }
  return { id: `${kind}-${completed}`, kind, title: copy[kind][0], description: copy[kind][1], target, progress: 0, rewardCredits: Math.max(5, target * 2), rewardResearch: Math.min(maxResearchReward, Math.max(0.25, Math.round(target * 0.025 * 100) / 100)) }
}

export function createInitialState(): GameState {
  const coast = Array.from({ length: 80 }, () => null) as GameState['tiles']
  const desert = Array.from({ length: 80 }, () => null) as GameState['tiles']
  return { version: 12, rows: 10, cols: 8, tiles: coast, credits: ECONOMY.startingCredits, energyStored: 0, totalEnergy: 0, totalEnergySold: 0, totalCreditsEarned: 0, researchPoints: 0, unlockedTechs: { ...EMPTY_TECHS }, buildingLevels: emptyBuildingLevels(), capacityLevels: emptyBuildingLevels(), autonomyLevels: emptyBuildingLevels(), autoRebuilds: emptyAutoRebuilds(), tick: 0, incidents: 0, totalFuelSpent: 0, totalRepairSpent: 0, activeContract: createContract(0, TECHNOLOGIES.solar.cost * 0.1), contractsCompleted: 0, activeSector: 'coast', sectorLayouts: { coast, desert }, ownedSectors: { coast: true, desert: false }, selectedKind: 'wind', toolMode: 'build', paused: false, speed: 1, lastReport: emptyTickReport() }
}

export function adjacentIndices(index: number, rows: number, cols: number): number[] { const row = Math.floor(index / cols); const col = index % cols; return [row > 0 ? index - cols : -1, row < rows - 1 ? index + cols : -1, col > 0 ? index - 1 : -1, col < cols - 1 ? index + 1 : -1].filter((value) => value >= 0) }
export const isReactorKind = (kind: ComponentKind) => REACTORS.has(kind)
export const usesAutonomy = (kind: ComponentKind) => LIFETIME_PRODUCERS.has(kind)
export function isComponentUnlocked(state: GameState, kind: ComponentKind): boolean { const tech = COMPONENTS[kind].tech; return !tech || state.unlockedTechs[tech] }
export function isComponentVisible(state: GameState, kind: ComponentKind): boolean { if (kind === 'sales') return state.totalEnergySold >= 5 || state.lastReport.wastedEnergy > 0; if (kind === 'research') return state.totalCreditsEarned >= 50; return kind === 'wind' || Boolean(COMPONENTS[kind].tech) }
export const isSectorUnlocked = (state: GameState, sector: SectorKey) => state.ownedSectors[sector]

function makeTile(state: GameState, kind: ComponentKind, index: number): Tile { return { id: `${kind}-${state.tick}-${index}`, kind, heat: 0, enabled: true, damaged: false, flow: 0, fuel: fuelCapacity(state, kind), autoRefuel: false } }
export function placeTile(state: GameState, index: number, kind: ComponentKind): GameState {
  const definition = COMPONENTS[kind]
  if (index < 0 || index >= state.tiles.length || state.credits < definition.cost || !isComponentUnlocked(state, kind)) return state
  const existing = state.tiles[index]
  if (existing) return existing.kind === kind && usesAutonomy(kind) && existing.fuel <= 0 ? refuelTile(state, index) : state
  const tiles = [...state.tiles]; tiles[index] = makeTile(state, kind, index)
  return { ...state, tiles, credits: state.credits - definition.cost, sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: tiles } }
}
export function demolitionRefund(kind: ComponentKind): number { return usesAutonomy(kind) ? 0 : Math.floor(COMPONENTS[kind].cost * ECONOMY.sellRefund) }
export function sellTile(state: GameState, index: number): GameState { const tile = state.tiles[index]; if (!tile) return state; const tiles = [...state.tiles]; tiles[index] = null; return { ...state, tiles, credits: state.credits + demolitionRefund(tile.kind), sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: tiles } } }
export function toggleTile(state: GameState, index: number): GameState { const tile = state.tiles[index]; if (!tile || tile.damaged) return state; const tiles = [...state.tiles]; tiles[index] = { ...tile, enabled: !tile.enabled }; return { ...state, tiles, sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: tiles } } }
export function refuelPrice(state: GameState, index: number): number | null { const tile = state.tiles[index]; if (!tile || !usesAutonomy(tile.kind)) return null; return tile.fuel <= 0 ? COMPONENTS[tile.kind].refuelCost ?? COMPONENTS[tile.kind].cost : 0 }
export function refuelTile(state: GameState, index: number): GameState { const tile = state.tiles[index]; if (!tile || !usesAutonomy(tile.kind)) return state; const price = refuelPrice(state, index) ?? 0; if (price <= 0 || state.credits < price) return state; const tiles = [...state.tiles]; tiles[index] = { ...tile, fuel: fuelCapacity(state, tile.kind) }; return { ...state, tiles, credits: state.credits - price, totalFuelSpent: state.totalFuelSpent + price, sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: tiles } } }
export function repairPrice(state: GameState, index: number): number | null { const tile = state.tiles[index]; return tile?.damaged ? Math.ceil(COMPONENTS[tile.kind].cost * ECONOMY.repairRate) : tile ? 0 : null }
export function repairTile(state: GameState, index: number): GameState { const tile = state.tiles[index]; const price = repairPrice(state, index); if (!tile || !price || state.credits < price) return state; const tiles = [...state.tiles]; tiles[index] = { ...tile, damaged: false, enabled: true, heat: 0 }; return { ...state, tiles, credits: state.credits - price, totalRepairSpent: state.totalRepairSpent + price, sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: tiles } } }
export function restorePlantLayout(state: GameState, tiles: GameState['tiles'], creditAdjustment: number): GameState { return { ...state, tiles, credits: Math.max(0, state.credits + creditAdjustment), sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: tiles } } }
export function switchSector(state: GameState, sector: SectorKey): GameState { if (sector === state.activeSector || !isSectorUnlocked(state, sector)) return state; const sectorLayouts = { ...state.sectorLayouts, [state.activeSector]: state.tiles }; return { ...state, activeSector: sector, sectorLayouts, tiles: sectorLayouts[sector].map((tile) => tile ? { ...tile } : null) } }
export function buyDesertSector(state: GameState): GameState { if (state.ownedSectors.desert || !state.unlockedTechs.expansion || state.credits < ECONOMY.secondIslandCost) return state; return { ...state, credits: state.credits - ECONOMY.secondIslandCost, ownedSectors: { ...state.ownedSectors, desert: true } } }

function pullHeat(tiles: Array<Tile | null>, sources: number[], requested: number, destination?: Tile): number { let remaining = requested; let moved = 0; for (const sourceIndex of [...sources].sort((a, b) => (tiles[b]?.heat ?? 0) - (tiles[a]?.heat ?? 0))) { const source = tiles[sourceIndex]; if (!source || source.heat <= 0 || remaining <= 0) continue; const amount = Math.min(source.heat, remaining); source.heat -= amount; source.flow += amount; remaining -= amount; moved += amount } if (destination) destination.flow += moved; return moved }

interface SectorResult { tiles: GameState['tiles']; directEnergy: number; thermalEnergy: number; research: number; cooledHeat: number; incidents: number; refuelCost: number; heatProduction: number; conversionCapacity: number; credits: number }
function simulateSector(state: GameState, tilesInput: GameState['tiles'], creditsInput: number): SectorResult {
  const tiles = tilesInput.map((tile) => tile ? { ...tile, flow: 0 } : null); let credits = creditsInput; let directEnergy = 0; let thermalEnergy = 0; let research = 0; let cooledHeat = 0; let incidents = 0; let refuelCost = 0; let heatProduction = 0; let conversionCapacity = 0
  for (const tile of tiles) { if (!tile || !tile.enabled || tile.damaged) continue; if (DIRECT.has(tile.kind)) { if (tile.fuel <= 0) { const price = COMPONENTS[tile.kind].refuelCost ?? COMPONENTS[tile.kind].cost; if (!state.autoRebuilds[tile.kind] || credits < price) continue; tile.fuel = fuelCapacity(state, tile.kind); credits -= price; refuelCost += price } const amount = directEnergyRate(state, tile.kind); directEnergy += amount; tile.flow = amount; tile.fuel = Math.max(0, tile.fuel - 1) } if (tile.kind === 'research') research += researchPerFacility(state) }
  for (const tile of tiles) { if (!tile || !tile.enabled || tile.damaged || !REACTORS.has(tile.kind)) continue; if (tile.fuel <= 0) { const price = COMPONENTS[tile.kind].refuelCost ?? COMPONENTS[tile.kind].cost; if (!state.autoRebuilds[tile.kind] || credits < price) continue; tile.fuel = fuelCapacity(state, tile.kind); credits -= price; refuelCost += price } const amount = productionRate(state, tile.kind); tile.heat += amount; tile.fuel = Math.max(0, tile.fuel - 1); heatProduction += amount }
  for (let index = 0; index < tiles.length; index += 1) { const tile = tiles[index]; if (!tile || !tile.enabled || tile.damaged || !TRANSPORTERS.has(tile.kind)) continue; const neighbors = adjacentIndices(index, state.rows, state.cols).filter((i) => tiles[i] && CARRIERS.has(tiles[i]!.kind) && tiles[i]!.heat > tile.heat); const moved = pullHeat(tiles, neighbors, Math.min(transferRate(state, tile.kind as 'exchanger' | 'pipe' | 'accumulator'), componentCapacity(state, tile.kind) - tile.heat), tile); tile.heat += moved }
  for (let index = 0; index < tiles.length; index += 1) { const tile = tiles[index]; if (!tile || tile.kind !== 'generator' || !tile.enabled || tile.damaged) continue; const rate = conversionRate(state); conversionCapacity += rate; const sources = adjacentIndices(index, state.rows, state.cols).filter((i) => tiles[i] && CARRIERS.has(tiles[i]!.kind)); thermalEnergy += pullHeat(tiles, sources, rate, tile) }
  for (let index = 0; index < tiles.length; index += 1) { const tile = tiles[index]; if (!tile || tile.kind !== 'cooler' || !tile.enabled || tile.damaged) continue; const sources = adjacentIndices(index, state.rows, state.cols).filter((i) => tiles[i] && CARRIERS.has(tiles[i]!.kind)); cooledHeat += pullHeat(tiles, sources, coolingRate(state), tile) }
  for (const tile of tiles) { if (!tile || tile.damaged || componentCapacity(state, tile.kind) <= 0) continue; if (tile.heat > componentCapacity(state, tile.kind)) { tile.heat = componentCapacity(state, tile.kind); tile.damaged = true; tile.enabled = false; incidents += 1 } }
  return { tiles, directEnergy, thermalEnergy, research, cooledHeat, incidents, refuelCost, heatProduction, conversionCapacity, credits }
}

function allOwnedTiles(state: GameState): Tile[] { return (Object.keys(state.ownedSectors) as SectorKey[]).filter((key) => state.ownedSectors[key]).flatMap((key) => state.sectorLayouts[key]).filter((tile): tile is Tile => Boolean(tile)) }
export function controllerMultiplier(state: GameState): number { const count = allOwnedTiles(state).filter((tile) => tile.kind === 'controller' && tile.enabled && !tile.damaged).length; const per = (COMPONENTS.controller.controllerBonus ?? 0) * componentMultiplier(state, 'controller'); return 1 + Math.min(0.5, count * per) }
export function globalStorageCapacity(state: GameState): number { const batteries = allOwnedTiles(state).filter((tile) => tile.kind === 'battery' && tile.enabled && !tile.damaged).length; return (ECONOMY.baseStorage + batteries * storagePerBattery(state)) * controllerMultiplier(state) }
export function globalSalesCapacity(state: GameState): number { const offices = allOwnedTiles(state).filter((tile) => tile.kind === 'sales' && tile.enabled && !tile.damaged).length; return (ECONOMY.baseSalesRate + offices * salesPerOffice(state)) * controllerMultiplier(state) }

export function sellStoredEnergy(state: GameState): GameState {
  const sold = Math.max(0, state.energyStored)
  if (sold <= 0) return state
  const earned = sold * ECONOMY.energyPrice
  const activeContract = state.activeContract.kind === 'sales' ? { ...state.activeContract, progress: Math.min(state.activeContract.target, state.activeContract.progress + sold) } : state.activeContract
  return { ...state, energyStored: 0, credits: state.credits + earned, totalEnergySold: state.totalEnergySold + sold, totalCreditsEarned: state.totalCreditsEarned + earned, activeContract, lastReport: { ...state.lastReport, soldEnergy: state.lastReport.soldEnergy + sold, earnedCredits: state.lastReport.earnedCredits + earned } }
}

export function simulateTick(state: GameState): { state: GameState; report: TickReport } {
  const currentLayouts = { ...state.sectorLayouts, [state.activeSector]: state.tiles }; let credits = state.credits; let aggregate = emptyTickReport(); const layouts = { ...currentLayouts }
  for (const sector of (['coast', 'desert'] as SectorKey[])) { if (!state.ownedSectors[sector]) continue; const result = simulateSector({ ...state, activeSector: sector }, layouts[sector], credits); layouts[sector] = result.tiles; credits = result.credits; aggregate.directEnergy += result.directEnergy; aggregate.thermalEnergy += result.thermalEnergy; aggregate.generatedResearch += result.research; aggregate.cooledHeat += result.cooledHeat; aggregate.incidents += result.incidents; aggregate.refuelCost += result.refuelCost; aggregate.heatProduction += result.heatProduction; aggregate.conversionCapacity += result.conversionCapacity }
  const interim = { ...state, sectorLayouts: layouts, tiles: layouts[state.activeSector] }; const produced = aggregate.directEnergy + aggregate.thermalEnergy; const storageCapacity = globalStorageCapacity(interim); const salesCapacity = globalSalesCapacity(interim); const available = state.energyStored + produced; const storable = Math.min(storageCapacity, available); const wasted = Math.max(0, available - storageCapacity); const sold = Math.min(storable, salesCapacity); const energyStored = storable - sold; const earned = sold * ECONOMY.energyPrice
  aggregate = { ...aggregate, producedEnergy: produced, storedEnergy: Math.min(produced, Math.max(0, storageCapacity - state.energyStored)), wastedEnergy: wasted, soldEnergy: sold, earnedCredits: earned, storageCapacity, salesCapacity }
  const gain = state.activeContract.kind === 'renewable' ? aggregate.directEnergy : state.activeContract.kind === 'thermal' ? aggregate.thermalEnergy : state.activeContract.kind === 'sales' ? sold : state.activeContract.kind === 'research' ? aggregate.generatedResearch : produced
  const activeContract = { ...state.activeContract, progress: Math.min(state.activeContract.target, state.activeContract.progress + gain) }
  const next: GameState = { ...state, tiles: layouts[state.activeSector], sectorLayouts: layouts, credits: credits + earned, energyStored, totalEnergy: state.totalEnergy + produced, totalEnergySold: state.totalEnergySold + sold, totalCreditsEarned: state.totalCreditsEarned + earned, researchPoints: state.researchPoints + aggregate.generatedResearch, tick: state.tick + 1, incidents: state.incidents + aggregate.incidents, totalFuelSpent: state.totalFuelSpent + aggregate.refuelCost, activeContract, lastReport: aggregate }
  return { state: next, report: aggregate }
}
export function simulateMany(state: GameState, ticks: number): GameState { let next = state; for (let i = 0; i < ticks; i += 1) next = simulateTick(next).state; return next }
export function claimContract(state: GameState): GameState { if (state.activeContract.progress < state.activeContract.target) return state; const completed = state.contractsCompleted + 1; const nextTech = TECH_ORDER.find((key) => !state.unlockedTechs[key]); const cap = nextTech ? TECHNOLOGIES[nextTech].cost * 0.1 : Number.POSITIVE_INFINITY; const rewardResearch = Math.min(state.activeContract.rewardResearch, cap); return { ...state, credits: state.credits + state.activeContract.rewardCredits, researchPoints: state.researchPoints + rewardResearch, contractsCompleted: completed, activeContract: createContract(completed, cap) } }
export function totalHeat(state: GameState): number { return state.tiles.reduce((sum, tile) => sum + (tile?.heat ?? 0), 0) }
export function countKind(state: GameState, kind: ComponentKind): number { return allOwnedTiles({ ...state, sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: state.tiles } }).filter((tile) => tile.kind === kind).length }
