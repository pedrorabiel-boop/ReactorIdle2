import { describe, expect, it, vi } from 'vitest'
import { claimContract, createInitialState, isComponentUnlocked, isSectorUnlocked, maintainTile, maintenancePrice, placeTile, refuelTile, reinvestPlant, restorePlantLayout, sellTile, simulateMany, simulateTick, switchSector, toggleAutoMaintenance, toggleAutoRefuel, toggleTile } from './engine'
import { loadGame, normalizeGameState, simulateOffline } from './persistence'
import { buyUpgrade } from './research'

function createNuclearState() {
  return { ...createInitialState(), totalEnergy: 750 }
}

describe('reactor simulation', () => {
  it('starts with wind power and produces energy without heat', () => {
    let state = createInitialState()
    expect(state.selectedKind).toBe('wind')
    expect(isComponentUnlocked(state, 'core')).toBe(false)
    state = placeTile(state, 0, 'wind')
    state = simulateTick(state).state

    expect(state.tiles[0]).toMatchObject({ kind: 'wind', heat: 0, flow: 2 })
    expect(state.totalEnergy).toBe(2)
    expect(state.science).toBeCloseTo(0.1)
    expect(state.credits).toBe(604)
  })

  it('unlocks solar before the first thermal reactor', () => {
    let state = { ...createInitialState(), totalEnergy: 100 }
    expect(isComponentUnlocked(state, 'solar')).toBe(true)
    expect(isComponentUnlocked(state, 'core')).toBe(false)
    state = placeTile(state, 0, 'solar')
    state = simulateTick(state).state

    expect(state.tiles[0]).toMatchObject({ kind: 'solar', heat: 0, flow: 4 })
    expect(state.totalEnergy).toBe(104)
  })

  it('charges construction and refunds half on demolition', () => {
    const initial = createNuclearState()
    const built = placeTile(initial, 0, 'core')
    expect(built.credits).toBe(470)
    expect(built.tiles[0]?.kind).toBe('core')
    expect(placeTile(built, 0, 'cooler')).toBe(built)

    const sold = sellTile(built, 0)
    expect(sold.credits).toBe(560)
    expect(sold.tiles[0]).toBeNull()
  })

  it('turns adjacent reactor heat into energy and credits', () => {
    let state = createNuclearState()
    state = placeTile(state, 0, 'core')
    state = placeTile(state, 1, 'generator')
    const result = simulateTick(state)

    expect(result.report.generatedEnergy).toBe(8)
    expect(result.state.totalEnergy).toBe(758)
    expect(result.state.science).toBeCloseTo(0.4)
    expect(result.state.credits).toBe(326)
    expect(result.state.tiles[0]?.heat).toBe(4)
  })

  it('keeps a basic core-generator-cooler circuit stable', () => {
    let state = createNuclearState()
    state = placeTile(state, 0, 'core')
    state = placeTile(state, 1, 'generator')
    state = placeTile(state, 8, 'cooler')
    state = simulateMany(state, 100)

    expect(state.tiles[0]?.kind).toBe('core')
    expect(state.tiles[0]?.heat).toBe(0)
    expect(state.totalEnergy).toBe(1550)
    expect(state.explosions).toBe(0)
  })

  it('destroys an isolated core after overheating', () => {
    let state = createNuclearState()
    state = placeTile(state, 0, 'core')
    state = simulateMany(state, 13)

    expect(state.tiles[0]).toBeNull()
    expect(state.explosions).toBe(1)
  })

  it('relays heat through an exchanger into a generator', () => {
    let state = createNuclearState()
    state = placeTile(state, 0, 'core')
    state = placeTile(state, 1, 'exchanger')
    state = placeTile(state, 2, 'generator')
    state = simulateTick(state).state

    expect(state.totalEnergy).toBe(758)
    expect(state.tiles[0]?.heat).toBe(2)
    expect(state.tiles[1]?.heat).toBe(2)
  })

  it('spends science on upgrades and applies their effect', () => {
    let state = { ...createNuclearState(), science: 14 }
    state = buyUpgrade(state, 'turbine')
    expect(state.upgrades.turbine).toBe(1)
    expect(state.science).toBe(0)

    state = placeTile(state, 0, 'core')
    state = placeTile(state, 1, 'generator')
    state = simulateTick(state).state
    expect(state.totalEnergy).toBe(760)
    expect(state.tiles[0]?.heat).toBe(2)
  })

  it('migrates version 1 saves without losing progress', () => {
    const { version: _version, science: _science, upgrades: _upgrades, ...legacy } = createInitialState()
    const migrated = normalizeGameState({ ...legacy, version: 1, totalEnergy: 200 })

    expect(migrated?.version).toBe(9)
    expect(migrated?.totalEnergy).toBe(200)
    expect(migrated?.science).toBe(10)
    expect(migrated?.upgrades).toEqual({ renewable: 0, storage: 0, maintenance: 0, containment: 0, transfer: 0, turbine: 0, cooling: 0, market: 0, fuel: 0 })
  })

  it('extends reactor heat capacity after containment research', () => {
    let state = { ...createNuclearState(), science: 18 }
    state = buyUpgrade(state, 'containment')
    state = placeTile(state, 0, 'core')
    state = simulateMany(state, 13)

    expect(state.tiles[0]?.kind).toBe('core')
    expect(state.tiles[0]?.heat).toBe(156)
    expect(state.explosions).toBe(0)
  })

  it('moves heat through a chain of thermal pipes', () => {
    let state = createNuclearState()
    state = placeTile(state, 0, 'core')
    state = placeTile(state, 1, 'pipe')
    state = placeTile(state, 2, 'pipe')
    state = placeTile(state, 3, 'generator')
    state = simulateTick(state).state

    expect(state.totalEnergy).toBe(756)
    expect(state.tiles[0]?.heat).toBe(6)
    expect(state.tiles[1]?.flow).toBe(12)
    expect(state.tiles[2]?.flow).toBe(12)
  })

  it('buffers excess heat in a thermal accumulator', () => {
    let state = createNuclearState()
    state = placeTile(state, 0, 'core')
    state = placeTile(state, 1, 'accumulator')
    state = simulateMany(state, 20)

    expect(state.tiles[0]?.heat).toBe(120)
    expect(state.tiles[1]?.heat).toBe(120)
    expect(state.explosions).toBe(0)
  })

  it('stops heat production when a reactor is disabled', () => {
    let state = createNuclearState()
    state = placeTile(state, 0, 'core')
    state = simulateTick(state).state
    state = toggleTile(state, 0)
    state = simulateMany(state, 5)

    expect(state.tiles[0]?.enabled).toBe(false)
    expect(state.tiles[0]?.heat).toBe(12)
  })

  it('migrates version 2 tiles with safe operational defaults', () => {
    const current = createInitialState()
    const legacyTile = { id: 'core-old', kind: 'core', heat: 24 }
    const migrated = normalizeGameState({
      ...current,
      version: 2,
      tiles: [legacyTile, ...current.tiles.slice(1)],
    })

    expect(migrated?.version).toBe(9)
    expect(migrated?.tiles[0]).toMatchObject({ enabled: true, flow: 0, heat: 24 })
  })

  it('restores a plant layout without rolling back idle production', () => {
    const initial = createNuclearState()
    const built = placeTile(initial, 0, 'pipe')
    const progressed = { ...built, credits: built.credits + 40, totalEnergy: 120, science: 6, tick: 20 }
    const restored = restorePlantLayout(progressed, initial.tiles, 25)

    expect(restored.tiles[0]).toBeNull()
    expect(restored.credits).toBe(690)
    expect(restored.totalEnergy).toBe(120)
    expect(restored.science).toBe(6)
    expect(restored.tick).toBe(20)
  })

  it('unlocks advanced reactors only after their energy milestones', () => {
    const rich = { ...createInitialState(), credits: 10000 }
    expect(isComponentUnlocked(rich, 'thorium')).toBe(false)
    expect(placeTile(rich, 0, 'thorium')).toBe(rich)

    let unlocked = { ...rich, totalEnergy: 5000 }
    expect(isComponentUnlocked(unlocked, 'thorium')).toBe(true)
    unlocked = placeTile(unlocked, 0, 'thorium')
    unlocked = simulateTick(unlocked).state
    expect(unlocked.tiles[0]?.heat).toBe(28)
  })

  it('runs a fusion reactor at its higher production rate', () => {
    let state = { ...createInitialState(), credits: 10000, totalEnergy: 50000 }
    state = placeTile(state, 0, 'fusion')
    state = simulateTick(state).state
    expect(state.tiles[0]?.heat).toBe(72)
  })

  it('increases credit income through energy contracts', () => {
    let state = { ...createNuclearState(), science: 20 }
    state = buyUpgrade(state, 'market')
    state = placeTile(state, 0, 'core')
    state = placeTile(state, 1, 'generator')
    state = simulateTick(state).state

    expect(state.upgrades.market).toBe(1)
    expect(state.credits).toBeCloseTo(329.2)
  })

  it('adds the market upgrade when migrating version 3 saves', () => {
    const current = createInitialState()
    const { market: _market, ...legacyUpgrades } = current.upgrades
    const migrated = normalizeGameState({ ...current, version: 3, upgrades: legacyUpgrades })

    expect(migrated?.version).toBe(9)
    expect(migrated?.upgrades.market).toBe(0)
  })

  it('automatically pays for a new fuel load when a reactor expires', () => {
    let state = { ...createNuclearState(), credits: 1000 }
    state = placeTile(state, 0, 'core')
    state = { ...state, tiles: state.tiles.map((tile, index) => index === 0 && tile ? { ...tile, fuel: 1 } : tile) }
    state = simulateTick(state).state
    const result = simulateTick(state)

    expect(result.report.refuelCost).toBe(120)
    expect(result.state.totalFuelSpent).toBe(120)
    expect(result.state.credits).toBe(700)
    expect(result.state.tiles[0]?.fuel).toBe(299)
  })

  it('stops an empty reactor when automatic refueling is disabled', () => {
    let state = placeTile(createNuclearState(), 0, 'core')
    state = { ...state, tiles: state.tiles.map((tile, index) => index === 0 && tile ? { ...tile, fuel: 0 } : tile) }
    state = toggleAutoRefuel(state, 0)
    state = simulateTick(state).state

    expect(state.tiles[0]?.heat).toBe(0)
    expect(state.tiles[0]?.fuel).toBe(0)
    expect(state.credits).toBe(470)
  })

  it('charges manual refueling in proportion to the missing fuel', () => {
    let state = { ...createNuclearState(), credits: 1000 }
    state = placeTile(state, 0, 'core')
    state = { ...state, tiles: state.tiles.map((tile, index) => index === 0 && tile ? { ...tile, fuel: 150 } : tile) }
    state = refuelTile(state, 0)

    expect(state.tiles[0]?.fuel).toBe(300)
    expect(state.credits).toBe(760)
    expect(state.totalFuelSpent).toBe(60)
  })

  it('migrates version 4 reactors with full fuel and automatic refueling', () => {
    const current = placeTile(createNuclearState(), 0, 'core')
    const legacyTiles = current.tiles.map((tile) => tile ? { id: tile.id, kind: tile.kind, heat: tile.heat, enabled: tile.enabled, flow: tile.flow } : null)
    const { fuel: _fuel, ...legacyUpgrades } = current.upgrades
    const migrated = normalizeGameState({ ...current, version: 4, tiles: legacyTiles, upgrades: legacyUpgrades, totalFuelSpent: undefined })

    expect(migrated?.version).toBe(9)
    expect(migrated?.tiles[0]).toMatchObject({ fuel: 300, autoRefuel: true })
    expect(migrated?.upgrades.fuel).toBe(0)
    expect(migrated?.totalFuelSpent).toBe(0)
  })

  it('progresses renewable contracts only with direct generation', () => {
    let state = placeTile(createInitialState(), 0, 'wind')
    const renewableTick = simulateTick(state)
    expect(renewableTick.report.directEnergy).toBe(2)
    expect(renewableTick.state.activeContract.progress).toBe(2)

    state = { ...createNuclearState(), activeContract: { ...createNuclearState().activeContract, kind: 'renewable', progress: 0 } }
    state = placeTile(state, 0, 'core')
    state = placeTile(state, 1, 'generator')
    expect(simulateTick(state).state.activeContract.progress).toBe(0)
  })

  it('progresses thermal contracts only with converted heat', () => {
    let state = createNuclearState()
    state = { ...state, activeContract: { ...state.activeContract, kind: 'thermal', progress: 0 } }
    state = placeTile(state, 0, 'core')
    state = placeTile(state, 1, 'generator')
    const result = simulateTick(state)

    expect(result.report.thermalEnergy).toBe(8)
    expect(result.state.activeContract.progress).toBe(8)
  })

  it('claims a completed contract and creates the next one', () => {
    const initial = createInitialState()
    expect(claimContract(initial)).toBe(initial)

    const completed = { ...initial, activeContract: { ...initial.activeContract, progress: initial.activeContract.target } }
    const claimed = claimContract(completed)
    expect(claimed.contractsCompleted).toBe(1)
    expect(claimed.credits).toBe(initial.credits + initial.activeContract.rewardCredits)
    expect(claimed.science).toBe(initial.science + initial.activeContract.rewardScience)
    expect(claimed.activeContract.id).toBe('energy-1')
    expect(claimed.activeContract.progress).toBe(0)
  })

  it('adds a fresh contract when migrating version 5 saves', () => {
    const current = createInitialState()
    const { activeContract: _activeContract, contractsCompleted: _contractsCompleted, ...legacy } = current
    const migrated = normalizeGameState({ ...legacy, version: 5, totalEnergy: 900 })

    expect(migrated?.version).toBe(9)
    expect(migrated?.contractsCompleted).toBe(0)
    expect(migrated?.activeContract).toMatchObject({ id: 'renewable-0', progress: 0, target: 100 })
  })

  it('wears enabled components slowly without changing early performance', () => {
    let state = placeTile(createInitialState(), 0, 'wind')
    state = simulateTick(state).state

    expect(state.tiles[0]?.condition).toBe(99.95)
    expect(state.totalEnergy).toBe(2)
    state = toggleTile(state, 0)
    state = simulateTick(state).state
    expect(state.tiles[0]?.condition).toBe(99.95)
  })

  it('reduces output predictably only below fifty percent condition', () => {
    let state = placeTile(createInitialState(), 0, 'wind')
    state = { ...state, tiles: state.tiles.map((tile, index) => index === 0 && tile ? { ...tile, condition: 0 } : tile) }
    const result = simulateTick(state)

    expect(result.report.directEnergy).toBe(1)
    expect(result.state.totalEnergy).toBe(1)
  })

  it('charges proportional manual maintenance and restores condition', () => {
    let state = placeTile(createInitialState(), 0, 'wind')
    state = { ...state, tiles: state.tiles.map((tile, index) => index === 0 && tile ? { ...tile, condition: 50 } : tile) }
    expect(maintenancePrice(state, 0)).toBe(10)
    state = maintainTile(state, 0)

    expect(state.tiles[0]?.condition).toBe(100)
    expect(state.credits).toBe(590)
    expect(state.totalMaintenanceSpent).toBe(10)
  })

  it('performs configured maintenance automatically at the safe threshold', () => {
    let state = placeTile(createInitialState(), 0, 'wind')
    state = toggleAutoMaintenance(state, 0)
    state = { ...state, tiles: state.tiles.map((tile, index) => index === 0 && tile ? { ...tile, condition: 25 } : tile) }
    const result = simulateTick(state)

    expect(result.report.maintenanceCost).toBe(15)
    expect(result.state.tiles[0]?.condition).toBe(99.95)
    expect(result.state.totalMaintenanceSpent).toBe(15)
  })

  it('migrates version 6 components with safe maintenance defaults', () => {
    const current = placeTile(createInitialState(), 0, 'wind')
    const legacyTiles = current.tiles.map((tile) => tile ? { id: tile.id, kind: tile.kind, heat: tile.heat, enabled: tile.enabled, flow: tile.flow, fuel: tile.fuel, autoRefuel: tile.autoRefuel } : null)
    const migrated = normalizeGameState({ ...current, version: 6, tiles: legacyTiles, totalMaintenanceSpent: undefined })

    expect(migrated?.version).toBe(9)
    expect(migrated?.tiles[0]).toMatchObject({ condition: 100, autoMaintain: false })
    expect(migrated?.totalMaintenanceSpent).toBe(0)
  })

  it('stores a real share of renewable output and releases it later', () => {
    let state = { ...createInitialState(), totalEnergy: 1500, credits: 1000 }
    state = placeTile(state, 0, 'wind')
    state = placeTile(state, 1, 'battery')
    const charging = simulateTick(state)

    expect(charging.report.storedEnergy).toBe(0.5)
    expect(charging.report.generatedEnergy).toBe(1.5)
    expect(charging.state.tiles[1]?.charge).toBe(0.5)

    state = toggleTile(charging.state, 0)
    const discharging = simulateTick(state)
    expect(discharging.report.batteryEnergy).toBe(0.5)
    expect(discharging.state.tiles[1]?.charge).toBe(0)
  })

  it('uses a controller to fill a ten megawatt renewable deficit', () => {
    let state = { ...createInitialState(), totalEnergy: 7500, credits: 3000 }
    state = placeTile(state, 0, 'wind')
    state = placeTile(state, 1, 'battery')
    state = placeTile(state, 2, 'controller')
    state = { ...state, tiles: state.tiles.map((tile, index) => index === 1 && tile ? { ...tile, charge: 20 } : tile) }
    const result = simulateTick(state)

    expect(result.report.directEnergy).toBe(2)
    expect(result.report.batteryEnergy).toBe(8)
    expect(result.report.generatedEnergy).toBe(10)
    expect(result.state.tiles[1]?.charge).toBe(12)
  })

  it('applies renewable and preventive maintenance research', () => {
    let state = { ...createInitialState(), science: 30 }
    state = buyUpgrade(state, 'renewable')
    state = buyUpgrade(state, 'maintenance')
    state = placeTile(state, 0, 'wind')
    state = { ...state, tiles: state.tiles.map((tile, index) => index === 0 && tile ? { ...tile, condition: 50 } : tile) }

    expect(simulateTick(state).report.directEnergy).toBeCloseTo(2.3)
    expect(maintenancePrice(state, 0)).toBe(9)
  })

  it('migrates version 7 saves with battery and research defaults', () => {
    const current = createInitialState()
    const { renewable: _renewable, storage: _storage, maintenance: _maintenance, ...legacyUpgrades } = current.upgrades
    const migrated = normalizeGameState({ ...current, version: 7, upgrades: legacyUpgrades })

    expect(migrated?.version).toBe(9)
    expect(migrated?.upgrades).toMatchObject({ renewable: 0, storage: 0, maintenance: 0 })
  })

  it('keeps independent layouts when navigating between sectors', () => {
    let state = { ...createInitialState(), totalEnergy: 25000, credits: 2000 }
    state = placeTile(state, 0, 'wind')
    expect(isSectorUnlocked(state, 'desert')).toBe(true)
    state = switchSector(state, 'desert')
    expect(state.tiles[0]).toBeNull()
    state = placeTile(state, 0, 'solar')
    state = switchSector(state, 'coast')

    expect(state.tiles[0]?.kind).toBe('wind')
    expect(state.sectorLayouts.desert[0]?.kind).toBe('solar')
  })

  it('applies the desert solar bonus only in that sector', () => {
    let state = { ...createInitialState(), totalEnergy: 25000 }
    state = switchSector(state, 'desert')
    state = placeTile(state, 0, 'solar')
    const result = simulateTick(state)

    expect(result.report.directEnergy).toBe(5)
  })

  it('keeps every unlocked sector producing while another grid is visible', () => {
    let state = { ...createInitialState(), totalEnergy: 25000, credits: 2000 }
    state = placeTile(state, 0, 'wind')
    state = switchSector(state, 'desert')
    state = placeTile(state, 0, 'solar')
    state = switchSector(state, 'coast')
    const result = simulateTick(state)

    expect(result.report.directEnergy).toBe(7)
    expect(result.state.totalEnergy).toBe(25007)
    expect(result.state.activeContract.progress).toBe(7)
    expect(result.state.tiles[0]).toMatchObject({ kind: 'wind', condition: 99.95 })
    expect(result.state.sectorLayouts.desert[0]).toMatchObject({ kind: 'solar', condition: 99.95 })
    expect(result.state.activeSector).toBe('coast')
    expect(result.state.tick).toBe(1)
  })

  it('reinvests voluntarily for a permanent production bonus', () => {
    const locked = createInitialState()
    expect(reinvestPlant(locked)).toBe(locked)

    let state = reinvestPlant({ ...locked, totalEnergy: 100000, prestige: 1 })
    expect(state.prestige).toBe(2)
    expect(state.totalEnergy).toBe(0)
    state = placeTile(state, 0, 'wind')
    expect(simulateTick(state).report.directEnergy).toBeCloseTo(2.4)
  })

  it('migrates version 8 saves into the coastal sector', () => {
    const current = placeTile(createInitialState(), 0, 'wind')
    const { activeSector: _activeSector, sectorLayouts: _sectorLayouts, prestige: _prestige, ...legacy } = current
    const migrated = normalizeGameState({ ...legacy, version: 8 })

    expect(migrated?.version).toBe(9)
    expect(migrated?.activeSector).toBe('coast')
    expect(migrated?.sectorLayouts.coast[0]?.kind).toBe('wind')
    expect(migrated?.sectorLayouts.desert[0]).toBeNull()
    expect(migrated?.prestige).toBe(0)
  })

  it('reaches thermal engineering from a viable renewable opening', () => {
    let state = createInitialState()
    for (let index = 0; index < 10; index += 1) state = placeTile(state, index, 'wind')
    state = simulateMany(state, 38)

    expect(state.totalEnergy).toBe(760)
    expect(state.credits).toBeGreaterThan(1600)
    expect(isComponentUnlocked(state, 'core')).toBe(true)
  })

  it('can progress from a new renewable plant all the way to fusion', () => {
    let state = createInitialState()
    for (let index = 0; index < 10; index += 1) {
      state = placeTile(state, index, 'wind')
      state = toggleAutoMaintenance(state, index)
    }
    state = simulateMany(state, 2600)

    expect(state.totalEnergy).toBeGreaterThanOrEqual(50000)
    expect(isComponentUnlocked(state, 'fusion')).toBe(true)
    state = placeTile(state, 10, 'fusion')
    expect(state.tiles[10]?.kind).toBe('fusion')
    expect(simulateTick(state).state.tiles[10]?.heat).toBe(72)
  })

  it('keeps a stable nuclear circuit profitable through a fuel load', () => {
    let state = { ...createNuclearState(), credits: 1000 }
    state = placeTile(state, 0, 'core')
    state = placeTile(state, 1, 'generator')
    state = placeTile(state, 8, 'cooler')
    state = simulateMany(state, 301)

    expect(state.explosions).toBe(0)
    expect(state.totalFuelSpent).toBe(120)
    expect(state.credits).toBeGreaterThan(5000)
  })

  it('stops offline simulation before a thermal incident', () => {
    const state = placeTile(createNuclearState(), 0, 'core')
    const offline = simulateOffline(state, 60)

    expect(offline.summary.safetyStop).toBe(true)
    expect(offline.summary.simulatedSeconds).toBe(12)
    expect(offline.state.explosions).toBe(0)
    expect(offline.state.paused).toBe(true)
    expect(offline.state.tiles[0]?.heat).toBe(144)
  })

  it('never lets automatic services create debt', () => {
    let state = { ...createNuclearState(), credits: 0 }
    state = placeTile({ ...state, credits: 1000 }, 0, 'core')
    state = toggleAutoMaintenance(state, 0)
    state = { ...state, credits: 0, tiles: state.tiles.map((tile, index) => index === 0 && tile ? { ...tile, fuel: 0, condition: 25 } : tile) }
    const result = simulateTick(state)

    expect(result.state.credits).toBe(0)
    expect(result.report.refuelCost).toBe(0)
    expect(result.report.maintenanceCost).toBe(0)
    expect(result.state.tiles[0]).toMatchObject({ fuel: 0, condition: 24.95 })
  })

  it('backs up a corrupt browser save before recovering safely', () => {
    const storage = new Map<string, string>([['nucleus-idle-save-v1', '{not valid json']])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    })
    try {
      const loaded = loadGame()
      expect(loaded.recoveredCorruptSave).toBe(true)
      expect(loaded.state).toMatchObject({ version: 9, totalEnergy: 0, credits: 650 })
      expect(storage.get('nucleus-idle-corrupt-backup')).toBe('{not valid json')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('rejects malformed grids and unknown save versions', () => {
    expect(normalizeGameState({ version: 9, rows: 10, cols: 8, tiles: [] })).toBeNull()
    expect(normalizeGameState({ ...createInitialState(), version: 99 })).toBeNull()
  })
})
