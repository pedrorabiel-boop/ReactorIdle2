import { COMPONENTS } from './catalog'
import type { ComponentKind, GameState, UpgradeKey } from './types'

export interface UpgradeDefinition {
  key: UpgradeKey
  name: string
  description: string
  icon: string
  baseCost: number
  maxLevel: number
}

export const EMPTY_UPGRADES: Record<UpgradeKey, number> = {
  renewable: 0,
  storage: 0,
  maintenance: 0,
  containment: 0,
  transfer: 0,
  turbine: 0,
  cooling: 0,
  market: 0,
  fuel: 0,
}

export const UPGRADES: Record<UpgradeKey, UpgradeDefinition> = {
  renewable: {
    key: 'renewable',
    name: 'Aerodinámica avanzada',
    description: '+15 % de producción eólica y solar por nivel.',
    icon: '≋',
    baseCost: 10,
    maxLevel: 5,
  },
  storage: {
    key: 'storage',
    name: 'Celdas de alta densidad',
    description: '+25 % de capacidad y velocidad para las baterías.',
    icon: '▤',
    baseCost: 18,
    maxLevel: 5,
  },
  maintenance: {
    key: 'maintenance',
    name: 'Diagnóstico preventivo',
    description: '-12 % al coste de mantenimiento por nivel.',
    icon: '⚙',
    baseCost: 16,
    maxLevel: 5,
  },
  containment: {
    key: 'containment',
    name: 'Contención reforzada',
    description: '+50 de capacidad térmica para cada reactor.',
    icon: '⬡',
    baseCost: 18,
    maxLevel: 5,
  },
  transfer: {
    key: 'transfer',
    name: 'Aleación conductora',
    description: '+3 de transferencia para intercambiadores, tuberías y depósitos.',
    icon: '⇶',
    baseCost: 12,
    maxLevel: 5,
  },
  turbine: {
    key: 'turbine',
    name: 'Álabes de precisión',
    description: '+2 de conversión por turbina y ciclo.',
    icon: '⌁',
    baseCost: 14,
    maxLevel: 5,
  },
  cooling: {
    key: 'cooling',
    name: 'Circuito criogénico',
    description: '+3 de disipación por enfriador y ciclo.',
    icon: '❉',
    baseCost: 16,
    maxLevel: 5,
  },
  market: {
    key: 'market',
    name: 'Contratos energéticos',
    description: '+20 % de créditos obtenidos por cada MW generado.',
    icon: '₡',
    baseCost: 20,
    maxLevel: 5,
  },
  fuel: {
    key: 'fuel',
    name: 'Combustible enriquecido',
    description: '+25 % de duración para cada carga de combustible.',
    icon: '◉',
    baseCost: 24,
    maxLevel: 5,
  },
}

export const UPGRADE_ORDER: UpgradeKey[] = ['renewable', 'storage', 'maintenance', 'containment', 'transfer', 'turbine', 'cooling', 'market', 'fuel']

export function upgradeCost(state: GameState, key: UpgradeKey): number {
  const level = state.upgrades[key]
  return Math.round(UPGRADES[key].baseCost * Math.pow(1.75, level))
}

export function buyUpgrade(state: GameState, key: UpgradeKey): GameState {
  const definition = UPGRADES[key]
  const level = state.upgrades[key]
  const cost = upgradeCost(state, key)
  if (level >= definition.maxLevel || state.science < cost) return state

  return {
    ...state,
    science: state.science - cost,
    upgrades: { ...state.upgrades, [key]: level + 1 },
  }
}

export function componentCapacity(state: GameState, kind: ComponentKind): number {
  const isReactor = kind === 'core' || kind === 'thorium' || kind === 'fusion'
  return COMPONENTS[kind].capacity + (isReactor ? state.upgrades.containment * 50 : 0)
}

export function energyCreditValue(state: GameState): number {
  return 2 * (1 + state.upgrades.market * 0.2) * (1 + state.prestige * 0.1)
}

export function renewableMultiplier(state: GameState, kind: ComponentKind): number {
  const sectorBonus = state.activeSector === 'desert' && kind === 'solar' ? 1.25 : 1
  return (1 + state.upgrades.renewable * 0.15) * (1 + state.prestige * 0.1) * sectorBonus
}

export function storageCapacity(state: GameState): number {
  return (COMPONENTS.battery.storageCapacity ?? 0) * (1 + state.upgrades.storage * 0.25)
}

export function storageRate(state: GameState): number {
  const coastBonus = state.activeSector === 'coast' ? 1.2 : 1
  return (COMPONENTS.battery.storageRate ?? 0) * (1 + state.upgrades.storage * 0.25) * coastBonus
}

export function maintenanceCostMultiplier(state: GameState): number {
  return Math.max(0.4, 1 - state.upgrades.maintenance * 0.12)
}

export function fuelCapacity(state: GameState, kind: ComponentKind): number {
  const base = COMPONENTS[kind].fuelCycles ?? 0
  return Math.round(base * (1 + state.upgrades.fuel * 0.25))
}

export function transferRate(state: GameState, kind: 'exchanger' | 'pipe' | 'accumulator'): number {
  return (COMPONENTS[kind].transferRate ?? 0) + state.upgrades.transfer * 3
}

export function conversionRate(state: GameState): number {
  return (COMPONENTS.generator.conversionRate ?? 0) + state.upgrades.turbine * 2
}

export function coolingRate(state: GameState): number {
  return (COMPONENTS.cooler.coolingRate ?? 0) + state.upgrades.cooling * 3
}

export function totalUpgradeLevels(state: GameState): number {
  return UPGRADE_ORDER.reduce((total, key) => total + state.upgrades[key], 0)
}
