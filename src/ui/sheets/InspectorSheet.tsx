import { COMPONENTS } from '../../game/catalog'
import { autonomyLevel, capacityLevel, componentCapacity, componentLevel, fuelCapacity, upgradeTracks } from '../../game/research'
import { demolitionRefund, isReactorKind, usesAutonomy } from '../../game/engine'
import type { GameState } from '../../game/types'
import { formatDecimal, formatNumber } from '../format'
import { Sprite } from '../pixel/Sprite'
import { Sheet } from '../Sheet'

interface Props { game: GameState; index: number | null; refuelPrice: number; repairPrice: number; onClose: () => void; onToggle: () => void; onRefuel: () => void; onRepair: () => void; onSell: () => void }
function Bar({ value, max, tone }: { value: number; max: number; tone: 'heat' | 'fuel' | 'charge' }) { return <div className={`bar ${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><i style={{ width: `${max ? Math.min(100, value / max * 100) : 0}%` }} /></div> }
export function InspectorSheet({ game, index, refuelPrice, repairPrice, onClose, onToggle, onRefuel, onRepair, onSell }: Props) {
  const tile = index === null ? null : game.tiles[index]
  if (!tile) return <Sheet title="Inspector" eyebrow="COMPONENTE" onClose={onClose}><p className="hint">Toca una pieza para ver su producción, autonomía y nivel.</p></Sheet>
  const def = COMPONENTS[tile.kind]; const capacity = componentCapacity(game, tile.kind); const hasAutonomy = usesAutonomy(tile.kind); const reactor = isReactorKind(tile.kind); const fuelMax = fuelCapacity(game, tile.kind); const tracks = upgradeTracks(tile.kind)
  return <Sheet title={def.name} eyebrow="COMPONENTE" onClose={onClose} className="inspector">
    <div className="inspector-head"><span className="portrait frame"><Sprite name={tile.kind} size={48} /></span><p>{def.description}</p></div>
    <div className="readouts">
      {capacity > 0 && <div className="readout"><div><span>Calor</span><strong>{formatDecimal(tile.heat)} / {formatNumber(capacity)}</strong></div><Bar value={tile.heat} max={capacity} tone="heat" /><small>Flujo último ciclo: {formatDecimal(tile.flow)}</small></div>}
      {hasAutonomy && <div className="readout"><div><span>{reactor ? 'Autonomía' : 'Vida útil'}</span><strong>{formatNumber(tile.fuel)} / {formatNumber(fuelMax)} s</strong></div><Bar value={tile.fuel} max={fuelMax} tone="fuel" /></div>}
      {hasAutonomy && <div className="readout"><div><span>Auto rebuild</span><strong>{game.autoRebuilds[tile.kind] ? 'ACTIVO' : 'NO INVESTIGADO'}</strong></div><small>{game.autoRebuilds[tile.kind] ? `Al caducar intentará pagar ₡ ${formatNumber(def.cost)} y continuará.` : 'Se desbloquea por tipo en el Laboratorio.'}</small></div>}
      <div className="readout"><div><span>Mejoras globales</span><strong>{tracks.map((track) => `${track === 'output' ? 'Prod.' : track === 'capacity' ? 'Cap.' : 'Vida'} Nv.${track === 'output' ? componentLevel(game, tile.kind) : track === 'capacity' ? capacityLevel(game, tile.kind) : autonomyLevel(game, tile.kind)}`).join(' · ')}</strong></div><small>Se administran para todas las unidades desde la pestaña Mejoras.</small></div>
      {tile.damaged && <div className="readout"><strong className="danger-text">AVERÍA TÉRMICA</strong><small>Repara para vaciar el calor y reactivar la pieza.</small></div>}
    </div>
    <div className="actions">{tile.damaged ? <button className="btn frame danger" disabled={game.credits < repairPrice} onClick={onRepair}>Reparar · <Sprite name="icon-coin" size={10} />{formatNumber(repairPrice)}</button> : <button className="btn frame" onClick={onToggle}>{tile.enabled ? 'Apagar' : 'Encender'}</button>}{hasAutonomy && tile.fuel <= 0 && <button className="btn frame gold" disabled={game.credits < refuelPrice} onClick={onRefuel}>Reconstruir · <Sprite name="icon-coin" size={10} />{formatNumber(refuelPrice)}</button>}<button className="btn frame danger" onClick={onSell}>Demoler · +<Sprite name="icon-coin" size={10} />{formatNumber(demolitionRefund(tile.kind))}</button></div>
  </Sheet>
}
