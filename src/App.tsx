import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ECONOMY, TECH_ORDER } from './game/balance'
import { COMPONENT_ORDER, COMPONENTS } from './game/catalog'
import { canAfford, hasInfiniteMoney, resetDebugTuning, withDebugSettings } from './game/debug'
import { buyDesertSector, createInitialState, isComponentUnlocked, isComponentVisible, placeTile, refuelPrice, refuelTile, repairPrice, repairTile, restorePlantLayout, sectorEnergyStored, sellStoredEnergy, sellTile, simulateMany, switchSector, toggleTile, totalHeat, usesAutonomy } from './game/engine'
import { clearGame, exportGame, importGame, loadGame, saveGame } from './game/persistence'
import { clearTutorialDone, isPristineGame } from './game/tutorial'
import { canUnlockTech, maxUpgradeLevel, unlockAutoRebuild, unlockTech, upgradeBuildingTrack, upgradeCost, upgradeLevel, upgradeTracks } from './game/research'
import { COAST_BUILDABLE_SET, CYBERPUNK_BUILDABLE_SET } from './game/terrain'
import type { ComponentKind, GameState, SectorKey, TechKey, ToolMode, UpgradeTrack } from './game/types'
import { Dock, type DockTab } from './ui/Dock'
import { formatDecimal, formatNumber } from './ui/format'
import { Hud } from './ui/Hud'
import { buildIsland, environmentFor } from './ui/island'
import { MapViewport } from './ui/MapViewport'
import { CYBERPUNK_ENVIRONMENT } from './ui/pixel/cyberpunk'
import { environmentStyle, Sprite, SpriteDefs } from './ui/pixel/Sprite'
import { ENVIRONMENTS } from './ui/pixel/sprites'
import { DebugSheet } from './ui/sheets/DebugSheet'
import { InspectorSheet } from './ui/sheets/InspectorSheet'
import { ManualSheet } from './ui/sheets/ManualSheet'
import { MenuSheet } from './ui/sheets/MenuSheet'
import { ResearchSheet } from './ui/sheets/ResearchSheet'
import { UpgradesSheet } from './ui/sheets/UpgradesSheet'
import { Tutorial, type TutorialProgress } from './ui/tutorial/Tutorial'
import { useTutorial } from './ui/tutorial/useTutorial'

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
interface HistoryEntry { tiles: GameState['tiles']; creditAdjustment: number; label: string }
interface BuildStroke { pointerId: number; visited: Set<number>; beforeTiles: GameState['tiles']; spent: number; placed: number }
const MAX_UNDO_STEPS = 20

