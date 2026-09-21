import type { ComponentKind, TechKey } from './types'

export const ECONOMY = { startingCredits: 5, baseStorage: 10, baseSalesRate: 0, energyPrice: 1, sellRefund: 0.85, repairRate: 0.35, maxOfflineSeconds: 14_400, secondIslandCost: 500_000, maxBuildingLevel: 50, outputGrowth: 1.1, upgradeGrowth: 1.13 } as const
export const TECH_ORDER: TechKey[] = ['solar', 'thermal', 'logistics', 'automation', 'thorium', 'fusion', 'expansion']
export const TECHNOLOGIES: Record<TechKey, { name: string; description: string; cost: number; requires?: TechKey }> = {
  solar: { name: 'Captación solar', description: 'Desbloquea paneles solares y baterías de red.', cost: 15 },
  thermal: { name: 'Ingeniería térmica', description: 'Desbloquea núcleo, turbina y enfriador.', cost: 510, requires: 'solar' },
  logistics: { name: 'Logística térmica', description: 'Desbloquea tuberías, intercambiadores y acumuladores.', cost: 3_000, requires: 'thermal' },
  automation: { name: 'Automatización de red', description: 'Desbloquea controladores de almacenamiento y venta.', cost: 3_500, requires: 'logistics' },
  thorium: { name: 'Ciclo de torio', description: 'Desbloquea reactores de torio más densos.', cost: 5_200, requires: 'automation' },
  fusion: { name: 'Confinamiento de fusión', description: 'Desbloquea la fuente térmica más densa.', cost: 10_000, requires: 'thorium' },
  expansion: { name: 'Expansión territorial', description: 'Autoriza la compra de la isla desértica.', cost: 9_000, requires: 'fusion' },
}
export const EMPTY_TECHS: Record<TechKey, boolean> = { solar: false, thermal: false, logistics: false, automation: false, thorium: false, fusion: false, expansion: false }
export const COMPONENT_ORDER: ComponentKind[] = ['wind', 'solar', 'sales', 'battery', 'research', 'controller', 'core', 'thorium', 'fusion', 'generator', 'cooler', 'exchanger', 'pipe', 'accumulator']
export const LIFETIME_ORDER: ComponentKind[] = ['wind', 'solar', 'core', 'thorium', 'fusion']
export const AUTO_REBUILD_COSTS: Partial<Record<ComponentKind, number>> = { wind: 1, solar: 5, core: 40, thorium: 200, fusion: 750 }
export function emptyBuildingLevels(): Record<ComponentKind, number> { return Object.fromEntries(COMPONENT_ORDER.map((kind) => [kind, 1])) as Record<ComponentKind, number> }
export function emptyAutoRebuilds(): Record<ComponentKind, boolean> { return Object.fromEntries(COMPONENT_ORDER.map((kind) => [kind, false])) as Record<ComponentKind, boolean> }
export function milestoneMultiplier(level: number): number { return level >= 50 ? 2 : level >= 25 ? 1.5 : level >= 10 ? 1.25 : 1 }
export function levelMultiplier(level: number): number { return Math.pow(ECONOMY.outputGrowth, Math.max(0, level - 1)) * milestoneMultiplier(level) }
