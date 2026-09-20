import { useEffect, useMemo, useRef, useState } from 'react'
import { COMPONENT_ORDER, COMPONENTS } from './game/catalog'
import { claimContract, conditionEfficiency, countKind, createInitialState, DESERT_UNLOCK_ENERGY, isComponentUnlocked, isReactorKind, isSectorUnlocked, maintenancePrice, maintainTile, placeTile, PRESTIGE_UNLOCK_ENERGY, refuelPrice, refuelTile, reinvestPlant, restorePlantLayout, sellTile, simulateMany, switchSector, toggleAutoMaintenance, toggleAutoRefuel, toggleTile, totalHeat } from './game/engine'
import { clearGame, exportGame, importGame, loadGame, saveGame } from './game/persistence'
import { buyUpgrade, componentCapacity, energyCreditValue, fuelCapacity, storageCapacity, UPGRADE_ORDER, UPGRADES, upgradeCost } from './game/research'
import type { ComponentKind, GameState, ToolMode, UpgradeKey } from './game/types'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PlantHistoryEntry {
  tiles: GameState['tiles']
  creditAdjustment: number
  label: string
}

interface BuildStroke {
  pointerId: number
  visited: Set<number>
  beforeTiles: GameState['tiles']
  spent: number
  placed: number
}

const MAX_UNDO_STEPS = 20

const formatNumber = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 })
const formatDecimal = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 })

function heatLevel(heat: number, capacity: number): 'cool' | 'warm' | 'hot' | 'critical' {
  const ratio = heat / capacity
  if (ratio > 0.82) return 'critical'
  if (ratio > 0.55) return 'hot'
  if (ratio > 0.2) return 'warm'
  return 'cool'
}

