import { ECONOMY, TECH_ORDER, emptyAutoRebuilds, emptyBuildingLevels, levelMultiplier, offlineProductiveSeconds } from './balance'
import { COMPONENTS } from './catalog'
import { applyDebugSettings, normalizeDebugSettings } from './debug'
import { createInitialState, emptyTickReport, isComponentUnlocked, simulateTick } from './engine'
import type { GameState, SectorEconomy, SectorKey, Tile } from './types'
import { COAST_BUILDABLE_INDICES, COAST_BUILDABLE_SET, CYBERPUNK_BUILDABLE_INDICES } from './terrain'

const SAVE_KEY = 'nucleus-idle-save-v2'
const CORRUPT_BACKUP_KEY = 'nucleus-idle-v2-corrupt-backup'
interface SaveEnvelope { savedAt: number; state: GameState }
export interface OfflineSummary { simulatedSeconds: number; energy: number; credits: number; research: number; sold: number }
export interface LoadedGame { state: GameState; offlineSeconds: number; offlineSummary: OfflineSummary | null; recoveredCorruptSave: boolean }

export function simulateOffline(state: GameState, requestedSeconds: number): { state: GameState; summary: OfflineSummary } {
  const elapsed = Math.max(0, Math.min(ECONOMY.maxOfflineSeconds, Math.floor(requestedSeconds)))
  // Estar fuera rinde menos que la app abierta, y cada vez menos con las horas.
  // Se simulan solo esos ciclos, de modo que la vida útil y el combustible se
  // gastan a la misma tasa reducida en vez de consumirse enteros por una
  // ganancia parcial.
  const seconds = offlineProductiveSeconds(elapsed); let next = state
  for (let i = 0; i < seconds; i += 1) next = simulateTick(next).state
  return { state: next, summary: { simulatedSeconds: seconds, energy: next.totalEnergy - state.totalEnergy, credits: next.credits - state.credits, research: next.researchPoints - state.researchPoints, sold: next.totalEnergySold - state.totalEnergySold } }
}

