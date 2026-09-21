import type { RefObject } from 'react'
import { ECONOMY } from '../../game/balance'
import { isSectorUnlocked } from '../../game/engine'
import type { GameState, SectorKey } from '../../game/types'
import { formatDecimal, formatNumber } from '../format'
import { Sprite } from '../pixel/Sprite'
import { Sheet } from '../Sheet'
interface Props { game: GameState; importRef: RefObject<HTMLTextAreaElement | null>; onClose: () => void; onSector: (sector: SectorKey) => void; onBuySector: () => void; onInstall: () => void; onCopySave: () => void; onImport: () => void; onReset: () => void }
export function MenuSheet({ game, importRef, onClose, onSector, onBuySector, onInstall, onCopySave, onImport, onReset }: Props) {
  const desert = isSectorUnlocked(game, 'desert'); const canBuy = game.unlockedTechs.expansion && game.credits >= ECONOMY.secondIslandCost
  return <Sheet title="Menú" eyebrow="SISTEMA" onClose={onClose} className="menu">
    <section className="menu-block"><h3>Sectores</h3><div className="sector-tabs"><button className={`btn frame ${game.activeSector === 'coast' ? 'on' : ''}`} onClick={() => onSector('coast')}><strong>A-01</strong>Costa</button><button className={`btn frame ${game.activeSector === 'desert' ? 'on' : ''}`} disabled={!desert} onClick={() => onSector('desert')}><strong>B-02</strong>{desert ? 'Desierto · solar +25 %' : 'Bloqueado'}</button></div>{!desert && <button className="btn frame gold wide" disabled={!canBuy} onClick={onBuySector}>{!game.unlockedTechs.expansion ? 'Requiere Expansión territorial' : `Comprar isla · ₡ ${formatNumber(ECONOMY.secondIslandCost)}`}</button>}<p className="hint">Los sectores comprados producen en paralelo.</p></section>
    <section className="menu-block telemetry"><h3>Telemetría</h3><div><span>Ciclos</span><strong>{formatNumber(game.tick)}</strong></div><div><span>Energía producida</span><strong>{formatDecimal(game.totalEnergy)}</strong></div><div><span>Energía vendida</span><strong>{formatDecimal(game.totalEnergySold)}</strong></div><div><span>Averías</span><strong className={game.incidents ? 'danger-text' : ''}>{game.incidents}</strong></div><div><span>Combustible</span><strong>₡ {formatNumber(game.totalFuelSpent)}</strong></div><div><span>Reparaciones</span><strong>₡ {formatNumber(game.totalRepairSpent)}</strong></div></section>
    <section className="menu-block"><h3>Guardado v2</h3><p className="hint">La partida se guarda automáticamente. Los códigos de la economía anterior no son compatibles.</p><div className="menu-actions"><button className="btn frame gold" onClick={onCopySave}>Copiar código</button><button className="btn frame" onClick={onInstall}>Instalar app</button></div><label className="import-field"><span>Importar código v2</span><textarea ref={importRef} placeholder="Pega aquí tu código…" rows={3} /></label><button className="btn frame wide" onClick={onImport}>Importar partida</button></section>
    <button className="text-btn danger-text" onClick={onReset}>Reiniciar progreso</button>
  </Sheet>
}
