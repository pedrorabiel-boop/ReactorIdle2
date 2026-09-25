import { COMPONENTS } from './catalog'
import { ECONOMY, EMPTY_TECHS, emptyAutoRebuilds, emptyBuildingLevels, TECHNOLOGIES, TECH_ORDER } from './balance'
import { applyDebugSettings, canAfford, createDefaultDebugSettings, hasInfiniteMoney, normalizeDebugSettings, spendCredits } from './debug'
import { componentCapacity, componentMultiplier, conversionRate, coolingRate, directEnergyRate, fuelCapacity, productionRate, researchPerFacility, salesPerOffice, storagePerBattery, thermalResistance, thermalTransferRate } from './research'
import { absorbHeatIntoSinks, diffuseThermalNetwork, drainHeatByResistance, getThermalTopology, isThermalCarrier, pullHeatForConversion, pumpHeatThroughActivePipes, type ThermalSinkEdge } from './thermal'
import type { ComponentKind, ContractKind, EnergyContract, GameState, SectorEconomy, SectorKey, TickReport, Tile } from './types'

const REACTORS = new Set<ComponentKind>(['core', 'thorium', 'fusion'])
const CONVERTERS = new Set<ComponentKind>(['generator', 'generator2'])
const DIRECT = new Set<ComponentKind>(['wind', 'solar'])
const LIFETIME_PRODUCERS = new Set<ComponentKind>(['wind', 'solar', 'core', 'thorium', 'fusion'])

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

export function createInitialState(debugInput = createDefaultDebugSettings()): GameState {
  const debug = normalizeDebugSettings(debugInput)
  applyDebugSettings(debug)
  const coast = Array.from({ length: 80 }, () => null) as GameState['tiles']
  const desert = Array.from({ length: 80 }, () => null) as GameState['tiles']
  const makeEconomy = (): SectorEconomy => ({ energyStored: 0, buildingLevels: emptyBuildingLevels(), capacityLevels: emptyBuildingLevels(), autonomyLevels: emptyBuildingLevels() })
  return { version: 17, rows: 10, cols: 8, tiles: coast, credits: ECONOMY.startingCredits, totalEnergy: 0, totalEnergySold: 0, totalCreditsEarned: 0, researchPoints: 0, unlockedTechs: { ...EMPTY_TECHS }, autoRebuilds: emptyAutoRebuilds(), tick: 0, incidents: 0, totalFuelSpent: 0, totalRepairSpent: 0, activeContract: createContract(0, TECHNOLOGIES.solar.cost * 0.1), contractsCompleted: 0, activeSector: 'coast', sectorLayouts: { coast, desert }, sectorEconomies: { coast: makeEconomy(), desert: makeEconomy() }, sectorReports: { coast: emptyTickReport(), desert: emptyTickReport() }, ownedSectors: { coast: true, desert: false }, selectedKind: 'wind', toolMode: 'build', paused: false, speed: 1, lastReport: emptyTickReport(), debug }
}

export function adjacentIndices(index: number, rows: number, cols: number): number[] { const row = Math.floor(index / cols); const col = index % cols; return [row > 0 ? index - cols : -1, row < rows - 1 ? index + cols : -1, col > 0 ? index - 1 : -1, col < cols - 1 ? index + 1 : -1].filter((value) => value >= 0) }
export const isReactorKind = (kind: ComponentKind) => REACTORS.has(kind)
export const usesAutonomy = (kind: ComponentKind) => LIFETIME_PRODUCERS.has(kind)
export function isComponentUnlocked(state: GameState, kind: ComponentKind): boolean { if (state.debug.enabled && state.debug.unlockAllBuildings) return true; const tech = COMPONENTS[kind].tech; return !tech || state.unlockedTechs[tech] }
export function isComponentVisible(state: GameState, kind: ComponentKind): boolean { if (state.debug.enabled && state.debug.unlockAllBuildings) return true; if (kind === 'sales') return state.totalEnergySold >= 5 || state.lastReport.wastedEnergy > 0; if (kind === 'research') return state.totalCreditsEarned >= 50; return kind === 'wind' || Boolean(COMPONENTS[kind].tech) }
export const isSectorUnlocked = (state: GameState, sector: SectorKey) => state.ownedSectors[sector]

