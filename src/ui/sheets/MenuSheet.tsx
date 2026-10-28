import { useState, type RefObject } from 'react'
import { ECONOMY, TECHNOLOGIES } from '../../game/balance'
import { COMPONENT_ORDER } from '../../game/catalog'
import { canAfford } from '../../game/debug'
import { canPrestige, isSectorUnlocked, prestigeMultiplier, prestigeThreshold } from '../../game/engine'
import type { GameState, SectorKey } from '../../game/types'
import { formatCompact, formatDecimal, formatNumber } from '../format'
import { Sprite } from '../pixel/Sprite'
import { SectorThumb } from '../SectorThumb'
import { Sheet } from '../Sheet'
import { SECTOR_LABELS, sectorLabel } from '../sectors'

/** El dato que justifica elegir cada sector, aparte de su nombre. */
const SECTOR_TABS: Array<{ sector: SectorKey; nota?: string }> = [
  { sector: 'coast' },
  { sector: 'desert', nota: 'solar +25 %' },
  { sector: 'testsite', nota: '150 casillas' },
]

interface Props { game: GameState; importRef: RefObject<HTMLTextAreaElement | null>; onClose: () => void; onSector: (sector: SectorKey) => void; onBuySector: () => void; onClaimTestSite: () => void; onPrestige: () => void; onToggleFlowNumbers: () => void; onTogglePause: () => void; onToggleAutoRebuild: () => void; onInstall: () => void; onCopySave: () => void; onImport: () => void; onReset: () => void; onToggleDebug: () => void; onOpenDebug: () => void }
export function MenuSheet({ game, importRef, onClose, onSector, onBuySector, onClaimTestSite, onPrestige, onToggleFlowNumbers, onTogglePause, onToggleAutoRebuild, onInstall, onCopySave, onImport, onReset, onToggleDebug, onOpenDebug }: Props) {
  const licenses = COMPONENT_ORDER.filter((kind) => game.autoRebuilds[kind]).length
  // El Debug sale del menu: el juego tiene que poder enseñarse sin el. Sigue
  // entero, y reaparece con ?debug en la direccion -o si quedo encendido, para
  // que nunca haya forma de dejarlo puesto sin poder apagarlo.
  const debugALaVista = game.debug.enabled || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'))
  const desert = isSectorUnlocked(game, 'desert'); const canBuy = game.unlockedTechs.expansion
  const testsite = isSectorUnlocked(game, 'testsite')
  const [confirmingPrestige, setConfirmingPrestige] = useState(false)
  const threshold = prestigeThreshold()
  const ready = canPrestige(game)
  const progress = Math.min(1, threshold > 0 ? game.credits / threshold : 0)
  const sectorName = sectorLabel(game.activeSector)
  return <Sheet title="Menú" eyebrow="SISTEMA" onClose={onClose} className="menu">
    <section className="menu-block"><h3>Operación · {sectorName}</h3><button className={`btn frame wide ${game.paused ? 'on' : ''}`} aria-pressed={game.paused} onClick={onTogglePause}>{game.paused ? 'Reanudar' : 'Pausa'}</button>{licenses > 0 && <button className={`btn frame wide ${game.autoRebuildPaused ? 'danger' : 'on'}`} aria-pressed={!game.autoRebuildPaused} onClick={onToggleAutoRebuild}>Auto rebuild · {game.autoRebuildPaused ? 'en pausa' : 'activo'}</button>}</section>
    <section className="menu-block"><h3>Sectores</h3><div className="sector-tabs">{SECTOR_TABS.map(({ sector, nota }) => {
      const abierto = sector === 'coast' || (sector === 'desert' ? desert : testsite)
      const { code, name } = SECTOR_LABELS[sector]
      return <button key={sector} className={`btn frame ${game.activeSector === sector ? 'on' : ''}`} disabled={!abierto} aria-label={`${code} ${name}${abierto ? '' : ', bloqueado'}`} onClick={() => onSector(sector)}>
        <SectorThumb sector={sector} />
        <strong>{code}</strong>
        <span>{abierto ? name : 'Bloqueado'}</span>
        {abierto && nota && <em>{nota}</em>}
      </button>
    })}</div>{!desert && <button className="btn frame gold wide" disabled={!canBuy} onClick={onBuySector}>{game.unlockedTechs.expansion ? 'Ocupar el Manglar' : `Requiere Expansión territorial · ${formatCompact(TECHNOLOGIES.expansion.cost)} PI`}</button>}{!testsite && <button className="btn frame gold wide" disabled={!game.unlockedTechs.testsite} onClick={onClaimTestSite}>{game.unlockedTechs.testsite ? 'Ocupar el Nuclear Test Site' : `Requiere Autorización de ensayos · ${formatCompact(TECHNOLOGIES.testsite.cost)} PI`}</button>}<p className="hint">Los sectores abiertos producen en paralelo.</p></section>
    <section className="menu-block"><h3>Prestigio</h3><div className="prestige-state"><strong>× {formatDecimal(prestigeMultiplier(game))}</strong><small>{formatNumber(game.prestiges)} {game.prestiges === 1 ? 'reinicio' : 'reinicios'} · cada venta rinde un {Math.round((ECONOMY.prestigeSalesBonus - 1) * 100)} % más</small></div><div className="prestige-bar frame"><span style={{ width: `${progress * 100}%` }} /></div><p className="hint">{ready ? 'Ya puedes reiniciar.' : `Necesitas ₡ ${formatNumber(threshold)} · llevas ${Math.floor(progress * 100)} %`}</p>{confirmingPrestige ? <><p className="hint danger-text">Se borra <strong>todo</strong>: mapas, construcciones, mejoras, tecnologías y dinero. Solo conservas el multiplicador de venta.</p><div className="menu-actions"><button className="btn frame danger" onClick={() => { setConfirmingPrestige(false); onPrestige() }}>Sí, borrar y reiniciar</button><button className="btn frame" onClick={() => setConfirmingPrestige(false)}>Cancelar</button></div></> : <button className="btn frame gold wide" disabled={!ready} onClick={() => setConfirmingPrestige(true)}>Reiniciar con prestigio</button>}</section>
    <section className="menu-block"><h3>Pantalla</h3><button className={`btn frame wide ${game.showFlowNumbers ? 'on' : ''}`} aria-pressed={game.showFlowNumbers} onClick={onToggleFlowNumbers}>Cifras de calor sobre las torres · {game.showFlowNumbers ? 'visibles' : 'ocultas'}</button><p className="hint">Con las cifras ocultas quedan solo las barras de color, que siguen avisando de la sobrecarga.</p></section>
    <section className="menu-block telemetry"><h3>Telemetría</h3><div><span>Ciclos</span><strong>{formatNumber(game.tick)}</strong></div><div><span>Energía producida</span><strong>{formatDecimal(game.totalEnergy)}</strong></div><div><span>Energía vendida</span><strong>{formatDecimal(game.totalEnergySold)}</strong></div><div><span>Averías</span><strong className={game.incidents ? 'danger-text' : ''}>{game.incidents}</strong></div><div><span>Combustible</span><strong>₡ {formatNumber(game.totalFuelSpent)}</strong></div><div><span>Reparaciones</span><strong>₡ {formatNumber(game.totalRepairSpent)}</strong></div></section>
    {debugALaVista && <section className="menu-block"><h3>Debug</h3><p className="hint">Sandbox local para probar economía, edificios e investigaciones.</p><div className="menu-actions"><button className={`btn frame ${game.debug.enabled ? 'on gold' : ''}`} onClick={onToggleDebug}>{game.debug.enabled ? 'Desactivar Debug' : 'Activar Debug'}</button><button className="btn frame" disabled={!game.debug.enabled} onClick={onOpenDebug}>Editar balance</button></div></section>}
    <section className="menu-block"><h3>Guardado</h3><div className="menu-actions"><button className="btn frame gold" onClick={onCopySave}>Guardar código</button><button className="btn frame" onClick={onInstall}>Instalar app</button></div><label className="import-field"><span>Importar código</span><textarea ref={importRef} placeholder="Pega aquí tu código…" rows={3} /></label><button className="btn frame wide" onClick={onImport}>Importar partida</button></section>
    <button className="text-btn danger-text" onClick={onReset}>Reiniciar progreso</button>
  </Sheet>
}
