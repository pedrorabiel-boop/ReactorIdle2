import { useState } from 'react'
import { COMPONENT_ORDER, COMPONENTS } from '../../game/catalog'
import { countKind, isComponentUnlocked, isComponentVisible } from '../../game/engine'
import { canAfford, hasInfiniteMoney } from '../../game/debug'
import { maxUpgradeLevel, nextUpgradeGainPercent, upgradeCost, upgradeLevel, upgradeTracks } from '../../game/research'
import type { ComponentKind, GameState, UpgradeTrack } from '../../game/types'
import { formatDecimal, formatNumber } from '../format'
import { Sprite } from '../pixel/Sprite'
import { Sheet } from '../Sheet'
import { sectorLabel } from '../sectors'

interface Props {
  game: GameState
  onClose: () => void
  onUpgrade: (kind: ComponentKind, track: UpgradeTrack) => void
  onUpgradeMax: (kind: ComponentKind, track: UpgradeTrack) => void
  onToggleHidden: (kind: ComponentKind) => void
}

function trackLabel(kind: ComponentKind, track: UpgradeTrack): string {
  if (track === 'autonomy') return kind === 'core' || kind === 'thorium' || kind === 'fusion' ? 'Autonomía' : 'Vida útil'
  if (track === 'capacity') return 'Tolerancia térmica'
  if (kind === 'sales' || kind === 'sales2') return 'Venta / s'
  if (kind === 'research' || kind === 'research2') return 'RP / s'
  if (kind === 'battery') return 'Almacenamiento'
  if (kind === 'controller') return 'Control de red'
  if (kind === 'generator' || kind === 'generator2') return 'Conversión'
  if (kind === 'cooler') return 'Enfriamiento'
  if (kind === 'pipe' || kind === 'pipe2' || kind === 'exchanger' || kind === 'accumulator') return 'Conductividad'
  return 'Producción'
}

function impactLabel(track: UpgradeTrack, kind: ComponentKind): string {
  if (track === 'autonomy') return 'vida útil'
  if (track === 'capacity') return 'tolerancia'
  if (kind === 'pipe' || kind === 'pipe2' || kind === 'exchanger' || kind === 'accumulator') return 'conductividad'
  return 'potencia'
}

export function UpgradesSheet({ game, onClose, onUpgrade, onUpgradeMax, onToggleHidden }: Props) {
  const [showHidden, setShowHidden] = useState(false)
  const hidden = game.sectorEconomies[game.activeSector].hiddenUpgrades
  const unlocked = COMPONENT_ORDER.filter((kind) => isComponentUnlocked(game, kind) && isComponentVisible(game, kind))
  const kinds = showHidden ? unlocked.filter((kind) => hidden.includes(kind)) : unlocked.filter((kind) => !hidden.includes(kind))
  const maximum = maxUpgradeLevel(game)

  return <Sheet title="Mejoras" eyebrow={`POR TIPO · ${sectorLabel(game.activeSector).toUpperCase()}`} onClose={onClose} className="global-upgrades">
    <div className="balance frame"><Sprite name="icon-coin" size={22} /><div><strong>₡ {hasInfiniteMoney(game) ? '∞' : formatNumber(game.credits)}</strong><small>Afecta todas las unidades presentes y futuras del tipo, solo en este mapa · máximo Nv.{maximum}.</small></div></div>

    {hidden.length > 0 && <button type="button" className={`btn frame wide hidden-toggle ${showHidden ? 'on' : ''}`} aria-pressed={showHidden} onClick={() => setShowHidden((current) => !current)}>
      {showHidden ? `Volver a las mejoras activas (${unlocked.length - hidden.length})` : hidden.length === 1 ? 'Ver la torre apartada' : `Ver las ${formatNumber(hidden.length)} torres apartadas`}
    </button>}

    {kinds.length === 0
      ? <p className="hint upgrades-empty">{showHidden ? 'No has apartado ningún tipo todavía.' : 'Apartaste todos los tipos. Usa el botón de arriba para recuperarlos.'}</p>
      : <div className="upgrade-groups">{kinds.map((kind) => {
        const isHidden = hidden.includes(kind)
        return <article className="upgrade-group frame" key={kind}>
          <div className="upgrade-type">
            <span className="upgrade-icon big frame"><Sprite name={kind} size={52} /></span>
            <div className="upgrade-title"><strong>{COMPONENTS[kind].name}</strong><small>{countKind(game, kind)} construidas</small></div>
            <button
              type="button"
              className={`upgrade-hide frame ${isHidden ? 'on' : ''}`}
              aria-pressed={isHidden}
              aria-label={isHidden ? `Devolver ${COMPONENTS[kind].name} a la lista` : `Apartar ${COMPONENTS[kind].name} de la lista`}
              onClick={() => onToggleHidden(kind)}
            >{isHidden ? '+' : '−'}</button>
          </div>
          <div className="upgrade-tracks">{upgradeTracks(kind).map((track) => {
            const level = upgradeLevel(game, kind, track)
            const cost = upgradeCost(game, kind, track)
            const maxed = level >= maximum
            const affordable = canAfford(game, cost)
            const impact = nextUpgradeGainPercent(game, kind, track)
            return <div className="upgrade-track-row" key={track}>
              <button className="upgrade-track frame" disabled={maxed || !affordable} onClick={() => onUpgrade(kind, track)}>
                <span>{trackLabel(kind, track)} <b>Nv.{level}</b></span>
                {!maxed && <em>Próximo: +{formatDecimal(impact)}% {impactLabel(track, kind)}</em>}
                <small>{maxed ? 'MÁX.' : <><Sprite name="icon-coin" size={9} />{formatNumber(cost)}</>}</small>
              </button>
              <button
                className="upgrade-max frame"
                disabled={maxed || !affordable}
                aria-label={`Subir ${trackLabel(kind, track)} de ${COMPONENTS[kind].name} todo lo que alcance el dinero`}
                onClick={() => onUpgradeMax(kind, track)}
              >MÁX</button>
            </div>
          })}</div>
        </article>
      })}</div>}
  </Sheet>
}