function App() {
  const loaded = useMemo(() => loadGame(), [])
  const [game, setGame] = useState<GameState>(loaded.state)
  const [inspectedIndex, setInspectedIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<DockTab | null>(null)
  const [buildFocus, setBuildFocus] = useState(false)
  const [toast, setToast] = useState(loaded.recoveredCorruptSave ? 'El guardado v2 no era válido; se conservó una copia y se inició una partida segura.' : loaded.offlineSummary && loaded.offlineSeconds > 2 ? `Progreso offline ${formatNumber(loaded.offlineSeconds)}s · +${formatDecimal(loaded.offlineSummary.sold)} E vendidas · +₡ ${formatDecimal(loaded.offlineSummary.credits)} · +${formatDecimal(loaded.offlineSummary.research)} RP.` : '')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const importRef = useRef<HTMLTextAreaElement>(null)
  const gameRef = useRef(game)
  const historyRef = useRef<HistoryEntry[]>([])
  const [undoDepth, setUndoDepth] = useState(0)
  const strokeRef = useRef<BuildStroke | null>(null)
  const ignoreClickRef = useRef(false)
  const tutorial = useTutorial(useMemo(() => isPristineGame(loaded.state), [loaded.state]))
  const buildPanelOpen = activeTab === 'build'
  const armed = buildPanelOpen && (buildFocus || game.toolMode === 'demolish')
  const armedRef = useRef(armed); armedRef.current = armed
  const buildPanelOpenRef = useRef(buildPanelOpen); buildPanelOpenRef.current = buildPanelOpen
  const buildFocusRef = useRef(buildFocus); buildFocusRef.current = buildFocus

  const windBuilt = game.tiles.some((tile) => tile?.kind === 'wind')
  const tutorialProgress: TutorialProgress = { buildOpen: activeTab === 'build', windSelected: buildFocus && game.selectedKind === 'wind', windBuilt }
  const tutorialStepRef = useRef(tutorial.step?.id)
  tutorialStepRef.current = tutorial.step?.id

  // Solo durante el tutorial: al levantar la primera turbina se sale del modo construir.
  useEffect(() => { if (windBuilt && tutorialStepRef.current === 'place') closeSheet() }, [windBuilt])

  useEffect(() => { const timer = window.setInterval(() => setGame((current) => { const next = current.paused ? current : simulateMany(current, current.speed); gameRef.current = next; return next }), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { const finish = (event: PointerEvent) => finishBuildStroke(event.pointerId); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish); return () => { window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', finish) } }, [])
  useEffect(() => saveGame(game), [game])
  useEffect(() => { gameRef.current = game }, [game])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer) }, [toast])
  useEffect(() => { const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent) }; window.addEventListener('beforeinstallprompt', handler); return () => window.removeEventListener('beforeinstallprompt', handler) }, [])

  const environment = environmentFor(game)
  const environmentDefinition = environment === 'futuristic' ? CYBERPUNK_ENVIRONMENT : ENVIRONMENTS[environment]
  const activeBuildableSet = game.activeSector === 'coast' ? COAST_BUILDABLE_SET : CYBERPUNK_BUILDABLE_SET
  const extraOccupiedIndices = game.tiles.flatMap((tile, index) => tile && !activeBuildableSet.has(index) ? [index] : [])
  const extraOccupiedSignature = extraOccupiedIndices.join(',')
  const island = useMemo(() => buildIsland(game.rows, game.cols, game.activeSector, extraOccupiedIndices), [game.rows, game.cols, game.activeSector, extraOccupiedSignature])
  const heat = totalHeat(game)
  const inspectedRefuel = inspectedIndex === null ? 0 : refuelPrice(game, inspectedIndex) ?? 0
  const inspectedRepair = inspectedIndex === null ? 0 : repairPrice(game, inspectedIndex) ?? 0
  const affordableTechs = TECH_ORDER.filter((key) => canUnlockTech(game, key)).length
  const affordableUpgrades = COMPONENT_ORDER.filter((kind) => isComponentUnlocked(game, kind) && isComponentVisible(game, kind)).flatMap((kind) => upgradeTracks(kind).map((track) => ({ kind, track }))).filter(({ kind, track }) => upgradeLevel(game, kind, track) < maxUpgradeLevel(game) && canAfford(game, upgradeCost(game, kind, track))).length

  function replaceGame(next: GameState) { gameRef.current = next; setGame(next) }
  function pushHistory(entry: HistoryEntry) { historyRef.current = [...historyRef.current.slice(-(MAX_UNDO_STEPS - 1)), entry]; setUndoDepth(historyRef.current.length) }
  function clearHistory() { historyRef.current = []; setUndoDepth(0) }
  function commit(update: (state: GameState) => GameState, label: string, creditAdjustment?: number) { const before = gameRef.current; const after = update(before); if (after === before) return false; pushHistory({ tiles: before.tiles, creditAdjustment: creditAdjustment ?? before.credits - after.credits, label }); replaceGame(after); return true }
  function undo() { const entry = historyRef.current.at(-1); if (!entry) return; historyRef.current = historyRef.current.slice(0, -1); setUndoDepth(historyRef.current.length); replaceGame(restorePlantLayout(gameRef.current, entry.tiles, entry.creditAdjustment)); setInspectedIndex(null); setToast(`${entry.label} deshecho.`) }
  function openTab(tab: DockTab) { if (activeTab === tab) { setActiveTab(null); if (tab === 'inspector') setInspectedIndex(null); return } setActiveTab(tab); if (tab === 'build') setGame((current) => ({ ...current, toolMode: 'build' })); if (tab === 'inspector') setGame((current) => ({ ...current, toolMode: 'inspect' })) }
  function closeSheet() { setActiveTab(null); setInspectedIndex(null); setBuildFocus(false); setGame((current) => current.toolMode === 'inspect' ? current : ({ ...current, toolMode: 'inspect' })) }
  function inspect(index: number) { setInspectedIndex(index); setActiveTab('inspector') }
  function chooseComponent(kind: ComponentKind) { if (!isComponentUnlocked(gameRef.current, kind)) { setToast('Esta pieza requiere investigación previa.'); return } setGame((current) => ({ ...current, selectedKind: kind, toolMode: 'build' })); setBuildFocus(true) }
  function chooseTool(toolMode: ToolMode) { setGame((current) => ({ ...current, toolMode })) }
  function interact(index: number) { const current = gameRef.current; const tile = current.tiles[index]; if (!buildPanelOpenRef.current) { if (tile) inspect(index); return } if (!armedRef.current) return; if (current.toolMode === 'demolish') { if (tile) commit((state) => sellTile(state, index), 'Demolición'); return } if (tile) { const expired = usesAutonomy(tile.kind) && tile.fuel <= 0; if (!expired) return; if (tile.kind !== current.selectedKind) { setToast(`La casilla contiene ${COMPONENTS[tile.kind].shortName} caducada. Reconstruye el mismo tipo o demuélela.`); return } if (!canAfford(current, COMPONENTS[tile.kind].cost)) { setToast('Créditos insuficientes para reconstruir.'); return } commit((state) => placeTile(state, index, state.selectedKind), 'Reconstrucción'); return } const def = COMPONENTS[current.selectedKind]; if (!isComponentUnlocked(current, current.selectedKind)) return; if (!canAfford(current, def.cost)) { setToast('Créditos insuficientes.'); return } commit((state) => placeTile(state, index, state.selectedKind), 'Construcción') }
  function placeDuringStroke(index: number) { const stroke = strokeRef.current; if (!stroke || stroke.visited.has(index)) return; stroke.visited.add(index); const current = gameRef.current; const def = COMPONENTS[current.selectedKind]; const existing = current.tiles[index]; const rebuildable = existing?.kind === current.selectedKind && usesAutonomy(existing.kind) && existing.fuel <= 0; if ((existing && !rebuildable) || !isComponentUnlocked(current, current.selectedKind) || !canAfford(current, def.cost)) return; const next = placeTile(current, index, current.selectedKind); if (next === current) return; stroke.spent += hasInfiniteMoney(current) ? 0 : def.cost; stroke.placed += 1; replaceGame(next) }
  function startBuildStroke(event: ReactPointerEvent<HTMLButtonElement>, index: number) { const current = gameRef.current; if (!buildFocusRef.current || !armedRef.current || current.toolMode !== 'build' || event.button !== 0) return; ignoreClickRef.current = true; event.preventDefault(); strokeRef.current = { pointerId: event.pointerId, visited: new Set(), beforeTiles: current.tiles, spent: 0, placed: 0 }; placeDuringStroke(index) }
  function continueBuildStroke(event: ReactPointerEvent<HTMLDivElement>) { const stroke = strokeRef.current; if (!stroke || stroke.pointerId !== event.pointerId) return; event.preventDefault(); const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-cell-index]'); const index = Number(target?.dataset.cellIndex); if (Number.isInteger(index)) placeDuringStroke(index) }
  function finishBuildStroke(pointerId: number) { const stroke = strokeRef.current; if (!stroke || stroke.pointerId !== pointerId) return; strokeRef.current = null; if (stroke.placed) pushHistory({ tiles: stroke.beforeTiles, creditAdjustment: stroke.spent, label: stroke.placed > 1 ? 'Trazado' : 'Construcción' }); setTimeout(() => { ignoreClickRef.current = false }, 0) }
  function handleCellClick(index: number) { if (ignoreClickRef.current) { ignoreClickRef.current = false; return } interact(index) }

  async function installApp() { if (!installPrompt) { setToast('En iPhone: Compartir → Agregar a inicio. En Android: menú → Instalar app.'); return } await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null) }
  async function copySave() { await navigator.clipboard.writeText(exportGame(game)); setToast('Partida v2 copiada.') }
  function restoreSave() { const restored = importGame(importRef.current?.value ?? ''); if (!restored) { setToast('Código incompatible o inválido; solo se admiten partidas v2.'); return } replaceGame(restored); clearHistory(); closeSheet(); setToast('Partida importada.') }
  function resetGame() { if (!window.confirm('¿Reiniciar toda la planta v2?')) return; const debug = gameRef.current.debug; clearGame(); clearTutorialDone(); replaceGame(createInitialState(debug)); clearHistory(); closeSheet(); tutorial.restart() }
  function changeDebug(settings: GameState['debug']) { const changed = withDebugSettings(gameRef.current, settings); replaceGame(isComponentUnlocked(changed, changed.selectedKind) ? changed : { ...changed, selectedKind: 'wind', toolMode: 'build' }) }
  function toggleDebug() { const current = gameRef.current.debug; changeDebug({ ...current, enabled: !current.enabled }) }
  function resetDebug() { changeDebug(resetDebugTuning(gameRef.current.debug)); setToast('Valores Debug restaurados al balance oficial.') }
  function research(key: TechKey) { const next = unlockTech(gameRef.current, key); if (next === gameRef.current) return; replaceGame(next); setToast('Tecnología desbloqueada.') }
  function upgrade(kind: ComponentKind, track: UpgradeTrack) { const price = upgradeCost(gameRef.current, kind, track); const next = upgradeBuildingTrack(gameRef.current, kind, track); if (next === gameRef.current) { setToast('Créditos insuficientes o nivel máximo.'); return } replaceGame(next); setToast(`${COMPONENTS[kind].name}: mejora aplicada a este mapa por ₡ ${formatNumber(price)}.`) }
  function sellEnergy() { const stored = sectorEnergyStored(gameRef.current); const next = sellStoredEnergy(gameRef.current); if (next === gameRef.current) return; replaceGame(next); setToast(`${formatDecimal(stored)} E vendidas por ₡ ${formatDecimal(stored)}.`) }
  function toggleInspected() { if (inspectedIndex !== null) commit((state) => toggleTile(state, inspectedIndex), 'Activación', 0) }
  function refuelInspected() { if (inspectedIndex === null) return; const next = refuelTile(gameRef.current, inspectedIndex); if (next === gameRef.current) { setToast(inspectedRefuel ? 'Créditos insuficientes.' : 'El edificio todavía está en operación.'); return } replaceGame(next); setToast(`Edificio reconstruido por ₡ ${formatNumber(inspectedRefuel)}.`) }
  function researchAutoRebuild(kind: ComponentKind) { const next = unlockAutoRebuild(gameRef.current, kind); if (next === gameRef.current) { setToast('RP insuficientes o automatización ya activa.'); return } replaceGame(next); setToast(`Auto rebuild de ${COMPONENTS[kind].shortName} activado.`) }
  function repairInspected() { if (inspectedIndex === null) return; const next = repairTile(gameRef.current, inspectedIndex); if (next === gameRef.current) { setToast('Créditos insuficientes.'); return } replaceGame(next); setToast(`Pieza reparada por ₡ ${formatNumber(inspectedRepair)}.`) }
  function sellInspected() { if (inspectedIndex !== null) { commit((state) => sellTile(state, inspectedIndex), 'Demolición'); setInspectedIndex(null) } }
  function changeSector(sector: SectorKey) { const next = switchSector(gameRef.current, sector); if (next === gameRef.current) return; replaceGame(next); clearHistory(); closeSheet() }
  function buySector() { const next = buyDesertSector(gameRef.current); if (next === gameRef.current) { setToast('Aún no cumples los requisitos de expansión.'); return } replaceGame(next); setToast('Distrito Neón adquirido.') }

  return <div className={`app env-${environment}`} style={environmentStyle(environmentDefinition)}><SpriteDefs />
    <MapViewport game={game} island={island} decoration={environmentDefinition.decoration} armed={armed} toolMode={game.toolMode} selectedKind={game.selectedKind} inspectedIndex={inspectedIndex} minimalUi={buildFocus} onCellPointerDown={startBuildStroke} onCellClick={handleCellClick} onGridPointerMove={continueBuildStroke} />
    {!buildFocus && <Hud game={game} heat={heat} showHeat={game.unlockedTechs.thermal} onSellEnergy={sellEnergy} onOpenMenu={() => openTab('menu')} />}
    {buildFocus && <div className="build-toolbar">
      <button className="build-back frame" onClick={closeSheet} aria-label="Terminar construcción">✓ Terminar</button>
      <div className="build-budget frame" aria-label={`Precio ${COMPONENTS[game.selectedKind].cost} créditos; saldo ${hasInfiniteMoney(game) ? 'infinito' : formatNumber(game.credits)} créditos`}>
        <span><small>PRECIO</small><strong><Sprite name="icon-coin" size={13} />{formatNumber(COMPONENTS[game.selectedKind].cost)}</strong></span>
        <i aria-hidden="true" />
        <span><small>SALDO</small><strong><Sprite name="icon-coin" size={13} />{hasInfiniteMoney(game) ? '∞' : formatNumber(game.credits)}</strong></span>
      </div>
    </div>}
    {activeTab === 'inspector' && <InspectorSheet game={game} index={inspectedIndex} refuelPrice={inspectedRefuel} repairPrice={inspectedRepair} onClose={closeSheet} onToggle={toggleInspected} onRefuel={refuelInspected} onRepair={repairInspected} onSell={sellInspected} />}
    {activeTab === 'upgrades' && <UpgradesSheet game={game} onClose={closeSheet} onUpgrade={upgrade} />}
    {activeTab === 'lab' && <ResearchSheet game={game} onClose={closeSheet} onResearch={research} onAutoRebuild={researchAutoRebuild} />}
    {activeTab === 'manual' && <ManualSheet game={game} onClose={closeSheet} />}
    {activeTab === 'menu' && <MenuSheet game={game} importRef={importRef} onClose={closeSheet} onSector={changeSector} onBuySector={buySector} onTogglePause={() => setGame((current) => ({ ...current, paused: !current.paused }))} onSpeed={(speed) => setGame((current) => ({ ...current, speed, paused: false }))} onInstall={installApp} onCopySave={copySave} onImport={restoreSave} onReset={resetGame} onToggleDebug={toggleDebug} onOpenDebug={() => setActiveTab('debug')} />}
    {activeTab === 'debug' && <DebugSheet game={game} onClose={closeSheet} onChange={changeDebug} onSetCredits={(credits) => replaceGame({ ...gameRef.current, credits })} onSetResearch={(researchPoints) => replaceGame({ ...gameRef.current, researchPoints })} onReset={resetDebug} />}
    {!buildFocus && <Dock game={game} activeTab={activeTab} buildFocus={buildFocus} onTab={openTab} onCloseBuild={closeSheet} onChooseComponent={chooseComponent} onChooseTool={chooseTool} labBadge={affordableTechs} upgradesBadge={affordableUpgrades} />}
    {tutorial.step && <Tutorial step={tutorial.step} game={game} progress={tutorialProgress} onNext={tutorial.next} onFinish={tutorial.finish} />}
    {toast && <div className="toast frame" role="status">{toast}</div>}
  </div>
}
export default App