function makeTile(state: GameState, kind: ComponentKind, index: number): Tile { return { id: `${kind}-${state.tick}-${index}`, kind, heat: 0, enabled: true, damaged: false, flow: 0, fuel: fuelCapacity(state, kind), autoRefuel: false } }
export function placeTile(state: GameState, index: number, kind: ComponentKind): GameState {
  const definition = COMPONENTS[kind]
  if (index < 0 || index >= state.tiles.length || !canAfford(state, definition.cost) || !isComponentUnlocked(state, kind)) return state
  const existing = state.tiles[index]
  if (existing) return existing.kind === kind && usesAutonomy(kind) && existing.fuel <= 0 ? refuelTile(state, index) : state
  const tiles = [...state.tiles]; tiles[index] = makeTile(state, kind, index)
  return { ...state, tiles, credits: spendCredits(state, definition.cost), sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: tiles } }
}
export function demolitionRefund(kind: ComponentKind): number { return usesAutonomy(kind) ? 0 : Math.floor(COMPONENTS[kind].cost * ECONOMY.sellRefund) }
export function sellTile(state: GameState, index: number): GameState { const tile = state.tiles[index]; if (!tile) return state; const tiles = [...state.tiles]; tiles[index] = null; return { ...state, tiles, credits: state.credits + demolitionRefund(tile.kind), sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: tiles } } }
export function toggleTile(state: GameState, index: number): GameState { const tile = state.tiles[index]; if (!tile || tile.damaged) return state; const tiles = [...state.tiles]; tiles[index] = { ...tile, enabled: !tile.enabled }; return { ...state, tiles, sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: tiles } } }
export function refuelPrice(state: GameState, index: number): number | null { const tile = state.tiles[index]; if (!tile || !usesAutonomy(tile.kind)) return null; return tile.fuel <= 0 ? COMPONENTS[tile.kind].refuelCost ?? COMPONENTS[tile.kind].cost : 0 }
export function refuelTile(state: GameState, index: number): GameState { const tile = state.tiles[index]; if (!tile || !usesAutonomy(tile.kind)) return state; const price = refuelPrice(state, index) ?? 0; if (price <= 0 || !canAfford(state, price)) return state; const tiles = [...state.tiles]; tiles[index] = { ...tile, id: `${tile.kind}-${state.tick}-${index}-manual`, fuel: fuelCapacity(state, tile.kind) }; return { ...state, tiles, credits: spendCredits(state, price), totalFuelSpent: state.totalFuelSpent + price, sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: tiles } } }
export function repairPrice(state: GameState, index: number): number | null { const tile = state.tiles[index]; return tile?.damaged ? Math.ceil(COMPONENTS[tile.kind].cost * ECONOMY.repairRate) : tile ? 0 : null }
export function repairTile(state: GameState, index: number): GameState { const tile = state.tiles[index]; const price = repairPrice(state, index); if (!tile || !price || !canAfford(state, price)) return state; const tiles = [...state.tiles]; tiles[index] = { ...tile, damaged: false, enabled: true, heat: 0 }; return { ...state, tiles, credits: spendCredits(state, price), totalRepairSpent: state.totalRepairSpent + price, sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: tiles } } }
export function restorePlantLayout(state: GameState, tiles: GameState['tiles'], creditAdjustment: number): GameState { return { ...state, tiles, credits: hasInfiniteMoney(state) ? state.credits : Math.max(0, state.credits + creditAdjustment), sectorLayouts: { ...state.sectorLayouts, [state.activeSector]: tiles } } }
export function switchSector(state: GameState, sector: SectorKey): GameState { if (sector === state.activeSector || !isSectorUnlocked(state, sector)) return state; const sectorLayouts = { ...state.sectorLayouts, [state.activeSector]: state.tiles }; return { ...state, activeSector: sector, sectorLayouts, tiles: sectorLayouts[sector].map((tile) => tile ? { ...tile } : null), lastReport: state.sectorReports[sector] } }
export function buyDesertSector(state: GameState): GameState { if (state.ownedSectors.desert || !state.unlockedTechs.expansion || !canAfford(state, ECONOMY.secondIslandCost)) return state; return { ...state, credits: spendCredits(state, ECONOMY.secondIslandCost), ownedSectors: { ...state.ownedSectors, desert: true } } }

