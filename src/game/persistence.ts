import { ECONOMY, emptyAutoRebuilds, emptyBuildingLevels, levelMultiplier } from './balance'
import { COMPONENTS } from './catalog'
import { createInitialState, emptyTickReport, isComponentUnlocked, simulateTick } from './engine'
import type { GameState, SectorKey, Tile } from './types'

const SAVE_KEY = 'nucleus-idle-save-v2'
const CORRUPT_BACKUP_KEY = 'nucleus-idle-v2-corrupt-backup'
interface SaveEnvelope { savedAt: number; state: GameState }
export interface OfflineSummary { simulatedSeconds: number; energy: number; credits: number; research: number; sold: number }
export interface LoadedGame { state: GameState; offlineSeconds: number; offlineSummary: OfflineSummary | null; recoveredCorruptSave: boolean }

export function simulateOffline(state: GameState, requestedSeconds: number): { state: GameState; summary: OfflineSummary } {
  const seconds = Math.max(0, Math.min(ECONOMY.maxOfflineSeconds, Math.floor(requestedSeconds))); let next = state
  for (let i = 0; i < seconds; i += 1) next = simulateTick(next).state
  return { state: next, summary: { simulatedSeconds: seconds, energy: next.totalEnergy - state.totalEnergy, credits: next.credits - state.credits, research: next.researchPoints - state.researchPoints, sold: next.totalEnergySold - state.totalEnergySold } }
}

export function normalizeGameState(value: unknown): GameState | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Omit<GameState, 'version' | 'capacityLevels' | 'autonomyLevels' | 'autoRebuilds'> & { version: number; capacityLevels?: GameState['capacityLevels']; autonomyLevels?: GameState['autonomyLevels']; autoRebuilds?: GameState['autoRebuilds'] }
  if (![10, 11, 12].includes(source.version) || !Array.isArray(source.tiles) || source.tiles.length !== source.rows * source.cols || !source.unlockedTechs || !source.buildingLevels || !source.sectorLayouts || !source.ownedSectors) return null
  const oldCycles: Partial<Record<Tile['kind'], number>> = { wind: 300, solar: 600, core: 600, thorium: 900, fusion: 1_200 }
  const autonomyLevels = source.autonomyLevels ?? emptyBuildingLevels()
  const migrateTile = (tile: Tile | null): Tile | null => {
    if (!tile || source.version === 12 || !COMPONENTS[tile.kind].fuelCycles) return tile
    const oldMax = (oldCycles[tile.kind] ?? COMPONENTS[tile.kind].fuelCycles ?? 0) * levelMultiplier(autonomyLevels[tile.kind] ?? 1)
    const newMax = (COMPONENTS[tile.kind].fuelCycles ?? 0) * levelMultiplier(autonomyLevels[tile.kind] ?? 1)
    const ratio = source.version === 10 && (tile.kind === 'wind' || tile.kind === 'solar') ? 1 : oldMax > 0 ? Math.min(1, tile.fuel / oldMax) : 1
    return { ...tile, fuel: newMax * ratio, autoRefuel: false }
  }
  const sectorLayouts = Object.fromEntries(Object.entries(source.sectorLayouts).map(([sector, tiles]) => [sector, tiles.map(migrateTile)])) as GameState['sectorLayouts']
  const activeSector = source.activeSector as SectorKey
  const activeTiles = source.tiles.map(migrateTile)
  sectorLayouts[activeSector] = activeTiles
  return { ...source, version: 12, tiles: activeTiles, sectorLayouts, capacityLevels: source.capacityLevels ?? emptyBuildingLevels(), autonomyLevels, autoRebuilds: source.autoRebuilds ?? emptyAutoRebuilds(), credits: Math.max(0, Number(source.credits) || 0), energyStored: Math.max(0, Number(source.energyStored) || 0), researchPoints: Math.max(0, Number(source.researchPoints) || 0), lastReport: source.lastReport ?? emptyTickReport() }
}

export function loadGame(): LoadedGame {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return { state: createInitialState(), offlineSeconds: 0, offlineSummary: null, recoveredCorruptSave: false }
    const parsed = JSON.parse(raw) as SaveEnvelope; const state = normalizeGameState(parsed.state); if (!state) throw new Error('Invalid v2 save')
    const playable = isComponentUnlocked(state, state.selectedKind) ? state : { ...state, selectedKind: 'wind' as const, toolMode: 'build' as const }
    const elapsed = playable.paused ? 0 : Math.min(ECONOMY.maxOfflineSeconds, Math.max(0, Math.floor((Date.now() - parsed.savedAt) / 1000)))
    if (!elapsed) return { state: playable, offlineSeconds: 0, offlineSummary: null, recoveredCorruptSave: false }
    const offline = simulateOffline(playable, elapsed); return { state: offline.state, offlineSeconds: elapsed, offlineSummary: offline.summary, recoveredCorruptSave: false }
  } catch {
    if (raw) try { localStorage.setItem(CORRUPT_BACKUP_KEY, raw) } catch { /* unavailable */ }
    return { state: createInitialState(), offlineSeconds: 0, offlineSummary: null, recoveredCorruptSave: Boolean(raw) }
  }
}
export function saveGame(state: GameState): void { localStorage.setItem(SAVE_KEY, JSON.stringify({ savedAt: Date.now(), state } satisfies SaveEnvelope)) }
export function exportGame(state: GameState): string { return btoa(unescape(encodeURIComponent(JSON.stringify({ savedAt: Date.now(), state } satisfies SaveEnvelope)))) }
export function importGame(encoded: string): GameState | null { try { const parsed = JSON.parse(decodeURIComponent(escape(atob(encoded.trim())))) as SaveEnvelope; return normalizeGameState(parsed.state) } catch { return null } }
export function clearGame(): void { localStorage.removeItem(SAVE_KEY) }
