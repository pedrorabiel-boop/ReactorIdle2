import type { ComponentKind, TechKey } from './types'

export const ECONOMY = { startingCredits: 5, baseStorage: 10, baseSalesRate: 0, energyPrice: 1, sellRefund: 0.85, repairRate: 0.35, maxOfflineSeconds: 14_400, secondIslandCost: 1_000_000_000_000, maxBuildingLevel: 10, outputGrowth: 1.35, upgradeGrowth: 2.25, upgradeBaseMultiplier: 30 } as const
export const TECH_ORDER: TechKey[] = ['solar', 'thermal', 'logistics', 'automation', 'thorium', 'fusion', 'expansion']
export const TECHNOLOGIES: Record<TechKey, { name: string; description: string; cost: number; requires?: TechKey }> = {
  solar: { name: 'Captación solar', description: 'Desbloquea paneles solares y baterías de red.', cost: 30 },
  thermal: { name: 'Ingeniería térmica', description: 'Desbloquea el núcleo térmico y la turbina generadora.', cost: 5_000, requires: 'solar' },
  logistics: { name: 'Logística térmica', description: 'Desbloquea enfriadores, tuberías, intercambiadores y acumuladores.', cost: 500_000, requires: 'thermal' },
  automation: { name: 'Automatización de red', description: 'Desbloquea controladores de almacenamiento y venta.', cost: 2_000_000, requires: 'logistics' },
  thorium: { name: 'Ciclo de torio', description: 'Desbloquea reactores de torio y recalibra la red térmica.', cost: 3_000_000, requires: 'automation' },
  fusion: { name: 'Confinamiento de fusión', description: 'Desbloquea fusión y recalibra la red para su escala.', cost: 20_000_000, requires: 'thorium' },
  expansion: { name: 'Expansión territorial', description: 'Autoriza la compra de la isla desértica.', cost: 100_000_000, requires: 'fusion' },
}
export const EMPTY_TECHS: Record<TechKey, boolean> = { solar: false, thermal: false, logistics: false, automation: false, thorium: false, fusion: false, expansion: false }
export const COMPONENT_ORDER: ComponentKind[] = ['wind', 'solar', 'sales', 'battery', 'research', 'controller', 'core', 'thorium', 'fusion', 'generator', 'cooler', 'exchanger', 'pipe', 'accumulator']
export const LIFETIME_ORDER: ComponentKind[] = ['wind', 'solar', 'core', 'thorium', 'fusion']
export const AUTO_REBUILD_COSTS: Partial<Record<ComponentKind, number>> = {
  wind: 15,
  solar: TECHNOLOGIES.solar.cost * 3,
  core: TECHNOLOGIES.thermal.cost * 3,
  thorium: TECHNOLOGIES.thorium.cost * 3,
  fusion: TECHNOLOGIES.fusion.cost * 3,
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
export function emptyBuildingLevels(): Record<ComponentKind, number> { return Object.fromEntries(COMPONENT_ORDER.map((kind) => [kind, 1])) as Record<ComponentKind, number> }
export function emptyAutoRebuilds(): Record<ComponentKind, boolean> { return Object.fromEntries(COMPONENT_ORDER.map((kind) => [kind, false])) as Record<ComponentKind, boolean> }
export function milestoneMultiplier(level: number): number { return level >= 10 ? 2.5 : level >= 5 ? 1.5 : 1 }
export function levelMultiplier(level: number): number { return Math.pow(ECONOMY.outputGrowth, Math.max(0, level - 1)) * milestoneMultiplier(level) }
