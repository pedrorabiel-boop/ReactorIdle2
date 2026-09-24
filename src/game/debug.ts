import { AUTO_REBUILD_COSTS, COMPONENT_ORDER, ECONOMY, LIFETIME_ORDER, TECH_ORDER, TECHNOLOGIES, UPGRADE_BASE_COSTS } from './balance'
import { COMPONENTS } from './catalog'
import type { ComponentDefinition, ComponentKind, ComponentNumericKey, DebugEconomyKey, DebugSettings, GameState, TechKey, UpgradeTrack } from './types'

export const COMPONENT_NUMERIC_FIELDS: Array<{ key: ComponentNumericKey; label: string }> = [
  { key: 'cost', label: 'Costo de construcción' },
  { key: 'capacity', label: 'Capacidad térmica' },
  { key: 'directEnergy', label: 'Energía directa / s' },
  { key: 'production', label: 'Calor generado / s' },
  { key: 'referenceTransferRate', label: 'Caudal térmico / s' },
  { key: 'thermalResistance', label: 'Resistencia térmica' },
  { key: 'conversionRate', label: 'Conversión / s' },
  { key: 'coolingRate', label: 'Enfriamiento / s' },
  { key: 'fuelCycles', label: 'Vida útil / s' },
  { key: 'refuelCost', label: 'Costo de reconstrucción' },
  { key: 'storageCapacity', label: 'Almacenamiento' },
  { key: 'salesRate', label: 'Venta / s' },
  { key: 'researchRate', label: 'RP / s' },
  { key: 'controllerBonus', label: 'Bono del controlador' },
]

export const ECONOMY_DEBUG_FIELDS: Array<{ key: DebugEconomyKey; label: string; step?: number }> = [
  { key: 'baseStorage', label: 'Banco base' },
  { key: 'baseSalesRate', label: 'Venta base / s' },
  { key: 'energyPrice', label: 'Precio por energía', step: 0.1 },
  { key: 'sellRefund', label: 'Reembolso demolición', step: 0.01 },
  { key: 'repairRate', label: 'Costo reparación', step: 0.01 },
  { key: 'maxOfflineSeconds', label: 'Máximo offline / s' },
  { key: 'secondIslandCost', label: 'Costo segunda isla' },
  { key: 'maxBuildingLevel', label: 'Nivel máximo' },
  { key: 'outputGrowth', label: 'Potencia por nivel', step: 0.01 },
  { key: 'upgradeGrowth', label: 'Crecimiento costo mejoras', step: 0.01 },
  { key: 'upgradeBaseMultiplier', label: 'Multiplicador costo mejora', step: 0.1 },
]

const BASE_COMPONENTS = Object.fromEntries(COMPONENT_ORDER.map((kind) => [kind, { ...COMPONENTS[kind] }])) as Record<ComponentKind, ComponentDefinition>
const BASE_ECONOMY = { ...ECONOMY }
const BASE_TECH_COSTS = Object.fromEntries(TECH_ORDER.map((key) => [key, TECHNOLOGIES[key].cost])) as Record<TechKey, number>
const BASE_AUTO_REBUILD = { ...AUTO_REBUILD_COSTS }
const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback

export function createDefaultDebugSettings(): DebugSettings {
  const componentValues = Object.fromEntries(COMPONENT_ORDER.map((kind) => {
    const values: Partial<Record<ComponentNumericKey, number>> = {}
    for (const { key } of COMPONENT_NUMERIC_FIELDS) {
      const value = BASE_COMPONENTS[kind][key]
      if (typeof value === 'number') values[key] = value
    }
    return [kind, values]
  })) as DebugSettings['componentValues']
  const economy = Object.fromEntries(ECONOMY_DEBUG_FIELDS.map(({ key }) => [key, BASE_ECONOMY[key]])) as DebugSettings['economy']
  const upgradeBaseCosts = Object.fromEntries(COMPONENT_ORDER.map((kind) => [kind, { ...UPGRADE_BASE_COSTS[kind] }])) as DebugSettings['upgradeBaseCosts']
  return { enabled: false, infiniteMoney: false, initialCredits: BASE_ECONOMY.startingCredits, componentValues, technologyCosts: { ...BASE_TECH_COSTS }, autoRebuildCosts: { ...BASE_AUTO_REBUILD }, economy, upgradeBaseCosts }
}

