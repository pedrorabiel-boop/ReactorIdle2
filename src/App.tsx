import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { TECH_ORDER } from './game/balance'
import { COMPONENT_ORDER, COMPONENTS } from './game/catalog'
import { buyDesertSector, claimContract, countKind, createInitialState, isComponentUnlocked, isComponentVisible, placeTile, refuelPrice, refuelTile, repairPrice, repairTile, restorePlantLayout, sellStoredEnergy, sellTile, simulateMany, switchSector, toggleTile, totalHeat, usesAutonomy } from './game/engine'
import { clearGame, exportGame, importGame, loadGame, saveGame } from './game/persistence'
import { canUnlockTech, unlockAutoRebuild, unlockTech, upgradeBuildingTrack, upgradeCost, upgradeLevel, upgradeTracks } from './game/research'
import type { ComponentKind, GameState, SectorKey, TechKey, ToolMode, UpgradeTrack } from './game/types'
import { Dock, type DockTab } from './ui/Dock'
import { formatDecimal, formatNumber } from './ui/format'
import { Hud } from './ui/Hud'
import { buildIsland, environmentFor } from './ui/island'
import { MapViewport } from './ui/MapViewport'
import { environmentStyle, SpriteDefs } from './ui/pixel/Sprite'
import { ENVIRONMENTS } from './ui/pixel/sprites'
import { ContractsSheet } from './ui/sheets/ContractsSheet'
import { InspectorSheet } from './ui/sheets/InspectorSheet'
import { MenuSheet } from './ui/sheets/MenuSheet'
import { ResearchSheet } from './ui/sheets/ResearchSheet'
import { UpgradesSheet } from './ui/sheets/UpgradesSheet'

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
interface HistoryEntry { tiles: GameState['tiles']; creditAdjustment: number; label: string }
interface BuildStroke { pointerId: number; visited: Set<number>; beforeTiles: GameState['tiles']; spent: number; placed: number }
const MAX_UNDO_STEPS = 20