interface SectorResult { tiles: GameState['tiles']; directEnergy: number; thermalEnergy: number; research: number; cooledHeat: number; incidents: number; refuelCost: number; heatProduction: number; conversionCapacity: number; credits: number }
function simulateSector(state: GameState, tilesInput: GameState['tiles'], creditsInput: number): SectorResult {
  const tiles = tilesInput.map((tile) => tile ? { ...tile, flow: 0 } : null); let credits = creditsInput; let directEnergy = 0; let thermalEnergy = 0; let research = 0; let cooledHeat = 0; let incidents = 0; let refuelCost = 0; let heatProduction = 0; let conversionCapacity = 0
  for (const tile of tiles) { if (!tile || !tile.enabled || tile.damaged) continue; if (DIRECT.has(tile.kind)) { if (tile.fuel <= 0) { const price = COMPONENTS[tile.kind].refuelCost ?? COMPONENTS[tile.kind].cost; if (!state.autoRebuilds[tile.kind] || (!hasInfiniteMoney(state) && credits < price)) continue; tile.id = `${tile.kind}-${state.tick}-auto`; tile.fuel = fuelCapacity(state, tile.kind); if (!hasInfiniteMoney(state)) credits -= price; refuelCost += price } const amount = directEnergyRate(state, tile.kind); directEnergy += amount; tile.flow = amount; tile.fuel = Math.max(0, tile.fuel - 1) } if (tile.kind === 'research' || tile.kind === 'research2') research += researchPerFacility(state, tile.kind) }
  for (const tile of tiles) { if (!tile || !tile.enabled || tile.damaged || !REACTORS.has(tile.kind)) continue; if (tile.fuel <= 0) { const price = COMPONENTS[tile.kind].refuelCost ?? COMPONENTS[tile.kind].cost; if (!state.autoRebuilds[tile.kind] || (!hasInfiniteMoney(state) && credits < price)) continue; tile.id = `${tile.kind}-${state.tick}-auto`; tile.fuel = fuelCapacity(state, tile.kind); if (!hasInfiniteMoney(state)) credits -= price; refuelCost += price } const amount = productionRate(state, tile.kind); tile.heat += amount; tile.fuel = Math.max(0, tile.fuel - 1); heatProduction += amount }
  const capacityAt = (index: number) => { const tile = tiles[index]; return tile ? componentCapacity(state, tile.kind) : 0 }
  const resistanceAt = (index: number) => { const tile = tiles[index]; return tile ? thermalResistance(state, tile.kind) : Number.POSITIVE_INFINITY }
  diffuseThermalNetwork(tiles, getThermalTopology(tiles, state.rows, state.cols), capacityAt, resistanceAt)
  const generatorEdges: ThermalSinkEdge[] = []
  for (let index = 0; index < tiles.length; index += 1) { const tile = tiles[index]; if (!tile || !CONVERTERS.has(tile.kind) || !tile.enabled || tile.damaged) continue; for (const source of adjacentIndices(index, state.rows, state.cols)) if (isThermalCarrier(tiles[source]) && tiles[source]?.kind !== 'pipe2') generatorEdges.push({ source, sink: index }) }
  const conversionDemand = new Map<number, number>()
  for (let index = 0; index < tiles.length; index += 1) { const tile = tiles[index]; if (!tile || !CONVERTERS.has(tile.kind) || !tile.enabled || tile.damaged) continue; const rate = conversionRate(state, tile.kind as 'generator' | 'generator2'); conversionCapacity += rate; const stored = Math.min(tile.heat, rate); tile.heat -= stored; thermalEnergy += stored; conversionDemand.set(index, rate - stored) }
  const pumped = pumpHeatThroughActivePipes(tiles, state.rows, state.cols, (index) => conversionDemand.get(index) ?? 0, capacityAt, () => thermalTransferRate(state, 'pipe2'))
  thermalEnergy += pumped.totalMoved
  for (const [index, amount] of pumped.received) conversionDemand.set(index, Math.max(0, (conversionDemand.get(index) ?? 0) - amount))
  const pulled = pullHeatForConversion(tiles, generatorEdges, (index) => conversionDemand.get(index) ?? 0)
  thermalEnergy += pulled.totalMoved
  absorbHeatIntoSinks(tiles, generatorEdges, capacityAt, resistanceAt)
  for (let index = 0; index < tiles.length; index += 1) { const tile = tiles[index]; if (!tile || tile.kind !== 'cooler' || !tile.enabled || tile.damaged) continue; const sources = adjacentIndices(index, state.rows, state.cols).filter((i) => isThermalCarrier(tiles[i])); const moved = drainHeatByResistance(tiles, sources, coolingRate(state), capacityAt, resistanceAt); cooledHeat += moved; tile.flow += moved }
  for (const tile of tiles) { if (!tile || tile.damaged || componentCapacity(state, tile.kind) <= 0) continue; if (tile.heat > componentCapacity(state, tile.kind)) { tile.damaged = true; tile.enabled = false; incidents += 1 } }
  return { tiles, directEnergy, thermalEnergy, research, cooledHeat, incidents, refuelCost, heatProduction, conversionCapacity, credits }
}

