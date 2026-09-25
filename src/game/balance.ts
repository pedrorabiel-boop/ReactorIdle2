import type { ComponentKind, TechKey, UpgradeTrack } from './types'

export const ECONOMY = { startingCredits: 1, baseStorage: 20, baseSalesRate: 0, energyPrice: 1, sellRefund: 0.85, repairRate: 0.35, maxOfflineSeconds: 14_400, secondIslandCost: 1_000_000_000_000, maxBuildingLevel: 10, maxCyberpunkBuildingLevel: 15, outputGrowth: 1.35, upgradeGrowth: 2.2, upgradeBaseMultiplier: 15 } as const
export const TECH_ORDER: TechKey[] = ['solar', 'thermal', 'thorium', 'fusion', 'expansion']
export const TECHNOLOGIES: Record<TechKey, { name: string; description: string; cost: number; requires?: TechKey }> = {
  solar: { name: 'Captación solar', description: 'Desbloquea paneles solares y baterías de red.', cost: 150 },
  thermal: { name: 'Ingeniería térmica', description: 'Desbloquea el núcleo térmico y la turbina generadora.', cost: 60_000, requires: 'solar' },
  thorium: { name: 'Ciclo de torio', description: 'Desbloquea Torio, toda la red térmica, controlador, Oficina II e I+D II.', cost: 300_000, requires: 'thermal' },
  fusion: { name: 'Confinamiento de fusión', description: 'Desbloquea el reactor de fusión, la Turbina II y la Tubería II sin alterar la infraestructura existente.', cost: 20_000_000, requires: 'thorium' },
  expansion: { name: 'Expansión territorial', description: 'Autoriza la compra del Distrito Neón. No requiere otras tecnologías.', cost: 50_000_000 },
}
export const EMPTY_TECHS: Record<TechKey, boolean> = { solar: false, thermal: false, thorium: false, fusion: false, expansion: false }
export const COMPONENT_ORDER: ComponentKind[] = ['wind', 'solar', 'sales', 'sales2', 'battery', 'research', 'research2', 'controller', 'core', 'thorium', 'fusion', 'generator', 'generator2', 'cooler', 'exchanger', 'pipe', 'pipe2', 'accumulator']
export const LIFETIME_ORDER: ComponentKind[] = ['wind', 'solar', 'core', 'thorium', 'fusion']
export const AUTO_REBUILD_COSTS: Partial<Record<ComponentKind, number>> = {
  wind: 15,
  solar: 3_000,
  core: 150_000,
  thorium: 9_000_000,
  fusion: 60_000_000,
}
export const UPGRADE_BASE_COSTS: Record<ComponentKind, Record<UpgradeTrack, number>> = {
  wind: { output: 30, capacity: 26, autonomy: 23 },
  solar: { output: 80_000, capacity: 306_000, autonomy: 60_000 },
  sales: { output: 8_000, capacity: 25_500, autonomy: 22_500 },
  sales2: { output: 150_000_000, capacity: 25_500, autonomy: 22_500 },
  battery: { output: 250_000, capacity: 1_275_000, autonomy: 1_125_000 },
  research: { output: 150_000_000, capacity: 12_750, autonomy: 11_250 },
  research2: { output: 150_000_000, capacity: 12_750, autonomy: 11_250 },
  controller: { output: 3_000_000_000, capacity: 2_550_000_000, autonomy: 2_250_000_000 },
  core: { output: 3_500_000, capacity: 2_000_000, autonomy: 2_500_000 },
  thorium: { output: 500_000_000, capacity: 100_000_000, autonomy: 400_000_000 },
  fusion: { output: 8_400_000_000_000, capacity: 7_140_000_000_000, autonomy: 6_300_000_000_000 },
  generator: { output: 150_000, capacity: 90_000, autonomy: 33_750_000 },
  generator2: { output: 187_500_000, capacity: 112_500_000, autonomy: 33_750_000 },
  cooler: { output: 30_000_000, capacity: 25_500_000, autonomy: 22_500_000 },
  exchanger: { output: 1_500_000_000, capacity: 1_275_000_000, autonomy: 1_125_000_000 },
  pipe: { output: 300_000_000, capacity: 255_000_000, autonomy: 225_000_000 },
  pipe2: { output: 67_200_000_000, capacity: 57_120_000_000, autonomy: 50_400_000_000 },
  accumulator: { output: 7_500_000_000, capacity: 6_375_000_000, autonomy: 5_625_000_000 },
}
/**
 * Convierte la antigua relación capacidad/caudal en resistencia por nodo.
 * Dos piezas iguales suman sus resistencias; ante un gradiente térmico completo
 * transfieren el mismo calor por tick que permitía el balance anterior.
 */
export function resistanceFromCapacityAndFlow(capacity: number, referenceFlow: number): number {
  const coupling = Math.min(0.999_999, Math.max(0.000_001, referenceFlow * 2 / capacity))
  return -0.5 / Math.log(1 - coupling)
}
export function emptyBuildingLevels(initialLevel = 1): Record<ComponentKind, number> { return Object.fromEntries(COMPONENT_ORDER.map((kind) => [kind, initialLevel])) as Record<ComponentKind, number> }
export function emptyAutoRebuilds(): Record<ComponentKind, boolean> { return Object.fromEntries(COMPONENT_ORDER.map((kind) => [kind, false])) as Record<ComponentKind, boolean> }
export function milestoneMultiplier(level: number): number { return level >= 10 ? 2.5 : level >= 5 ? 1.5 : 1 }
export function levelMultiplier(level: number): number { return Math.pow(ECONOMY.outputGrowth, Math.max(0, level - 1)) * milestoneMultiplier(level) }
