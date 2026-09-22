import { COMPONENT_ORDER, resistanceFromCapacityAndFlow } from './balance'
import type { ComponentDefinition, ComponentKind } from './types'

export const COMPONENTS: Record<ComponentKind, ComponentDefinition> = {
  wind: { kind: 'wind', name: 'Turbina eólica', shortName: 'Eólica', description: 'Produce 0,2 E/s durante 10 segundos: 2 E por cada reconstrucción de ₡1.', icon: '≋', cost: 1, capacity: 0, directEnergy: 0.2, fuelCycles: 10, refuelCost: 1 },
  solar: { kind: 'solar', name: 'Panel solar', shortName: 'Solar', description: 'Produce 100 E/s durante 180 segundos: 18.000 E por reconstrucción.', icon: '☀', cost: 12_000, capacity: 0, directEnergy: 100, fuelCycles: 180, refuelCost: 12_000, tech: 'solar' },
  sales: { kind: 'sales', name: 'Oficina de ventas', shortName: 'Ventas', description: 'Vende 12.500 E/s y se recalibra con cada tier térmico.', icon: '₡', cost: 1_000, capacity: 0, salesRate: 12_500 },
  battery: { kind: 'battery', name: 'Batería de red', shortName: 'Batería', description: 'Almacena 1 M E y se recalibra con cada tier térmico.', icon: '▤', cost: 50_000, capacity: 0, storageCapacity: 1_000_000, tech: 'solar' },
  research: { kind: 'research', name: 'Instalación de I+D', shortName: 'I+D', description: 'Genera 1 RP/s de manera pasiva.', icon: '⌬', cost: 500, capacity: 0, researchRate: 1 },
  controller: { kind: 'controller', name: 'Controlador de red', shortName: 'Control', description: 'Aumenta 10 % almacenamiento y venta, hasta 50 %.', icon: '⌘', cost: 100_000_000, capacity: 0, controllerBonus: 0.1, tech: 'automation' },
  core: { kind: 'core', name: 'Núcleo térmico', shortName: 'Núcleo', description: 'Produce 50.000 calor/s durante 225 segundos: 11,25 M de calor.', icon: '✦', cost: 7_500_000, capacity: 300_000, production: 50_000, fuelCycles: 225, refuelCost: 7_500_000, tech: 'thermal' },
  thorium: { kind: 'thorium', name: 'Reactor de torio', shortName: 'Torio', description: 'Produce 25 M calor/s durante 75 segundos: 1.875 M de calor.', icon: '◈', cost: 1_250_000_000, capacity: 150_000_000, production: 25_000_000, fuelCycles: 75, refuelCost: 1_250_000_000, tech: 'thorium' },
  fusion: { kind: 'fusion', name: 'Reactor de fusión', shortName: 'Fusión', description: 'Produce 12,5 G calor/s durante 34 segundos: 425 G de calor.', icon: '✺', cost: 280_000_000_000, capacity: 75_000_000_000, production: 12_500_000_000, fuelCycles: 34, refuelCost: 280_000_000_000, tech: 'fusion' },
  generator: { kind: 'generator', name: 'Turbina generadora', shortName: 'Turbina', description: 'Convierte 12.500 calor/s; exactamente un cuarto de un núcleo base.', icon: 'ϟ', cost: 1_500_000, capacity: 0, conversionRate: 12_500, tech: 'thermal' },
  cooler: { kind: 'cooler', name: 'Torre de enfriamiento', shortName: 'Enfriador', description: 'Disipa hasta 50.000 calor/s adyacente.', icon: '❄', cost: 1_000_000, capacity: 0, coolingRate: 50_000, tech: 'logistics' },
  exchanger: { kind: 'exchanger', name: 'Intercambiador', shortName: 'Interc.', description: 'Nodo térmico de 2 M con resistencia 2,24; escala con el tier térmico.', icon: '⇄', cost: 50_000_000, capacity: 2_000_000, referenceTransferRate: 200_000, thermalResistance: resistanceFromCapacityAndFlow(2_000_000, 200_000), tech: 'logistics' },
  pipe: { kind: 'pipe', name: 'Tubería térmica', shortName: 'Tubería', description: 'Conductor de 300.000 de capacidad y resistencia térmica 1,23.', icon: '━', cost: 10_000_000, capacity: 300_000, referenceTransferRate: 50_000, thermalResistance: resistanceFromCapacityAndFlow(300_000, 50_000), tech: 'logistics' },
  accumulator: { kind: 'accumulator', name: 'Acumulador térmico', shortName: 'Depósito', description: 'Almacena 10 M con resistencia térmica 24,75.', icon: '▣', cost: 250_000_000, capacity: 10_000_000, referenceTransferRate: 100_000, thermalResistance: resistanceFromCapacityAndFlow(10_000_000, 100_000), tech: 'logistics' },
}
export { COMPONENT_ORDER }