function tilesForSector(state: GameState, sector: SectorKey): Array<Tile | null> { return sector === state.activeSector ? state.tiles : state.sectorLayouts[sector] }
export function sectorEnergyStored(state: GameState, sector: SectorKey = state.activeSector): number { return state.sectorEconomies[sector].energyStored }
export function controllerMultiplier(state: GameState, sector: SectorKey = state.activeSector): number { const scoped = { ...state, activeSector: sector }; const count = tilesForSector(state, sector).filter((tile) => tile?.kind === 'controller' && tile.enabled && !tile.damaged).length; const per = (COMPONENTS.controller.controllerBonus ?? 0) * componentMultiplier(scoped, 'controller'); return 1 + Math.min(0.5, count * per) }
export function sectorStorageCapacity(state: GameState, sector: SectorKey = state.activeSector): number { const scoped = { ...state, activeSector: sector }; const batteries = tilesForSector(state, sector).filter((tile) => tile?.kind === 'battery' && tile.enabled && !tile.damaged).length; return (ECONOMY.baseStorage + batteries * storagePerBattery(scoped)) * controllerMultiplier(state, sector) }
export function sectorSalesCapacity(state: GameState, sector: SectorKey = state.activeSector): number { const scoped = { ...state, activeSector: sector }; const officeCapacity = tilesForSector(state, sector).reduce((sum, tile) => tile && (tile.kind === 'sales' || tile.kind === 'sales2') && tile.enabled && !tile.damaged ? sum + salesPerOffice(scoped, tile.kind) : sum, 0); return (ECONOMY.baseSalesRate + officeCapacity) * controllerMultiplier(state, sector) }
/** Alias conservado para integraciones antiguas; la capacidad ahora pertenece solo al mapa activo. */
export const globalStorageCapacity = sectorStorageCapacity
/** Alias conservado para integraciones antiguas; la capacidad ahora pertenece solo al mapa activo. */
export const globalSalesCapacity = sectorSalesCapacity

export function sellStoredEnergy(state: GameState): GameState {
  const sectorEconomy = state.sectorEconomies[state.activeSector]
  const sold = Math.max(0, sectorEconomy.energyStored)
  if (sold <= 0) return state
  const earned = sold * ECONOMY.energyPrice
  const activeContract = state.activeContract.kind === 'sales' ? { ...state.activeContract, progress: Math.min(state.activeContract.target, state.activeContract.progress + sold) } : state.activeContract
  const lastReport = { ...state.lastReport, soldEnergy: state.lastReport.soldEnergy + sold, earnedCredits: state.lastReport.earnedCredits + earned }
  return { ...state, sectorEconomies: { ...state.sectorEconomies, [state.activeSector]: { ...sectorEconomy, energyStored: 0 } }, credits: state.credits + earned, totalEnergySold: state.totalEnergySold + sold, totalCreditsEarned: state.totalCreditsEarned + earned, activeContract, lastReport, sectorReports: { ...state.sectorReports, [state.activeSector]: lastReport } }
}

