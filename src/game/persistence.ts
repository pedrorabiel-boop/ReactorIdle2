import { createContract, createInitialState, isComponentUnlocked, simulateTick } from './engine'
import { COMPONENTS } from './catalog'
import { EMPTY_UPGRADES } from './research'
import type { GameState } from './types'

const SAVE_KEY = 'nucleus-idle-save-v1'
const CORRUPT_BACKUP_KEY = 'nucleus-idle-corrupt-backup'
const MAX_OFFLINE_SECONDS = 4 * 60 * 60

interface SaveEnvelope {
  savedAt: number
  state: GameState
}

export interface LoadedGame {
  state: GameState
  offlineSeconds: number
  offlineSummary: OfflineSummary | null
  recoveredCorruptSave: boolean
}

export interface OfflineSummary {
  simulatedSeconds: number
  energy: number
  credits: number
  science: number
  safetyStop: boolean
}

export function simulateOffline(state: GameState, requestedSeconds: number): { state: GameState; summary: OfflineSummary } {
  const seconds = Math.max(0, Math.min(MAX_OFFLINE_SECONDS, Math.floor(requestedSeconds)))
  let next = state
  let simulatedSeconds = 0
  for (; simulatedSeconds < seconds; simulatedSeconds += 1) {
    const result = simulateTick(next).state
    if (result.explosions > next.explosions) {
      next = { ...next, paused: true }
      break
    }
    next = result
  }
  return {
    state: next,
    summary: {
      simulatedSeconds,
      energy: next.totalEnergy - state.totalEnergy,
      credits: next.credits - state.credits,
      science: next.science - state.science,
      safetyStop: simulatedSeconds < seconds,
    },
  }
}

function normalizeTiles(tiles: unknown[]): GameState['tiles'] {
  return tiles.map((value) => {
    if (!value || typeof value !== 'object') return null
    const tile = value as Record<string, unknown>
    const kind = tile.kind as keyof typeof COMPONENTS
    const baseFuel = COMPONENTS[kind]?.fuelCycles ?? 0
    return {
      ...tile,
      enabled: typeof tile.enabled === 'boolean' ? tile.enabled : true,
      flow: typeof tile.flow === 'number' ? tile.flow : 0,
      fuel: typeof tile.fuel === 'number' ? tile.fuel : baseFuel,
      autoRefuel: typeof tile.autoRefuel === 'boolean' ? tile.autoRefuel : true,
      condition: typeof tile.condition === 'number' ? Math.max(0, Math.min(100, tile.condition)) : 100,
      autoMaintain: typeof tile.autoMaintain === 'boolean' ? tile.autoMaintain : false,
      charge: typeof tile.charge === 'number' ? Math.max(0, tile.charge) : 0,
    } as GameState['tiles'][number]
  })
}

function normalizeUpgrades(value: unknown): GameState['upgrades'] {
  if (!value || typeof value !== 'object') return { ...EMPTY_UPGRADES }
  return { ...EMPTY_UPGRADES, ...(value as Partial<GameState['upgrades']>) }
}

function legacySectorDefaults(state: Record<string, unknown>, tiles: GameState['tiles']): Pick<GameState, 'activeSector' | 'sectorLayouts' | 'prestige'> {
  const size = (Number(state.rows) || 10) * (Number(state.cols) || 8)
  return { activeSector: 'coast', sectorLayouts: { coast: tiles, desert: Array.from({ length: size }, () => null) }, prestige: 0 }
}

function hasValidGrid(state: Record<string, unknown>): boolean {
  return Array.isArray(state.tiles) && typeof state.rows === 'number' && typeof state.cols === 'number' && state.tiles.length === state.rows * state.cols
}

