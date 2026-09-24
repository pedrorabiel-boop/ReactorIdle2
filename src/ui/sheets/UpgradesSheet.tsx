import { ECONOMY } from '../../game/balance'
import { COMPONENT_ORDER, COMPONENTS } from '../../game/catalog'
import { countKind, isComponentUnlocked, isComponentVisible } from '../../game/engine'
import { canAfford, hasInfiniteMoney } from '../../game/debug'
import { nextUpgradeGainPercent, upgradeCost, upgradeLevel, upgradeTracks } from '../../game/research'
import type { ComponentKind, GameState, UpgradeTrack } from '../../game/types'
import { formatDecimal, formatNumber } from '../format'
import { Sprite } from '../pixel/Sprite'
import { Sheet } from '../Sheet'

interface Props { game: GameState; onClose: () => void; onUpgrade: (kind: ComponentKind, track: UpgradeTrack) => void }

function trackLabel(kind: ComponentKind, track: UpgradeTrack): string {
  if (track === 'autonomy') return kind === 'core' || kind === 'thorium' || kind === 'fusion' ? 'Autonomía' : 'Vida útil'
  if (track === 'capacity') return 'Tolerancia térmica'
  if (kind === 'sales' || kind === 'sales2') return 'Venta / s'
  if (kind === 'research' || kind === 'research2') return 'RP / s'
  if (kind === 'battery') return 'Almacenamiento'
  if (kind === 'controller') return 'Control de red'
  if (kind === 'generator' || kind === 'generator2') return 'Conversión'
  if (kind === 'cooler') return 'Enfriamiento'
  if (kind === 'pipe2') return 'Caudal activo'
  if (kind === 'pipe' || kind === 'exchanger' || kind === 'accumulator') return 'Conductividad'
  return 'Producción'
}

function impactLabel(track: UpgradeTrack, kind: ComponentKind): string {
  if (track === 'autonomy') return 'vida útil'
  if (track === 'capacity') return 'tolerancia'
  if (kind === 'pipe2') return 'caudal de extracción'
  if (kind === 'pipe' || kind === 'exchanger' || kind === 'accumulator') return 'conductividad'
  return 'potencia'
}

export function UpgradesSheet({ game, onClose, onUpgrade }: Props) {
  const kinds = COMPONENT_ORDER.filter((kind) => isComponentUnlocked(game, kind) && isComponentVisible(game, kind))
  return <Sheet title="Mejoras" eyebrow={`POR TIPO · ${game.activeSector === 'coast' ? 'A-01 COSTA' : 'B-02 DESIERTO'}`} onClose={onClose} className="global-upgrades">
    <div className="balance frame"><Sprite name="icon-coin" size={22} /><div><strong>₡ {hasInfiniteMoney(game) ? '∞' : formatNumber(game.credits)}</strong><small>Afecta todas las unidades presentes y futuras del tipo, solo en este mapa.</small></div></div>
    <div className="upgrade-groups">{kinds.map((kind) => <article className="upgrade-group frame" key={kind}>
      <div className="upgrade-type"><span className="upgrade-icon frame"><Sprite name={kind} size={28} /></span><div><strong>{COMPONENTS[kind].name}</strong><small>{countKind(game, kind)} construidas</small></div></div>
      <div className="upgrade-tracks">{upgradeTracks(kind).map((track) => { const level = upgradeLevel(game, kind, track); const cost = upgradeCost(game, kind, track); const maxed = level >= ECONOMY.maxBuildingLevel; const impact = nextUpgradeGainPercent(game, kind, track); return <button className="upgrade-track frame" key={track} disabled={maxed || !canAfford(game, cost)} onClick={() => onUpgrade(kind, track)}><span>{trackLabel(kind, track)} <b>Nv.{level}</b></span>{!maxed && <em>Próximo: +{formatDecimal(impact)}% {impactLabel(track, kind)}</em>}<small>{maxed ? 'MÁX.' : <><Sprite name="icon-coin" size={9} />{formatNumber(cost)}</>}</small></button> })}</div>
    </article>)}</div>
  </Sheet>
}