export function normalizeDebugSettings(value: unknown): DebugSettings {
  const defaults = createDefaultDebugSettings()
  if (!value || typeof value !== 'object') return defaults
  const source = value as Partial<DebugSettings>
  const componentValues = { ...defaults.componentValues }
  for (const kind of COMPONENT_ORDER) {
    const incoming = source.componentValues?.[kind]
    const values = { ...defaults.componentValues[kind] }
    for (const { key } of COMPONENT_NUMERIC_FIELDS) if (key in values) values[key] = finite(incoming?.[key], values[key]!)
    componentValues[kind] = values
  }
  const economy = { ...defaults.economy }
  for (const { key } of ECONOMY_DEBUG_FIELDS) economy[key] = finite(source.economy?.[key], economy[key])
  const technologyCosts = { ...defaults.technologyCosts }
  for (const key of TECH_ORDER) technologyCosts[key] = finite(source.technologyCosts?.[key], technologyCosts[key])
  const autoRebuildCosts = { ...defaults.autoRebuildCosts }
  for (const kind of LIFETIME_ORDER) autoRebuildCosts[kind] = finite(source.autoRebuildCosts?.[kind], autoRebuildCosts[kind] ?? 0)
  const upgradeBaseCosts = { ...defaults.upgradeBaseCosts }
  for (const kind of COMPONENT_ORDER) {
    upgradeBaseCosts[kind] = { ...defaults.upgradeBaseCosts[kind] }
    for (const track of ['output', 'capacity', 'autonomy'] as UpgradeTrack[]) upgradeBaseCosts[kind][track] = finite(source.upgradeBaseCosts?.[kind]?.[track], upgradeBaseCosts[kind][track])
  }
  return { enabled: Boolean(source.enabled), infiniteMoney: Boolean(source.infiniteMoney), initialCredits: finite(source.initialCredits, defaults.initialCredits), componentValues, technologyCosts, autoRebuildCosts, economy, upgradeBaseCosts }
}

/** Applies a save-scoped debug balance to the runtime catalog; disabling restores official values. */
export function applyDebugSettings(settings: DebugSettings): void {
  for (const kind of COMPONENT_ORDER) Object.assign(COMPONENTS[kind], BASE_COMPONENTS[kind])
  Object.assign(ECONOMY as unknown as Record<string, number>, BASE_ECONOMY)
  for (const key of TECH_ORDER) TECHNOLOGIES[key].cost = BASE_TECH_COSTS[key]
  for (const kind of LIFETIME_ORDER) AUTO_REBUILD_COSTS[kind] = BASE_AUTO_REBUILD[kind]
  if (!settings.enabled) return
  for (const kind of COMPONENT_ORDER) Object.assign(COMPONENTS[kind], settings.componentValues[kind])
  Object.assign(ECONOMY as unknown as Record<string, number>, settings.economy, { startingCredits: settings.initialCredits })
  for (const key of TECH_ORDER) TECHNOLOGIES[key].cost = settings.technologyCosts[key]
  for (const kind of LIFETIME_ORDER) AUTO_REBUILD_COSTS[kind] = settings.autoRebuildCosts[kind]
}

export function withDebugSettings(state: GameState, value: DebugSettings): GameState {
  const debug = normalizeDebugSettings(value)
  applyDebugSettings(debug)
  return { ...state, debug }
}

export function resetDebugTuning(current: DebugSettings): DebugSettings {
  return { ...createDefaultDebugSettings(), enabled: current.enabled, infiniteMoney: current.infiniteMoney }
}

export const hasInfiniteMoney = (state: GameState) => state.debug.enabled && state.debug.infiniteMoney
export const canAfford = (state: GameState, cost: number) => hasInfiniteMoney(state) || state.credits >= cost
export const spendCredits = (state: GameState, cost: number) => hasInfiniteMoney(state) ? state.credits : state.credits - cost
export const configuredUpgradeBaseCost = (state: GameState, kind: ComponentKind, track: UpgradeTrack, fallback: number) => state.debug.enabled ? state.debug.upgradeBaseCosts[kind][track] : fallback