export function normalizeGameState(value: unknown): GameState | null {
  if (!value || typeof value !== 'object') return null
  const state = value as Record<string, unknown>
  if (!hasValidGrid(state)) return null
  const version = Number(state.version)
  if (!Number.isInteger(version) || version < 1 || version > 9) return null
  if (version > 1 && (typeof state.science !== 'number' || !state.upgrades)) return null

  const tiles = normalizeTiles(state.tiles as unknown[])
  const totalEnergy = Number(state.totalEnergy) || 0
  const contractsCompleted = version >= 6 && typeof state.contractsCompleted === 'number' ? state.contractsCompleted : 0
  let sectorData = legacySectorDefaults(state, tiles)
  if (version >= 9) {
    const activeSector = state.activeSector === 'desert' ? 'desert' : 'coast'
    const layouts = state.sectorLayouts && typeof state.sectorLayouts === 'object' ? state.sectorLayouts as Record<string, unknown> : {}
    const size = Number(state.rows) * Number(state.cols)
    const coast = Array.isArray(layouts.coast) && layouts.coast.length === size ? normalizeTiles(layouts.coast) : Array.from({ length: size }, () => null)
    const desert = Array.isArray(layouts.desert) && layouts.desert.length === size ? normalizeTiles(layouts.desert) : Array.from({ length: size }, () => null)
    sectorData = { activeSector, sectorLayouts: { coast, desert, [activeSector]: tiles }, prestige: typeof state.prestige === 'number' ? Math.max(0, Math.floor(state.prestige)) : 0 }
  }

  return {
    ...state,
    version: 9,
    tiles,
    ...sectorData,
    science: version === 1 ? Math.round(totalEnergy * 0.05 * 100) / 100 : Number(state.science),
    upgrades: version === 1 ? { ...EMPTY_UPGRADES } : normalizeUpgrades(state.upgrades),
    totalFuelSpent: version >= 5 && typeof state.totalFuelSpent === 'number' ? state.totalFuelSpent : 0,
    totalMaintenanceSpent: version >= 7 && typeof state.totalMaintenanceSpent === 'number' ? state.totalMaintenanceSpent : 0,
    contractsCompleted,
    activeContract: version >= 6 && state.activeContract && typeof state.activeContract === 'object' ? state.activeContract : createContract(contractsCompleted, totalEnergy),
  } as unknown as GameState
}

export function loadGame(): LoadedGame {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return { state: createInitialState(), offlineSeconds: 0, offlineSummary: null, recoveredCorruptSave: false }
    const parsed = JSON.parse(raw) as SaveEnvelope
    const normalized = normalizeGameState(parsed.state)
    if (!normalized) throw new Error('Invalid save')
    const playable = isComponentUnlocked(normalized, normalized.selectedKind) ? normalized : { ...normalized, selectedKind: 'wind' as const, toolMode: 'build' as const }
    const elapsed = playable.paused ? 0 : Math.max(0, Math.min(MAX_OFFLINE_SECONDS, Math.floor((Date.now() - parsed.savedAt) / 1000)))
    if (elapsed === 0) return { state: playable, offlineSeconds: 0, offlineSummary: null, recoveredCorruptSave: false }
    const offline = simulateOffline(playable, elapsed)
    return { state: offline.state, offlineSeconds: offline.summary.simulatedSeconds, offlineSummary: offline.summary, recoveredCorruptSave: false }
  } catch {
    if (raw) {
      try { localStorage.setItem(CORRUPT_BACKUP_KEY, raw) } catch { /* Storage can be unavailable in private mode. */ }
    }
    return { state: createInitialState(), offlineSeconds: 0, offlineSummary: null, recoveredCorruptSave: Boolean(raw) }
  }
}

export function saveGame(state: GameState): void {
  const envelope: SaveEnvelope = { savedAt: Date.now(), state }
  localStorage.setItem(SAVE_KEY, JSON.stringify(envelope))
}

export function exportGame(state: GameState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify({ savedAt: Date.now(), state } satisfies SaveEnvelope))))
}

export function importGame(encoded: string): GameState | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(encoded.trim())))) as SaveEnvelope
    const normalized = normalizeGameState(parsed.state)
    if (!normalized) return null
    return isComponentUnlocked(normalized, normalized.selectedKind) ? normalized : { ...normalized, selectedKind: 'wind', toolMode: 'build' }
  } catch {
    return null
  }
}

export function clearGame(): void {
  localStorage.removeItem(SAVE_KEY)
}
