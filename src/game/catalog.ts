import { COMPONENT_ORDER } from './balance'
import type { ComponentDefinition, ComponentKind } from './types'

export const COMPONENTS: Record<ComponentKind, ComponentDefinition> = {
  wind: { kind: 'wind', name: 'Turbina eólica', shortName: 'Eólica', description: 'Produce 0,2 E/s durante 10 segundos: 2 E por cada reconstrucción de ₡1.', icon: '≋', cost: 1, capacity: 0, directEnergy: 0.2, fuelCycles: 10, refuelCost: 1 },
  solar: { kind: 'solar', name: 'Panel solar', shortName: 'Solar', description: 'Produce 1 E/s durante 38 segundos: 38 E por cada reconstrucción de ₡20.', icon: '☀', cost: 20, capacity: 0, directEnergy: 1, fuelCycles: 38, refuelCost: 20, tech: 'solar' },
  sales: { kind: 'sales', name: 'Oficina de ventas', shortName: 'Ventas', description: 'Vende hasta 4 E/s del almacenamiento global.', icon: '₡', cost: 25, capacity: 0, salesRate: 4 },
  battery: { kind: 'battery', name: 'Batería de red', shortName: 'Batería', description: 'Añade 100 E al almacenamiento global.', icon: '▤', cost: 100, capacity: 0, storageCapacity: 100, tech: 'solar' },
  research: { kind: 'research', name: 'Instalación de I+D', shortName: 'I+D', description: 'Genera 0,05 RP/s de manera pasiva.', icon: '⌬', cost: 120, capacity: 0, researchRate: 0.05 },
  controller: { kind: 'controller', name: 'Controlador de red', shortName: 'Control', description: 'Aumenta 10 % almacenamiento y venta, hasta 50 %.', icon: '⌘', cost: 800, capacity: 0, controllerBonus: 0.1, tech: 'automation' },
  core: { kind: 'core', name: 'Núcleo térmico', shortName: 'Núcleo', description: 'Produce 8 calor/s durante 90 segundos: 720 de calor por reconstrucción.', icon: '✦', cost: 400, capacity: 48, production: 8, fuelCycles: 90, refuelCost: 400, tech: 'thermal' },
  thorium: { kind: 'thorium', name: 'Reactor de torio', shortName: 'Torio', description: 'Produce 40 calor/s durante 206 segundos: 8.240 de calor por reconstrucción.', icon: '◈', cost: 5_000, capacity: 240, production: 40, fuelCycles: 206, refuelCost: 5_000, tech: 'thorium' },
  fusion: { kind: 'fusion', name: 'Reactor de fusión', shortName: 'Fusión', description: 'Produce 160 calor/s durante 375 segundos: 60.000 de calor por reconstrucción.', icon: '✺', cost: 40_000, capacity: 960, production: 160, fuelCycles: 375, refuelCost: 40_000, tech: 'fusion' },
  generator: { kind: 'generator', name: 'Turbina generadora', shortName: 'Turbina', description: 'Convierte hasta 2 calor/s adyacente en energía.', icon: 'ϟ', cost: 150, capacity: 0, conversionRate: 2, tech: 'thermal' },
  cooler: { kind: 'cooler', name: 'Torre de enfriamiento', shortName: 'Enfriador', description: 'Disipa hasta 2 calor/s adyacente.', icon: '❄', cost: 100, capacity: 0, coolingRate: 2, tech: 'thermal' },
  exchanger: { kind: 'exchanger', name: 'Intercambiador', shortName: 'Interc.', description: 'Extrae hasta 12 calor/s y extiende la red.', icon: '⇄', cost: 120, capacity: 200, transferRate: 12, tech: 'logistics' },
  pipe: { kind: 'pipe', name: 'Tubería térmica', shortName: 'Tubería', description: 'Transporta hasta 4 calor/s.', icon: '━', cost: 25, capacity: 60, transferRate: 4, tech: 'logistics' },
  accumulator: { kind: 'accumulator', name: 'Acumulador térmico', shortName: 'Depósito', description: 'Almacena 1.000 de calor y transfiere 8/s.', icon: '▣', cost: 250, capacity: 1_000, transferRate: 8, tech: 'logistics' },
}
export { COMPONENT_ORDER }