export function simulateTick(state: GameState): { state: GameState; report: TickReport } {
  const currentLayouts = { ...state.sectorLayouts, [state.activeSector]: state.tiles }; let credits = state.credits; let aggregate = emptyTickReport(); const layouts = { ...currentLayouts }; const sectorEconomies = { ...state.sectorEconomies }; const sectorReports = { ...state.sectorReports }
  for (const sector of (['coast', 'desert'] as SectorKey[])) {
    if (!state.ownedSectors[sector]) continue
    const scopedState = { ...state, activeSector: sector, tiles: layouts[sector], sectorLayouts: layouts, sectorEconomies }
    const result = simulateSector(scopedState, layouts[sector], credits); layouts[sector] = result.tiles; credits = result.credits
    const interim = { ...scopedState, tiles: result.tiles, sectorLayouts: { ...layouts, [sector]: result.tiles } }
    const produced = result.directEnergy + result.thermalEnergy
    const storageCapacity = sectorStorageCapacity(interim, sector); const salesCapacity = sectorSalesCapacity(interim, sector)
    const available = sectorEconomies[sector].energyStored + produced
    // Las oficinas venden primero. Solo la energía que supera su potencia de venta intenta entrar al banco local.
    const sold = Math.min(available, salesCapacity); const unsold = available - sold
    const energyStored = Math.min(storageCapacity, unsold); const wasted = Math.max(0, unsold - storageCapacity); const earned = sold * ECONOMY.energyPrice
    const report: TickReport = { producedEnergy: produced, directEnergy: result.directEnergy, thermalEnergy: result.thermalEnergy, storedEnergy: Math.max(0, energyStored - sectorEconomies[sector].energyStored), wastedEnergy: wasted, soldEnergy: sold, earnedCredits: earned, generatedResearch: result.research, cooledHeat: result.cooledHeat, incidents: result.incidents, refuelCost: result.refuelCost, repairCost: 0, storageCapacity, salesCapacity, conversionCapacity: result.conversionCapacity, heatProduction: result.heatProduction }
    sectorEconomies[sector] = { ...sectorEconomies[sector], energyStored }; sectorReports[sector] = report; credits += earned
    for (const key of Object.keys(aggregate) as Array<keyof TickReport>) aggregate[key] += report[key]
  }
  const produced = aggregate.producedEnergy; const sold = aggregate.soldEnergy; const earned = aggregate.earnedCredits
  const gain = state.activeContract.kind === 'renewable' ? aggregate.directEnergy : state.activeContract.kind === 'thermal' ? aggregate.thermalEnergy : state.activeContract.kind === 'sales' ? sold : state.activeContract.kind === 'research' ? aggregate.generatedResearch : produced
  const activeContract = { ...state.activeContract, progress: Math.min(state.activeContract.target, state.activeContract.progress + gain) }
  const next: GameState = { ...state, tiles: layouts[state.activeSector], sectorLayouts: layouts, sectorEconomies, sectorReports, credits, totalEnergy: state.totalEnergy + produced, totalEnergySold: state.totalEnergySold + sold, totalCreditsEarned: state.totalCreditsEarned + earned, researchPoints: state.researchPoints + aggregate.generatedResearch, tick: state.tick + 1, incidents: state.incidents + aggregate.incidents, totalFuelSpent: state.totalFuelSpent + aggregate.refuelCost, activeContract, lastReport: sectorReports[state.activeSector] }
  return { state: next, report: aggregate }
}
export function simulateMany(state: GameState, ticks: number): GameState { let next = state; for (let i = 0; i < ticks; i += 1) next = simulateTick(next).state; return next }
export function claimContract(state: GameState): GameState { if (state.activeContract.progress < state.activeContract.target) return state; const completed = state.contractsCompleted + 1; const nextTech = TECH_ORDER.find((key) => !state.unlockedTechs[key]); const cap = nextTech ? TECHNOLOGIES[nextTech].cost * 0.1 : Number.POSITIVE_INFINITY; const rewardResearch = Math.min(state.activeContract.rewardResearch, cap); return { ...state, credits: state.credits + state.activeContract.rewardCredits, researchPoints: state.researchPoints + rewardResearch, contractsCompleted: completed, activeContract: createContract(completed, cap) } }
export function totalHeat(state: GameState): number { return state.tiles.reduce((sum, tile) => sum + (tile?.heat ?? 0), 0) }
export function countKind(state: GameState, kind: ComponentKind): number { return state.tiles.filter((tile) => tile?.kind === kind).length }
