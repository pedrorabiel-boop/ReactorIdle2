import type { ComponentKind, TechKey } from './types'

export const ECONOMY = { startingCredits: 5, baseStorage: 10, baseSalesRate: 0, energyPrice: 1, sellRefund: 0.85, repairRate: 0.35, maxOfflineSeconds: 14_400, secondIslandCost: 500_000, maxBuildingLevel: 10, outputGrowth: 1.25, upgradeGrowth: 1.7, upgradeBaseMultiplier: 5 } as const
export const TECH_ORDER: TechKey[] = ['solar', 'thermal', 'logistics', 'automation', 'thorium', 'fusion', 'expansion']
export const TECHNOLOGIES: Record<TechKey, { name: string; description: string; cost: number; requires?: TechKey }> = {
  solar: { name: 'Captación solar', description: 'Desbloquea paneles solares y baterías de red.', cost: 15 },
  thermal: { name: 'Ingeniería térmica', description: 'Desbloquea núcleo, turbina y enfriador.', cost: 270, requires: 'solar' },
  logistics: { name: 'Logística térmica', description: 'Desbloquea tuberías, intercambiadores y acumuladores.', cost: 800, requires: 'thermal' },
  automation: { name: 'Automatización de red', description: 'Desbloquea controladores de almacenamiento y venta.', cost: 2_000, requires: 'logistics' },
  thorium: { name: 'Ciclo de torio', description: 'Desbloquea reactores de torio más densos.', cost: 4_800, requires: 'automation' },
  fusion: { name: 'Confinamiento de fusión', description: 'Desbloquea la fuente térmica más densa.', cost: 20_000, requires: 'thorium' },
  expansion: { name: 'Expansión territorial', description: 'Autoriza la compra de la isla desértica.', cost: 20_000, requires: 'fusion' },
}
export const EMPTY_TECHS: Record<TechKey, boolean> = { solar: false, thermal: false, logistics: false, automation: false, thorium: false, fusion: false, expansion: false }
export const COMPONENT_ORDER: ComponentKind[] = ['wind', 'solar', 'sales', 'battery', 'research', 'controller', 'core', 'thorium', 'fusion', 'generator', 'cooler', 'exchanger', 'pipe', 'accumulator']
export const LIFETIME_ORDER: ComponentKind[] = ['wind', 'solar', 'core', 'thorium', 'fusion']
export const AUTO_REBUILD_COSTS: Partial<Record<ComponentKind, number>> = { wind: 1, solar: 5, core: 40, thorium: 200, fusion: 750 }
export function emptyBuildingLevels(): Record<ComponentKind, number> { return Object.fromEntries(COMPONENT_ORDER.map((kind) => [kind, 1])) as Record<ComponentKind, number> }
export function emptyAutoRebuilds(): Record<ComponentKind, boolean> { return Object.fromEntries(COMPONENT_ORDER.map((kind) => [kind, false])) as Record<ComponentKind, boolean> }
export function milestoneMultiplier(level: number): number { return level >= 10 ? 2.5 : level >= 5 ? 1.5 : 1 }
export function levelMultiplier(level: number): number { return Math.pow(ECONOMY.outputGrowth, Math.max(0, level - 1)) * milestoneMultiplier(level) }