function App() {
  const loaded = useMemo(() => loadGame(), [])
  const [game, setGame] = useState<GameState>(loaded.state)
  const [inspectedIndex, setInspectedIndex] = useState<number | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showResearch, setShowResearch] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(true)
  const [toast, setToast] = useState(loaded.recoveredCorruptSave ? 'El guardado no era válido. Se inició una partida segura y se conservó una copia de respaldo.' : loaded.offlineSummary && loaded.offlineSeconds > 2 ? (loaded.offlineSummary.safetyStop ? `Protección offline: planta pausada antes de un incidente tras ${formatNumber.format(loaded.offlineSeconds)}s.` : `Progreso offline ${formatNumber.format(loaded.offlineSeconds)}s · +${formatNumber.format(loaded.offlineSummary.energy)} MW · +₡ ${formatNumber.format(loaded.offlineSummary.credits)}.`) : '')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const importRef = useRef<HTMLTextAreaElement>(null)
  const gameRef = useRef<GameState>(loaded.state)
  const undoStackRef = useRef<PlantHistoryEntry[]>([])
  const [undoDepth, setUndoDepth] = useState(0)
  const buildStrokeRef = useRef<BuildStroke | null>(null)
  const ignoreClickRef = useRef(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setGame((current) => {
        const next = current.paused ? current : simulateMany(current, current.speed)
        gameRef.current = next
        return next
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const finishPointer = (event: PointerEvent) => finishBuildStroke(event.pointerId)
    window.addEventListener('pointerup', finishPointer)
    window.addEventListener('pointercancel', finishPointer)
    return () => {
      window.removeEventListener('pointerup', finishPointer)
      window.removeEventListener('pointercancel', finishPointer)
    }
  }, [])

  useEffect(() => saveGame(game), [game])

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const heat = totalHeat(game)
  const cores = countKind(game, 'core')
  const windTurbines = countKind(game, 'wind')
  const solarPanels = countKind(game, 'solar')
  const generators = countKind(game, 'generator')
  const inspected = inspectedIndex === null ? null : game.tiles[inspectedIndex]
  const selected = COMPONENTS[game.selectedKind]
  const inspectedIsReactor = inspected ? isReactorKind(inspected.kind) : false
  const inspectedHasThermal = inspected ? COMPONENTS[inspected.kind].capacity > 0 : false
  const inspectedHasStorage = inspected?.kind === 'battery'
  const inspectedFuelCapacity = inspected && inspectedIsReactor ? fuelCapacity(game, inspected.kind) : 0
  const inspectedRefuelPrice = inspectedIndex === null ? 0 : refuelPrice(game, inspectedIndex) ?? 0
  const inspectedMaintenancePrice = inspectedIndex === null ? 0 : maintenancePrice(game, inspectedIndex) ?? 0
  const creditValue = energyCreditValue(game)
  const contractComplete = game.activeContract.progress >= game.activeContract.target
  const contractProgress = Math.min(100, game.activeContract.progress / game.activeContract.target * 100)
  const missionSteps = [
    { label: 'Instala una turbina eólica', done: windTurbines > 0 },
    { label: 'Genera 100 MW', done: game.totalEnergy >= 100 },
    { label: 'Instala un panel solar', done: solarPanels > 0 },
    { label: 'Genera 750 MW', done: game.totalEnergy >= 750 },
    { label: 'Instala tu primer núcleo', done: cores > 0 },
    { label: 'Conecta una turbina al calor', done: generators > 0 && cores > 0 },
  ]
  const missionProgress = missionSteps.filter((step) => step.done).length

  function replaceGame(next: GameState) {
    gameRef.current = next
    setGame(next)
  }

  function pushHistory(entry: PlantHistoryEntry) {
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO_STEPS - 1)), entry]
    setUndoDepth(undoStackRef.current.length)
  }

  function clearHistory() {
    undoStackRef.current = []
    setUndoDepth(0)
  }

  function commitPlantAction(update: (current: GameState) => GameState, label: string, creditAdjustment?: number) {
    const before = gameRef.current
    const after = update(before)
    if (after === before) return false
    pushHistory({
      tiles: before.tiles,
      creditAdjustment: creditAdjustment ?? before.credits - after.credits,
      label,
    })
    replaceGame(after)
    return true
  }

  function undoLastAction() {
    const entry = undoStackRef.current.at(-1)
    if (!entry) return
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    setUndoDepth(undoStackRef.current.length)
    replaceGame(restorePlantLayout(gameRef.current, entry.tiles, entry.creditAdjustment))
    setInspectedIndex(null)
    setToast(`${entry.label} deshecho.`)
  }

  function chooseComponent(kind: ComponentKind) {
    const definition = COMPONENTS[kind]
    if (!isComponentUnlocked(gameRef.current, kind)) {
      setToast(`Se desbloquea al producir ${formatNumber.format(definition.unlockEnergy ?? 0)} MW.`)
      return
    }
    setGame((current) => ({ ...current, selectedKind: kind, toolMode: 'build' }))
    setInspectedIndex(null)
  }

  function chooseTool(toolMode: ToolMode) {
    setGame((current) => ({ ...current, toolMode }))
    if (toolMode !== 'inspect') setInspectedIndex(null)
  }

  function interact(index: number) {
    const current = gameRef.current
    if (current.toolMode === 'demolish') {
      const tile = current.tiles[index]
      if (!tile) return
      commitPlantAction((state) => sellTile(state, index), 'Demolición')
      setInspectedIndex(null)
      return
    }
    if (current.toolMode === 'inspect' || current.tiles[index]) {
      setInspectedIndex(index)
      return
    }
    const definition = COMPONENTS[current.selectedKind]
    if (!isComponentUnlocked(current, current.selectedKind)) {
      setToast(`Componente bloqueado hasta ${formatNumber.format(definition.unlockEnergy ?? 0)} MW.`)
      return
    }
    if (current.credits < definition.cost) {
      setToast('Créditos insuficientes.')
      return
    }
    commitPlantAction((state) => placeTile(state, index, state.selectedKind), 'Construcción')
  }

  function placeDuringStroke(index: number) {
    const stroke = buildStrokeRef.current
    if (!stroke || stroke.visited.has(index)) return
    stroke.visited.add(index)
    const current = gameRef.current
    const definition = COMPONENTS[current.selectedKind]
    if (!isComponentUnlocked(current, current.selectedKind)) return
    if (current.tiles[index]) return
    if (current.credits < definition.cost) {
      setToast('Créditos insuficientes para continuar el trazado.')
      return
    }
    const next = placeTile(current, index, current.selectedKind)
    if (next === current) return
    stroke.spent += definition.cost
    stroke.placed += 1
    replaceGame(next)
  }

  function startBuildStroke(event: React.PointerEvent<HTMLButtonElement>, index: number) {
    const current = gameRef.current
    if (current.toolMode !== 'build' || event.button !== 0) return
    ignoreClickRef.current = true
    event.preventDefault()
    if (current.tiles[index]) {
      setInspectedIndex(index)
      window.setTimeout(() => { ignoreClickRef.current = false }, 0)
      return
    }
    buildStrokeRef.current = {
      pointerId: event.pointerId,
      visited: new Set<number>(),
      beforeTiles: current.tiles,
      spent: 0,
      placed: 0,
    }
    placeDuringStroke(index)
  }

  function continueBuildStroke(event: React.PointerEvent<HTMLDivElement>) {
    const stroke = buildStrokeRef.current
    if (!stroke || stroke.pointerId !== event.pointerId) return
    event.preventDefault()
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-cell-index]')
    const index = Number(target?.dataset.cellIndex)
    if (Number.isInteger(index)) placeDuringStroke(index)
  }

  function finishBuildStroke(pointerId: number) {
    const stroke = buildStrokeRef.current
    if (!stroke || stroke.pointerId !== pointerId) return
    buildStrokeRef.current = null
    if (stroke.placed > 0) {
      pushHistory({ tiles: stroke.beforeTiles, creditAdjustment: stroke.spent, label: stroke.placed > 1 ? 'Trazado' : 'Construcción' })
      if (stroke.placed > 1) setToast(`${stroke.placed} piezas construidas. Puedes deshacer el trazado completo.`)
    }
    window.setTimeout(() => { ignoreClickRef.current = false }, 0)
  }

  function handleCellClick(index: number) {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false
      return
    }
    interact(index)
  }

  async function installApp() {
    if (!installPrompt) {
      setToast('En iPhone: Compartir → Agregar a inicio. En Android: menú → Instalar app.')
      return
    }
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  async function copySave() {
    await navigator.clipboard.writeText(exportGame(game))
    setToast('Partida copiada al portapapeles.')
  }

  function restoreSave() {
    const restored = importGame(importRef.current?.value ?? '')
    if (!restored) {
      setToast('El código de guardado no es válido.')
      return
    }
    setGame(restored)
    gameRef.current = restored
    clearHistory()
    setShowMenu(false)
    setToast('Partida importada.')
  }

  function resetGame() {
    if (!window.confirm('¿Reiniciar toda la planta? Esta acción no se puede deshacer.')) return
    clearGame()
    replaceGame(createInitialState())
    clearHistory()
    setInspectedIndex(null)
    setShowMenu(false)
  }

  function research(key: UpgradeKey) {
    const definition = UPGRADES[key]
    const currentLevel = game.upgrades[key]
    if (currentLevel >= definition.maxLevel) {
      setToast('Esta investigación ya está al máximo.')
      return
    }
    if (game.science < upgradeCost(game, key)) {
      setToast('Ciencia insuficiente.')
      return
    }
    setGame((current) => buyUpgrade(current, key))
    setToast(`${definition.name} mejorada.`)
  }

  function toggleInspected() {
    if (inspectedIndex === null || !game.tiles[inspectedIndex]) return
    commitPlantAction((current) => toggleTile(current, inspectedIndex), game.tiles[inspectedIndex]?.enabled ? 'Desactivación' : 'Activación', 0)
  }

  function toggleInspectedAutoRefuel() {
    if (inspectedIndex === null || !game.tiles[inspectedIndex]) return
    commitPlantAction((current) => toggleAutoRefuel(current, inspectedIndex), 'Configuración de recarga', 0)
  }

  function refuelInspected() {
    if (inspectedIndex === null) return
    const next = refuelTile(gameRef.current, inspectedIndex)
    if (next === gameRef.current) {
      setToast(inspectedRefuelPrice === 0 ? 'El combustible ya está completo.' : 'Créditos insuficientes para recargar.')
      return
    }
    replaceGame(next)
    setToast(`Reactor recargado por ₡ ${formatNumber.format(inspectedRefuelPrice)}.`)
  }

  function maintainInspected() {
    if (inspectedIndex === null) return
    const next = maintainTile(gameRef.current, inspectedIndex)
    if (next === gameRef.current) {
      setToast(inspectedMaintenancePrice === 0 ? 'El componente ya está en estado óptimo.' : 'Créditos insuficientes para el mantenimiento.')
      return
    }
    replaceGame(next)
    setToast(`Mantenimiento completado por ₡ ${formatNumber.format(inspectedMaintenancePrice)}.`)
  }

  function toggleInspectedAutoMaintenance() {
    if (inspectedIndex === null || !game.tiles[inspectedIndex]) return
    commitPlantAction((current) => toggleAutoMaintenance(current, inspectedIndex), 'Configuración de mantenimiento', 0)
  }

  function claimActiveContract() {
    const completed = gameRef.current.activeContract
    const next = claimContract(gameRef.current)
    if (next === gameRef.current) return
    replaceGame(next)
    setToast(`Contrato completado: +₡ ${formatNumber.format(completed.rewardCredits)} y +${formatDecimal.format(completed.rewardScience)} RP.`)
  }

  function changeSector(sector: 'coast' | 'desert') {
    const next = switchSector(gameRef.current, sector)
    if (next === gameRef.current) {
      setToast(`El sector desértico se desbloquea a los ${formatNumber.format(DESERT_UNLOCK_ENERGY)} MW.`)
      return
    }
    replaceGame(next)
    clearHistory()
    setInspectedIndex(null)
  }

  function reinvest() {
    if (game.totalEnergy < PRESTIGE_UNLOCK_ENERGY) return
    if (!window.confirm('¿Reinvertir la planta? Se reiniciarán sectores, créditos, ciencia e investigaciones a cambio de una bonificación permanente del 10 %.')) return
    replaceGame(reinvestPlant(gameRef.current))
    clearHistory()
    setInspectedIndex(null)
    setShowMenu(false)
    setToast('Reinversión completada. La producción y el valor energético aumentaron un 10 %.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Nucleus Idle Lab">
          <span className="brand-mark">N</span>
          <div><strong>NUCLEUS</strong><small>IDLE LAB · PROTOTIPO 13</small></div>
        </div>
        <div className="top-actions">
          <button className="icon-button" onClick={installApp} aria-label="Instalar aplicación">↓</button>
          <button className="icon-button research-shortcut" onClick={() => setShowResearch(true)} aria-label="Abrir investigación"><span>⌬</span><small>{formatDecimal.format(game.science)}</small></button>
          <button className="icon-button" onClick={() => setShowMenu(true)} aria-label="Abrir ajustes">•••</button>
        </div>
      </header>

      <section className="stats-strip" aria-label="Estado de la planta">
        <div className="stat"><span>CRÉDITOS</span><strong>₡ {formatNumber.format(game.credits)}</strong><em>{formatDecimal.format(creditValue)} ₡/MW</em></div>
        <div className="stat"><span>ENERGÍA TOTAL</span><strong>{formatNumber.format(game.totalEnergy)} <small>MW</small></strong></div>
        <div className="stat"><span>CIENCIA</span><strong>{formatDecimal.format(game.science)} <small>RP</small></strong></div>
        <div className="stat"><span>CALOR EN RED</span><strong className={heat > 200 ? 'danger-text' : ''}>{formatNumber.format(heat)} <small>°K</small></strong></div>
      </section>

      <main className="workspace">
        <section className="plant-card">
          <div className="section-heading">
            <div><span className="eyebrow">{game.activeSector === 'coast' ? 'SECTOR A-01' : 'SECTOR B-02'}</span><h1>{game.activeSector === 'coast' ? 'Planta costera' : 'Complejo del desierto'}</h1><span className="gesture-hint">{game.activeSector === 'coast' ? 'Baterías +20 % de velocidad' : 'Solar +25 % de producción'} · {game.toolMode === 'build' ? `${selected.icon} ${selected.shortName} · toca o arrastra` : game.toolMode === 'demolish' ? '⌫ Toca una pieza para demoler' : '◎ Toca una pieza para inspeccionar'}</span></div>
            <div className="simulation-controls" aria-label="Controles de simulación">
              <button className={game.paused ? 'active' : ''} onClick={() => setGame((current) => ({ ...current, paused: !current.paused }))}>
                {game.paused ? '▶' : 'Ⅱ'}
              </button>
              {([1, 2, 4] as const).map((speed) => (
                <button key={speed} className={!game.paused && game.speed === speed ? 'active' : ''} onClick={() => setGame((current) => ({ ...current, speed, paused: false }))}>{speed}×</button>
              ))}
            </div>
          </div>

          <div className="sector-tabs" aria-label="Cambiar de sector">
            <button className={game.activeSector === 'coast' ? 'active' : ''} onClick={() => changeSector('coast')}><strong>A-01</strong><span>Costa</span></button>
            <button className={game.activeSector === 'desert' ? 'active' : ''} disabled={!isSectorUnlocked(game, 'desert')} onClick={() => changeSector('desert')}><strong>B-02</strong><span>{isSectorUnlocked(game, 'desert') ? 'Desierto' : `🔒 ${formatNumber.format(DESERT_UNLOCK_ENERGY)} MW`}</span></button>
            <div><span>REINVERSIÓN</span><strong>×{formatDecimal.format(1 + game.prestige * 0.1)}</strong></div>
          </div>

          <div className="grid-scroller">
            <div className={`plant-grid mode-${game.toolMode}`} style={{ gridTemplateColumns: `repeat(${game.cols}, 1fr)` }} onPointerMove={continueBuildStroke}>
              {game.tiles.map((tile, index) => {
                const definition = tile ? COMPONENTS[tile.kind] : null
                const capacity = tile ? componentCapacity(game, tile.kind) : 0
                const hasThermal = capacity > 0
                const level = tile && definition && hasThermal ? heatLevel(tile.heat, capacity) : 'cool'
                return (
                  <button
                    className={`grid-cell ${tile ? `component ${tile.kind} heat-${level} ${tile.flow !== 0 ? 'flow-active' : ''} ${tile.enabled ? '' : 'component-disabled'}` : ''} ${inspectedIndex === index ? 'inspected' : ''}`}
                    key={index}
                    data-cell-index={index}
                    onPointerDown={(event) => startBuildStroke(event, index)}
                    onClick={() => handleCellClick(index)}
                    aria-label={tile ? (hasThermal ? `${definition?.name}, calor ${Math.round(tile.heat)}` : tile.kind === 'battery' ? `${definition?.name}, carga ${formatDecimal.format(tile.charge)} MW` : tile.kind === 'controller' ? `${definition?.name}, prioridad automática` : `${definition?.name}, producción ${definition?.directEnergy ?? 0} MW`) : `Casilla vacía ${index + 1}`}
                  >
                    {tile && definition ? (
                      <>
                        <span className="component-icon">{definition.icon}</span>
                        {tile.flow !== 0 && <span className="flow-indicator">{tile.flow < 0 ? '−' : ''}{Math.round(Math.abs(tile.flow))}</span>}
                        {hasThermal && <span className="heat-meter"><i style={{ width: `${Math.min(100, (tile.heat / capacity) * 100)}%` }} /></span>}
                      </>
                    ) : <span className="cell-plus">+</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="legend">
            <span><i className="legend-dot stable" /> Estable</span>
            <span><i className="legend-dot warning" /> Caliente</span>
            <span><i className="legend-dot danger" /> Crítico</span>
          </div>
        </section>

        <aside className="side-panel">
          <section className="panel mission-panel">
            <div className="mission-heading"><div><span className="eyebrow">PROTOCOLO DE ARRANQUE</span><h2>{missionProgress === missionSteps.length ? 'Protocolo completado' : 'Primer circuito'}</h2></div><button aria-expanded={tutorialOpen} aria-label={tutorialOpen ? 'Ocultar tutorial' : 'Mostrar tutorial'} onClick={() => setTutorialOpen((open) => !open)}>{tutorialOpen ? '−' : '+'}</button></div>
            <div className="mission-progress" role="progressbar" aria-label="Progreso del tutorial" aria-valuemin={0} aria-valuemax={missionSteps.length} aria-valuenow={missionProgress}><i style={{ width: `${missionProgress / missionSteps.length * 100}%` }} /></div>
            {tutorialOpen && <><p>{missionProgress === missionSteps.length ? 'Ya dominas el arranque. Puedes ocultar este panel y seguir expandiendo la red.' : isComponentUnlocked(game, 'core') ? 'La ingeniería térmica ya está disponible. Construye un circuito estable.' : 'Comienza con energía renovable. El calor y la refrigeración se desbloquean más adelante.'}</p>
              <div className="mission-list">
                {missionSteps.map((step, index) => (
                  <div className={step.done ? 'mission done' : 'mission'} key={step.label}>
                    <span>{step.done ? '✓' : index + 1}</span>{step.label}
                  </div>
                ))}
              </div></>}
          </section>

          <section className={`panel contract-panel ${contractComplete ? 'complete' : ''}`}>
            <div className="contract-heading"><span className="eyebrow">CONTRATO #{game.contractsCompleted + 1}</span><span>{game.activeContract.kind === 'renewable' ? 'RENOVABLE' : game.activeContract.kind === 'thermal' ? 'TÉRMICO' : 'GENERAL'}</span></div>
            <h2>{game.activeContract.title}</h2>
            <p>{game.activeContract.description}</p>
            <div className="contract-values"><strong>{formatNumber.format(game.activeContract.progress)} / {formatNumber.format(game.activeContract.target)} MW</strong><span>₡ {formatNumber.format(game.activeContract.rewardCredits)} · {formatDecimal.format(game.activeContract.rewardScience)} RP</span></div>
            <div className="contract-bar" role="progressbar" aria-label="Progreso del contrato" aria-valuemin={0} aria-valuemax={game.activeContract.target} aria-valuenow={game.activeContract.progress}><i style={{ width: `${contractProgress}%` }} /></div>
            <button disabled={!contractComplete} onClick={claimActiveContract}>{contractComplete ? 'Reclamar recompensa' : 'Contrato en progreso'}</button>
          </section>

          <section className="panel inspector-panel">
            <span className="eyebrow">{inspected ? 'COMPONENTE' : 'HERRAMIENTA ACTIVA'}</span>
            <div className="inspector-title">
              <span className={`large-icon ${inspected?.kind ?? selected.kind}`}>{inspected ? COMPONENTS[inspected.kind].icon : selected.icon}</span>
              <div><h2>{inspected ? COMPONENTS[inspected.kind].name : selected.name}</h2><small>{inspected ? `Casilla ${(inspectedIndex ?? 0) + 1}` : `Coste ₡ ${selected.cost}`}</small></div>
            </div>
            <p>{inspected ? COMPONENTS[inspected.kind].description : selected.description}</p>
            {inspected && inspectedHasThermal && (
              <div className="thermal-readout">
                <div><span>CALOR</span><strong>{Math.round(inspected.heat)} / {componentCapacity(game, inspected.kind)}</strong></div>
                <div className="readout-bar"><i style={{ width: `${Math.min(100, inspected.heat / componentCapacity(game, inspected.kind) * 100)}%` }} /></div>
                <div className="flow-readout"><span>FLUJO ÚLTIMO CICLO</span><strong>{Math.round(inspected.flow)}</strong></div>
                {inspectedIsReactor && <><div className="fuel-readout"><span>COMBUSTIBLE</span><strong>{Math.round(inspected.fuel)} / {inspectedFuelCapacity}</strong></div><div className="fuel-bar"><i style={{ width: `${Math.min(100, inspected.fuel / inspectedFuelCapacity * 100)}%` }} /></div></>}
              </div>
            )}
            {inspected && typeof COMPONENTS[inspected.kind].directEnergy === 'number' && <div className="direct-readout"><span>PRODUCCIÓN DIRECTA</span><strong>{COMPONENTS[inspected.kind].directEnergy ?? 0} MW / CICLO</strong><small>Sin calor ni refrigeración</small></div>}
            {inspected && inspectedHasStorage && <div className="storage-readout"><div><span>CARGA</span><strong>{formatDecimal.format(inspected.charge)} / {formatNumber.format(storageCapacity(game))} MW</strong></div><div className="storage-bar"><i style={{ width: `${Math.min(100, inspected.charge / storageCapacity(game) * 100)}%` }} /></div><small>{inspected.flow > 0 ? `Cargando ${formatDecimal.format(inspected.flow)} MW` : inspected.flow < 0 ? `Entregando ${formatDecimal.format(-inspected.flow)} MW` : 'En espera'}</small></div>}
            {inspected?.kind === 'controller' && <div className="automation-readout"><strong>PRIORIDAD AUTOMÁTICA ACTIVA</strong><span>Reserva excedentes sobre 10 MW y usa baterías para cubrir el déficit.</span></div>}
            {inspected && <div className="condition-readout"><div><span>ESTADO</span><strong>{formatDecimal.format(inspected.condition)} %</strong></div><div className="condition-bar"><i style={{ width: `${inspected.condition}%` }} /></div><small>Rendimiento {formatNumber.format(conditionEfficiency(inspected) * 100)} % · baja solo bajo 50 %</small></div>}
            {inspected && <button className="component-toggle" onClick={toggleInspected}>{inspected.enabled ? 'Desactivar componente' : 'Activar componente'}</button>}
            {inspected && inspectedIsReactor && <div className="fuel-actions"><button onClick={toggleInspectedAutoRefuel}>{inspected.autoRefuel ? 'Recarga automática: sí' : 'Recarga automática: no'}</button><button disabled={inspectedRefuelPrice === 0 || game.credits < inspectedRefuelPrice} onClick={refuelInspected}>Recargar · ₡ {formatNumber.format(inspectedRefuelPrice)}</button></div>}
            {inspected && <div className="maintenance-actions"><button onClick={toggleInspectedAutoMaintenance}>{inspected.autoMaintain ? 'Mantenimiento auto: sí' : 'Mantenimiento auto: no'}</button><button disabled={inspectedMaintenancePrice === 0 || game.credits < inspectedMaintenancePrice} onClick={maintainInspected}>Mantener · ₡ {formatNumber.format(inspectedMaintenancePrice)}</button></div>}
          </section>

          <section className="panel telemetry">
            <div><span>Ciclos simulados</span><strong>{formatNumber.format(game.tick)}</strong></div>
            <div><span>Incidentes</span><strong className={game.explosions ? 'danger-text' : ''}>{game.explosions}</strong></div>
            <div><span>Combustible gastado</span><strong>₡ {formatNumber.format(game.totalFuelSpent)}</strong></div>
            <div><span>Mantenimiento</span><strong>₡ {formatNumber.format(game.totalMaintenanceSpent)}</strong></div>
          </section>
        </aside>
      </main>

      {inspected && (
        <section className="mobile-inspector" aria-label="Detalle del componente">
          <span className={`large-icon ${inspected.kind}`}>{COMPONENTS[inspected.kind].icon}</span>
          <div className="mobile-inspector-copy">
            <strong>{COMPONENTS[inspected.kind].name}</strong>
            {inspectedHasThermal ? <span>Calor {Math.round(inspected.heat)} / {componentCapacity(game, inspected.kind)}</span> : inspectedHasStorage ? <span>Batería {formatDecimal.format(inspected.charge)} / {formatNumber.format(storageCapacity(game))} MW</span> : inspected.kind === 'controller' ? <span>Prioridad automática de 10 MW</span> : <span>Producción {COMPONENTS[inspected.kind].directEnergy ?? 0} MW / ciclo</span>}
            {inspectedIsReactor && <span>Combustible {Math.round(inspected.fuel)} / {inspectedFuelCapacity}</span>}
            <span>Estado {formatDecimal.format(inspected.condition)} % · rendimiento {formatNumber.format(conditionEfficiency(inspected) * 100)} %</span>
            {inspectedHasThermal && <div className="readout-bar"><i style={{ width: `${Math.min(100, inspected.heat / componentCapacity(game, inspected.kind) * 100)}%` }} /></div>}
            {inspectedIsReactor && <button className="mobile-refuel" disabled={inspectedRefuelPrice === 0 || game.credits < inspectedRefuelPrice} onClick={refuelInspected}>Recargar · ₡ {formatNumber.format(inspectedRefuelPrice)}</button>}
            <button className="mobile-maintain" disabled={inspectedMaintenancePrice === 0 || game.credits < inspectedMaintenancePrice} onClick={maintainInspected}>Mantener · ₡ {formatNumber.format(inspectedMaintenancePrice)}</button>
          </div>
          <button className={`mobile-power ${inspected.enabled ? '' : 'off'}`} onClick={toggleInspected} aria-label={inspected.enabled ? 'Desactivar componente' : 'Activar componente'}>⏻</button>
          {inspectedIsReactor && <button className={`mobile-auto-refuel ${inspected.autoRefuel ? '' : 'off'}`} onClick={toggleInspectedAutoRefuel} aria-label={inspected.autoRefuel ? 'Desactivar recarga automática' : 'Activar recarga automática'}>⟳</button>}
          <button className={`mobile-auto-maintain ${inspected.autoMaintain ? '' : 'off'}`} onClick={toggleInspectedAutoMaintenance} aria-label={inspected.autoMaintain ? 'Desactivar mantenimiento automático' : 'Activar mantenimiento automático'}>⚙</button>
          <button className="inspector-close" onClick={() => setInspectedIndex(null)} aria-label="Cerrar detalle">×</button>
        </section>
      )}

      <nav className="build-dock" aria-label="Herramientas de construcción">
        <div className="tool-modes">
          <button aria-pressed={game.toolMode === 'inspect'} className={game.toolMode === 'inspect' ? 'active' : ''} onClick={() => chooseTool('inspect')}><span>◎</span>Inspeccionar</button>
          <button aria-pressed={game.toolMode === 'demolish'} className={game.toolMode === 'demolish' ? 'active danger' : ''} onClick={() => chooseTool('demolish')}><span>⌫</span>Demoler</button>
          <button className="undo-tool" disabled={undoDepth === 0} onClick={undoLastAction} aria-label={undoDepth ? `Deshacer última acción, ${undoDepth} disponibles` : 'No hay acciones para deshacer'}><span>↶</span>Deshacer{undoDepth > 0 && <small>{undoDepth}</small>}</button>
        </div>
        <div className="component-palette">
          {COMPONENT_ORDER.map((kind) => {
            const definition = COMPONENTS[kind]
            const unlocked = isComponentUnlocked(game, kind)
            return (
              <button key={kind} disabled={!unlocked} aria-label={unlocked ? `${definition.icon} ${definition.shortName} ₡ ${definition.cost}` : `${definition.shortName} bloqueado hasta ${formatNumber.format(definition.unlockEnergy ?? 0)} MW`} aria-pressed={game.toolMode === 'build' && game.selectedKind === kind} className={`${game.toolMode === 'build' && game.selectedKind === kind ? 'active ' : ''}${unlocked ? '' : 'locked '}palette-card ${kind}`} onClick={() => chooseComponent(kind)}>
                <span className="palette-icon">{definition.icon}</span>
                <span><strong>{definition.shortName}</strong><small>{unlocked ? `₡ ${definition.cost}` : `🔒 ${formatNumber.format(definition.unlockEnergy ?? 0)} MW`}</small></span>
              </button>
            )
          })}
        </div>
      </nav>

      {showResearch && (
        <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && setShowResearch(false)}>
          <section className="settings-sheet research-sheet" role="dialog" aria-modal="true" aria-label="Investigación">
            <div className="sheet-handle" />
            <div className="sheet-heading"><div><span className="eyebrow">LABORATORIO</span><h2>Investigación térmica</h2></div><button className="icon-button" onClick={() => setShowResearch(false)} aria-label="Cerrar investigación">×</button></div>
            <div className="research-balance"><span>CIENCIA DISPONIBLE</span><strong>{formatDecimal.format(game.science)} <small>RP</small></strong><p>Las turbinas producen 0,05 RP por cada MW generado.</p></div>
            <div className="upgrade-list">
              {UPGRADE_ORDER.map((key) => {
                const definition = UPGRADES[key]
                const level = game.upgrades[key]
                const cost = upgradeCost(game, key)
                const maxed = level >= definition.maxLevel
                return (
                  <article className="upgrade-card" key={key}>
                    <span className="upgrade-icon">{definition.icon}</span>
                    <div className="upgrade-copy">
                      <div><strong>{definition.name}</strong><span>NIVEL {level}/{definition.maxLevel}</span></div>
                      <p>{definition.description}</p>
                      <div className="level-pips" aria-label={`Nivel ${level} de ${definition.maxLevel}`}>
                        {Array.from({ length: definition.maxLevel }, (_, index) => <i className={index < level ? 'filled' : ''} key={index} />)}
                      </div>
                    </div>
                    <button className="upgrade-buy" disabled={maxed || game.science < cost} onClick={() => research(key)}>{maxed ? 'MÁX.' : `${cost} RP`}</button>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {showMenu && (
        <div className="modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && setShowMenu(false)}>
          <section className="settings-sheet" role="dialog" aria-modal="true" aria-label="Ajustes y guardado">
            <div className="sheet-handle" />
            <div className="sheet-heading"><div><span className="eyebrow">SISTEMA</span><h2>Guardado y acceso</h2></div><button className="icon-button" onClick={() => setShowMenu(false)}>×</button></div>
            <p>La partida se guarda automáticamente en este dispositivo. Copia el código para moverla a otro teléfono.</p>
            <button className="primary-button" onClick={copySave}>Copiar código de partida</button>
            <label className="import-field">IMPORTAR CÓDIGO<textarea ref={importRef} placeholder="Pega aquí tu código…" /></label>
            <button className="secondary-button" onClick={restoreSave}>Importar partida</button>
            <div className="prestige-panel"><span className="eyebrow">REINVERSIÓN · NIVEL {game.prestige}</span><h3>Rediseño permanente</h3><p>Reinicia la progresión a cambio de +10 % permanente a generación renovable y valor de cada MW.</p><button className="prestige-button" disabled={game.totalEnergy < PRESTIGE_UNLOCK_ENERGY} onClick={reinvest}>{game.totalEnergy >= PRESTIGE_UNLOCK_ENERGY ? 'Reinvertir planta' : `Disponible a ${formatNumber.format(PRESTIGE_UNLOCK_ENERGY)} MW`}</button></div>
            <button className="text-button danger-text" onClick={resetGame}>Reiniciar progreso</button>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

export default App