function App() {
  const loaded = useMemo(() => loadGame(), [])
  const [game, setGame] = useState<GameState>(loaded.state)
  const [inspectedIndex, setInspectedIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<DockTab | null>(null)
  const [toast, setToast] = useState(loaded.recoveredCorruptSave ? 'El guardado v2 no era válido; se conservó una copia y se inició una partida segura.' : loaded.offlineSummary && loaded.offlineSeconds > 2 ? `Progreso offline ${formatNumber(loaded.offlineSeconds)}s · +${formatDecimal(loaded.offlineSummary.sold)} E vendidas · +₡ ${formatDecimal(loaded.offlineSummary.credits)} · +${formatDecimal(loaded.offlineSummary.research)} RP.` : '')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const importRef = useRef<HTMLTextAreaElement>(null)
  const gameRef = useRef(game)
  const historyRef = useRef<HistoryEntry[]>([])
  const [undoDepth, setUndoDepth] = useState(0)
  const strokeRef = useRef<BuildStroke | null>(null)
  const ignoreClickRef = useRef(false)
  const armed = activeTab === 'build'
  const armedRef = useRef(armed); armedRef.current = armed

  useEffect(() => { const timer = window.setInterval(() => setGame((current) => { const next = current.paused ? current : simulateMany(current, current.speed); gameRef.current = next; return next }), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { const finish = (event: PointerEvent) => finishBuildStroke(event.pointerId); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish); return () => { window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', finish) } }, [])
  useEffect(() => saveGame(game), [game])
  useEffect(() => { gameRef.current = game }, [game])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer) }, [toast])
  useEffect(() => { const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent) }; window.addEventListener('beforeinstallprompt', handler); return () => window.removeEventListener('beforeinstallprompt', handler) }, [])

  const environment = environmentFor(game)
  const island = useMemo(() => buildIsland(game.rows, game.cols, game.activeSector), [game.rows, game.cols, game.activeSector])
  const heat = totalHeat(game)
  const inspectedRefuel = inspectedIndex === null ? 0 : refuelPrice(game, inspectedIndex) ?? 0
  const inspectedRepair = inspectedIndex === null ? 0 : repairPrice(game, inspectedIndex) ?? 0
  const contractComplete = game.activeContract.progress >= game.activeContract.target
  const affordableTechs = TECH_ORDER.filter((key) => canUnlockTech(game, key)).length
  const affordableUpgrades = COMPONENT_ORDER.filter((kind) => isComponentUnlocked(game, kind) && isComponentVisible(game, kind)).flatMap((kind) => upgradeTracks(kind).map((track) => ({ kind, track }))).filter(({ kind, track }) => upgradeLevel(game, kind, track) < 50 && game.credits >= upgradeCost(game, kind, track)).length
  const missionSteps = [
    { label: 'Instala una turbina eólica', done: countKind(game, 'wind') > 0 },
    { label: 'Vende 5 E', done: game.totalEnergySold >= 5 },
    { label: 'Construye una oficina de ventas', done: countKind(game, 'sales') > 0 },
    { label: 'Construye una instalación de I+D', done: countKind(game, 'research') > 0 },
    { label: 'Desbloquea captación solar', done: game.unlockedTechs.solar },
    { label: 'Desbloquea ingeniería térmica', done: game.unlockedTechs.thermal },
  ]
  const missionProgress = missionSteps.filter((step) => step.done).length
  const missionHint = missionProgress === missionSteps.length ? 'La economía básica está lista: ahora optimiza sus cuellos de botella.' : game.totalEnergySold < 5 ? 'Construye eólicas, acumula energía y usa “Vender todo” para obtener tus primeros créditos.' : countKind(game, 'research') === 0 ? 'Invierte en I+D para separar la progresión tecnológica del dinero.' : 'Acumula RP y decide cuándo sacrificar espacio productivo por investigación.'

  function replaceGame(next: GameState) { gameRef.current = next; setGame(next) }
  function pushHistory(entry: HistoryEntry) { historyRef.current = [...historyRef.current.slice(-(MAX_UNDO_STEPS - 1)), entry]; setUndoDepth(historyRef.current.length) }
  function clearHistory() { historyRef.current = []; setUndoDepth(0) }
  function commit(update: (state: GameState) => GameState, label: string, creditAdjustment?: number) { const before = gameRef.current; const after = update(before); if (after === before) return false; pushHistory({ tiles: before.tiles, creditAdjustment: creditAdjustment ?? before.credits - after.credits, label }); replaceGame(after); return true }
  function undo() { const entry = historyRef.current.at(-1); if (!entry) return; historyRef.current = historyRef.current.slice(0, -1); setUndoDepth(historyRef.current.length); replaceGame(restorePlantLayout(gameRef.current, entry.tiles, entry.creditAdjustment)); setInspectedIndex(null); setToast(`${entry.label} deshecho.`) }
  function openTab(tab: DockTab) { if (activeTab === tab) { setActiveTab(null); if (tab === 'inspector') setInspectedIndex(null); return } setActiveTab(tab); if (tab === 'build') setGame((current) => ({ ...current, toolMode: current.toolMode === 'inspect' ? 'build' : current.toolMode })); if (tab === 'inspector') setGame((current) => ({ ...current, toolMode: 'inspect' })) }
  function closeSheet() { setActiveTab(null); setInspectedIndex(null) }
  function inspect(index: number) { setInspectedIndex(index); setActiveTab('inspector') }
  function chooseComponent(kind: ComponentKind) { if (!isComponentUnlocked(gameRef.current, kind)) { setToast('Esta pieza requiere investigación previa.'); return } setGame((current) => ({ ...current, selectedKind: kind, toolMode: 'build' })) }
  function chooseTool(toolMode: ToolMode) { setGame((current) => ({ ...current, toolMode })) }
  function interact(index: number) { const current = gameRef.current; const tile = current.tiles[index]; if (!armedRef.current) { if (tile) inspect(index); return } if (current.toolMode === 'demolish') { if (tile) commit((state) => sellTile(state, index), 'Demolición'); return } if (tile) { const expired = usesAutonomy(tile.kind) && tile.fuel <= 0; if (!expired) { inspect(index); return } if (tile.kind !== current.selectedKind) { setToast(`La casilla contiene ${COMPONENTS[tile.kind].shortName} caducada. Reconstruye el mismo tipo o demuélela.`); return } if (current.credits < COMPONENTS[tile.kind].cost) { setToast('Créditos insuficientes para reconstruir.'); return } commit((state) => placeTile(state, index, state.selectedKind), 'Reconstrucción'); return } const def = COMPONENTS[current.selectedKind]; if (!isComponentUnlocked(current, current.selectedKind)) return; if (current.credits < def.cost) { setToast('Créditos insuficientes.'); return } commit((state) => placeTile(state, index, state.selectedKind), 'Construcción') }
  function placeDuringStroke(index: number) { const stroke = strokeRef.current; if (!stroke || stroke.visited.has(index)) return; stroke.visited.add(index); const current = gameRef.current; const def = COMPONENTS[current.selectedKind]; if (current.tiles[index] || !isComponentUnlocked(current, current.selectedKind) || current.credits < def.cost) return; const next = placeTile(current, index, current.selectedKind); if (next === current) return; stroke.spent += def.cost; stroke.placed += 1; replaceGame(next) }
  function startBuildStroke(event: ReactPointerEvent<HTMLButtonElement>, index: number) { const current = gameRef.current; if (!armedRef.current || current.toolMode !== 'build' || event.button !== 0) return; ignoreClickRef.current = true; event.preventDefault(); if (current.tiles[index]) { interact(index); setTimeout(() => { ignoreClickRef.current = false }, 0); return } strokeRef.current = { pointerId: event.pointerId, visited: new Set(), beforeTiles: current.tiles, spent: 0, placed: 0 }; placeDuringStroke(index) }
  function continueBuildStroke(event: ReactPointerEvent<HTMLDivElement>) { const stroke = strokeRef.current; if (!stroke || stroke.pointerId !== event.pointerId) return; event.preventDefault(); const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-cell-index]'); const index = Number(target?.dataset.cellIndex); if (Number.isInteger(index)) placeDuringStroke(index) }
  function finishBuildStroke(pointerId: number) { const stroke = strokeRef.current; if (!stroke || stroke.pointerId !== pointerId) return; strokeRef.current = null; if (stroke.placed) pushHistory({ tiles: stroke.beforeTiles, creditAdjustment: stroke.spent, label: stroke.placed > 1 ? 'Trazado' : 'Construcción' }); setTimeout(() => { ignoreClickRef.current = false }, 0) }
  function handleCellClick(index: number) { if (ignoreClickRef.current) { ignoreClickRef.current = false; return } interact(index) }

  async function installApp() { if (!installPrompt) { setToast('En iPhone: Compartir → Agregar a inicio. En Android: menú → Instalar app.'); return } await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null) }
  async function copySave() { await navigator.clipboard.writeText(exportGame(game)); setToast('Partida v2 copiada.') }
  function restoreSave() { const restored = importGame(importRef.current?.value ?? ''); if (!restored) { setToast('Código incompatible o inválido; solo se admiten partidas v2.'); return } replaceGame(restored); clearHistory(); closeSheet(); setToast('Partida importada.') }
  function resetGame() { if (!window.confirm('¿Reiniciar toda la planta v2?')) return; clearGame(); replaceGame(createInitialState()); clearHistory(); closeSheet() }
  function research(key: TechKey) { const next = unlockTech(gameRef.current, key); if (next === gameRef.current) return; replaceGame(next); setToast('Tecnología desbloqueada.') }
  function upgrade(kind: ComponentKind, track: UpgradeTrack) { const price = upgradeCost(gameRef.current, kind, track); const next = upgradeBuildingTrack(gameRef.current, kind, track); if (next === gameRef.current) { setToast('Créditos insuficientes o nivel máximo.'); return } replaceGame(next); setToast(`${COMPONENTS[kind].name}: mejora global aplicada por ₡ ${formatNumber(price)}.`) }
  function sellEnergy() { const stored = gameRef.current.energyStored; const next = sellStoredEnergy(gameRef.current); if (next === gameRef.current) return; replaceGame(next); setToast(`${formatDecimal(stored)} E vendidas por ₡ ${formatDecimal(stored)}.`) }
  function toggleInspected() { if (inspectedIndex !== null) commit((state) => toggleTile(state, inspectedIndex), 'Activación', 0) }
  function refuelInspected() { if (inspectedIndex === null) return; const next = refuelTile(gameRef.current, inspectedIndex); if (next === gameRef.current) { setToast(inspectedRefuel ? 'Créditos insuficientes.' : 'El edificio todavía está en operación.'); return } replaceGame(next); setToast(`Edificio reconstruido por ₡ ${formatNumber(inspectedRefuel)}.`) }
  function researchAutoRebuild(kind: ComponentKind) { const next = unlockAutoRebuild(gameRef.current, kind); if (next === gameRef.current) { setToast('RP insuficientes o automatización ya activa.'); return } replaceGame(next); setToast(`Auto rebuild de ${COMPONENTS[kind].shortName} activado.`) }
  function repairInspected() { if (inspectedIndex === null) return; const next = repairTile(gameRef.current, inspectedIndex); if (next === gameRef.current) { setToast('Créditos insuficientes.'); return } replaceGame(next); setToast(`Pieza reparada por ₡ ${formatNumber(inspectedRepair)}.`) }
  function sellInspected() { if (inspectedIndex !== null) { commit((state) => sellTile(state, inspectedIndex), 'Demolición'); setInspectedIndex(null) } }
  function claimActiveContract() { const reward = game.activeContract; const next = claimContract(gameRef.current); if (next === gameRef.current) return; replaceGame(next); setToast(`Contrato: +₡ ${formatNumber(reward.rewardCredits)} y +${formatDecimal(reward.rewardResearch)} RP.`) }
  function changeSector(sector: SectorKey) { const next = switchSector(gameRef.current, sector); if (next === gameRef.current) return; replaceGame(next); clearHistory(); closeSheet() }
  function buySector() { const next = buyDesertSector(gameRef.current); if (next === gameRef.current) { setToast('Aún no cumples los requisitos de expansión.'); return } replaceGame(next); setToast('Isla desértica adquirida.') }

  return <div className={`app env-${environment}`} style={environmentStyle(environment)}><SpriteDefs />
    <MapViewport game={game} island={island} decoration={ENVIRONMENTS[environment].decoration} armed={armed} toolMode={game.toolMode} selectedKind={game.selectedKind} inspectedIndex={inspectedIndex} onCellPointerDown={startBuildStroke} onCellClick={handleCellClick} onGridPointerMove={continueBuildStroke} />
    <Hud game={game} heat={heat} showHeat={game.unlockedTechs.thermal} onSellEnergy={sellEnergy} onOpenMenu={() => openTab('menu')} onTogglePause={() => setGame((current) => ({ ...current, paused: !current.paused }))} onSpeed={(speed) => setGame((current) => ({ ...current, speed, paused: false }))} />
    {activeTab === 'inspector' && <InspectorSheet game={game} index={inspectedIndex} refuelPrice={inspectedRefuel} repairPrice={inspectedRepair} onClose={closeSheet} onToggle={toggleInspected} onRefuel={refuelInspected} onRepair={repairInspected} onSell={sellInspected} />}
    {activeTab === 'upgrades' && <UpgradesSheet game={game} onClose={closeSheet} onUpgrade={upgrade} />}
    {activeTab === 'lab' && <ResearchSheet game={game} onClose={closeSheet} onResearch={research} onAutoRebuild={researchAutoRebuild} />}
    {activeTab === 'contracts' && <ContractsSheet game={game} missions={missionSteps} missionHint={missionHint} onClose={closeSheet} onClaim={claimActiveContract} />}
    {activeTab === 'menu' && <MenuSheet game={game} importRef={importRef} onClose={closeSheet} onSector={changeSector} onBuySector={buySector} onInstall={installApp} onCopySave={copySave} onImport={restoreSave} onReset={resetGame} />}
    <Dock game={game} activeTab={activeTab} onTab={openTab} onChooseComponent={chooseComponent} onChooseTool={chooseTool} onUndo={undo} undoDepth={undoDepth} labBadge={affordableTechs} upgradesBadge={affordableUpgrades} contractReady={contractComplete} />
    {toast && <div className="toast frame" role="status">{toast}</div>}
  </div>
}
export default App