export function normalizeGameState(value: unknown): GameState | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, any>
  if (![10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].includes(source.version) || !Array.isArray(source.tiles) || source.tiles.length !== source.rows * source.cols || !source.unlockedTechs || !source.sectorLayouts || !source.ownedSectors) return null
  if (source.version < 13 && !source.buildingLevels) return null
  const sourceEconomies = source.sectorEconomies as GameState['sectorEconomies'] | undefined
  if (source.version >= 13 && (!sourceEconomies?.coast || !sourceEconomies?.desert)) return null
  const debug = normalizeDebugSettings(source.debug)
  applyDebugSettings(debug)
  const oldCycles: Partial<Record<Tile['kind'], number>> = { wind: 300, solar: 600, core: 600, thorium: 900, fusion: 1_200 }
  const legacyAutonomyLevels = source.autonomyLevels ?? emptyBuildingLevels()
  const migrateTile = (tile: Tile | null): Tile | null => {
    if (!tile || source.version >= 12 || !COMPONENTS[tile.kind].fuelCycles) return tile
    const oldMax = (oldCycles[tile.kind] ?? COMPONENTS[tile.kind].fuelCycles ?? 0) * levelMultiplier(legacyAutonomyLevels[tile.kind] ?? 1)
    const newMax = (COMPONENTS[tile.kind].fuelCycles ?? 0) * levelMultiplier(legacyAutonomyLevels[tile.kind] ?? 1)
    const ratio = source.version === 10 && (tile.kind === 'wind' || tile.kind === 'solar') ? 1 : oldMax > 0 ? Math.min(1, tile.fuel / oldMax) : 1
    return { ...tile, fuel: newMax * ratio, autoRefuel: false }
  }
  const sectorLayouts = Object.fromEntries(Object.entries(source.sectorLayouts as Record<string, Array<Tile | null>>).map(([sector, tiles]) => [sector, tiles.map(migrateTile)])) as GameState['sectorLayouts']
  const coast = [...sectorLayouts.coast]
  const overflow = coast.flatMap((tile, index) => tile && !COAST_BUILDABLE_SET.has(index) ? [{ tile, index }] : [])
  for (const { index } of overflow) coast[index] = null
  for (const { tile, index } of overflow) { const target = COAST_BUILDABLE_INDICES.find((candidate) => !coast[candidate]); if (target === undefined) { coast[index] = tile; continue } coast[target] = tile }
  sectorLayouts.coast = coast
  const activeSector = source.activeSector as SectorKey
  if (activeSector === 'desert') sectorLayouts.desert = source.tiles.map(migrateTile)
  if (source.version < 19) {
    for (let offset = 0; offset < 8; offset += 1) {
      const previousIndex = 48 + offset
      const preferredIndex = 40 + offset
      const tile = sectorLayouts.desert[previousIndex]
      if (!tile) continue
      const target = sectorLayouts.desert[preferredIndex] ? CYBERPUNK_BUILDABLE_INDICES.find((index) => !sectorLayouts.desert[index]) : preferredIndex
      if (target === undefined) continue
      sectorLayouts.desert[target] = tile
      sectorLayouts.desert[previousIndex] = null
    }
  }
  if (source.version < 18) {
    const oldDesertEconomy = sourceEconomies?.desert
    sectorLayouts.desert = sectorLayouts.desert.map((tile) => {
      if (!tile) return tile
      const oldCapacityLevel = Math.max(1, Number(oldDesertEconomy?.capacityLevels?.[tile.kind]) || 1)
      const oldAutonomyLevel = Math.max(1, Number(oldDesertEconomy?.autonomyLevels?.[tile.kind]) || 1)
      const baseCapacity = COMPONENTS[tile.kind].capacity
      const oldCapacity = baseCapacity * levelMultiplier(oldCapacityLevel)
      const baseFuel = COMPONENTS[tile.kind].fuelCycles ?? 0
      const oldFuel = baseFuel * levelMultiplier(oldAutonomyLevel)
      return {
        ...tile,
        heat: baseCapacity > 0 && oldCapacity > 0 ? Math.min(baseCapacity, tile.heat / oldCapacity * baseCapacity) : tile.heat,
        fuel: baseFuel > 0 && oldFuel > 0 ? Math.min(baseFuel, tile.fuel / oldFuel * baseFuel) : tile.fuel,
      }
    })
  }
  const activeTiles = sectorLayouts[activeSector]
  sectorLayouts[activeSector] = activeTiles
  const normalizeLevels = (levels: Record<string, number> | undefined, sector: SectorKey) => {
    const minimum = sector === 'desert' ? 0 : 1
    const maximum = sector === 'desert' ? ECONOMY.maxCyberpunkBuildingLevel : ECONOMY.maxBuildingLevel
    return Object.fromEntries(Object.entries({ ...emptyBuildingLevels(minimum), ...(levels ?? {}) }).map(([kind, level]) => {
      const parsed = Number(level)
      return [kind, Math.max(minimum, Math.min(maximum, Number.isFinite(parsed) ? Math.floor(parsed) : minimum))]
    })) as SectorEconomy['buildingLevels']
  }
  const makeLegacyEconomy = (sector: SectorKey): SectorEconomy => ({
    energyStored: sector === activeSector ? Math.max(0, Number(source.energyStored) || 0) : 0,
    buildingLevels: normalizeLevels(sector === 'desert' ? undefined : source.buildingLevels, sector),
    capacityLevels: normalizeLevels(sector === 'desert' ? undefined : source.capacityLevels, sector),
    autonomyLevels: normalizeLevels(sector === 'desert' ? undefined : legacyAutonomyLevels, sector),
  })
  const normalizeEconomy = (entry: SectorEconomy, sector: SectorKey): SectorEconomy => {
    const resetForCyberpunk = sector === 'desert' && source.version < 18
    return { energyStored: Math.max(0, Number(entry.energyStored) || 0), buildingLevels: normalizeLevels(resetForCyberpunk ? undefined : entry.buildingLevels, sector), capacityLevels: normalizeLevels(resetForCyberpunk ? undefined : entry.capacityLevels, sector), autonomyLevels: normalizeLevels(resetForCyberpunk ? undefined : entry.autonomyLevels, sector) }
  }
  const sectorEconomies: GameState['sectorEconomies'] = sourceEconomies ? { coast: normalizeEconomy(sourceEconomies.coast, 'coast'), desert: normalizeEconomy(sourceEconomies.desert, 'desert') } : { coast: makeLegacyEconomy('coast'), desert: makeLegacyEconomy('desert') }
  const sectorReports: GameState['sectorReports'] = source.sectorReports ?? { coast: emptyTickReport(), desert: emptyTickReport() }
  const unlockedTechs = Object.fromEntries(TECH_ORDER.map((key) => [key, Boolean(source.unlockedTechs[key] || (key === 'thorium' && source.version < 15 && source.unlockedTechs.automation))])) as GameState['unlockedTechs']
  const normalized = { ...source, version: 21, autoRebuildPaused: Boolean(source.autoRebuildPaused), giftTicks: Math.max(0, Number(source.giftTicks) || 0), boostActive: Boolean(source.boostActive), tiles: activeTiles, sectorLayouts, sectorEconomies, sectorReports, unlockedTechs, autoRebuilds: { ...emptyAutoRebuilds(), ...(source.autoRebuilds ?? {}) }, credits: Math.max(0, Number(source.credits) || 0), researchPoints: Math.max(0, Number(source.researchPoints) || 0), lastReport: source.lastReport ?? emptyTickReport(), debug }
  const clean = normalized as Record<string, any>
  delete clean.energyStored; delete clean.buildingLevels; delete clean.capacityLevels; delete clean.autonomyLevels
  return normalized as GameState
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
