import { ECONOMY } from '../../game/balance'
import { COMPONENT_ORDER, COMPONENTS } from '../../game/catalog'
import { countKind, isComponentUnlocked, isComponentVisible } from '../../game/engine'
import { upgradeCost, upgradeLevel, upgradeTracks } from '../../game/research'
import type { ComponentKind, GameState, UpgradeTrack } from '../../game/types'
import { formatNumber } from '../format'
import { Sprite } from '../pixel/Sprite'
import { Sheet } from '../Sheet'

interface Props { game: GameState; onClose: () => void; onUpgrade: (kind: ComponentKind, track: UpgradeTrack) => void }

function trackLabel(kind: ComponentKind, track: UpgradeTrack): string {
  if (track === 'autonomy') return kind === 'core' || kind === 'thorium' || kind === 'fusion' ? 'Autonomía' : 'Vida útil'
  if (track === 'capacity') return 'Tolerancia térmica'
  if (kind === 'sales') return 'Venta / s'
  if (kind === 'research') return 'RP / s'
  if (kind === 'battery') return 'Almacenamiento'
  if (kind === 'controller') return 'Control de red'
  if (kind === 'generator') return 'Conversión'
  if (kind === 'cooler') return 'Enfriamiento'
  if (kind === 'pipe' || kind === 'exchanger' || kind === 'accumulator') return 'Transferencia'
  return 'Producción'
}

export function UpgradesSheet({ game, onClose, onUpgrade }: Props) {
  const kinds = COMPONENT_ORDER.filter((kind) => isComponentUnlocked(game, kind) && isComponentVisible(game, kind))
  return <Sheet title="Mejoras" eyebrow="GLOBALES POR TIPO" onClose={onClose} className="global-upgrades">
    <div className="balance frame"><Sprite name="icon-coin" size={22} /><div><strong>₡ {formatNumber(game.credits)}</strong><small>Cada mejora afecta todas las unidades presentes y futuras del tipo.</small></div></div>
    <div className="upgrade-groups">{kinds.map((kind) => <article className="upgrade-group frame" key={kind}>
      <div className="upgrade-type"><span className="upgrade-icon frame"><Sprite name={kind} size={28} /></span><div><strong>{COMPONENTS[kind].name}</strong><small>{countKind(game, kind)} construidas</small></div></div>
      <div className="upgrade-tracks">{upgradeTracks(kind).map((track) => { const level = upgradeLevel(game, kind, track); const cost = upgradeCost(game, kind, track); const maxed = level >= ECONOMY.maxBuildingLevel; return <button className="upgrade-track frame" key={track} disabled={maxed || game.credits < cost} onClick={() => onUpgrade(kind, track)}><span>{trackLabel(kind, track)} <b>Nv.{level}</b></span><small>{maxed ? 'MÁX.' : <><Sprite name="icon-coin" size={9} />{formatNumber(cost)}</>}</small></button> })}</div>
    </article>)}</div>
  </Sheet>
}
