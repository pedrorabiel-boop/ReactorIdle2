import { globalSalesCapacity, globalStorageCapacity } from '../game/engine'
import type { GameState } from '../game/types'
import { formatCompact, formatDecimal } from './format'
import { Sprite } from './pixel/Sprite'

interface HudProps { game: GameState; heat: number; showHeat: boolean; onSellEnergy: () => void; onOpenMenu: () => void; onTogglePause: () => void; onSpeed: (speed: 1 | 2 | 4) => void }

export function Hud({ game, heat, showHeat, onSellEnergy, onOpenMenu, onTogglePause, onSpeed }: HudProps) {
  const report = game.lastReport
  return <header className="hud">
    <div className="hud-row">
      <div className="res frame" aria-label={`Créditos ${formatCompact(game.credits)}`}><Sprite name="icon-coin" size={18} /><span className="val">{formatCompact(game.credits)}</span><span className="rate">+{formatDecimal(report.earnedCredits)}/s</span></div>
      <div className="res frame" aria-label={`Energía ${formatDecimal(game.energyStored)} de ${formatDecimal(globalStorageCapacity(game))}`}><Sprite name="icon-bolt" size={18} /><span className="val">{formatDecimal(game.energyStored)}/{formatCompact(globalStorageCapacity(game))}</span><span className="rate">{formatDecimal(report.producedEnergy)} prod · {formatDecimal(report.soldEnergy)} venta</span></div>
      <div className="res frame" aria-label={`Research ${formatDecimal(game.researchPoints)} RP`}><Sprite name="icon-flask" size={18} /><span className="val">{formatDecimal(game.researchPoints)} RP</span><span className="rate">+{formatDecimal(report.generatedResearch)}/s</span></div>
      <button className="icon-btn frame" onClick={onOpenMenu} aria-label="Abrir menú"><Sprite name="icon-menu" size={20} /></button>
    </div>
    <div className="hud-row hud-secondary">
      <div className="speed frame" role="group" aria-label="Velocidad"><button className={game.paused ? 'on' : ''} onClick={onTogglePause}>{game.paused ? '▶' : 'Ⅱ'}</button>{([1, 2, 4] as const).map((speed) => <button key={speed} className={!game.paused && game.speed === speed ? 'on' : ''} onClick={() => onSpeed(speed)}>{speed}×</button>)}</div>
      <button className="sell-energy frame" disabled={game.energyStored <= 0} onClick={onSellEnergy}><Sprite name="icon-coin" size={14} />Vender todo <b>{formatDecimal(game.energyStored)} E</b></button>
      {showHeat && <div className={`res res-heat frame ${heat > 200 ? 'danger' : ''}`}><Sprite name="icon-flame" size={16} /><span className="val">{formatCompact(heat)}</span></div>}
      <span className="sector-chip frame">{game.activeSector === 'coast' ? 'A-01 · Costa' : 'B-02 · Desierto'} · venta {formatDecimal(globalSalesCapacity(game))}/s</span>
    </div>
  </header>
}
