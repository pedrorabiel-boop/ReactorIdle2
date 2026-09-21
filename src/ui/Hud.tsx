import { sectorEnergyStored, sectorSalesCapacity, sectorStorageCapacity } from '../game/engine'
import type { GameState } from '../game/types'
import { formatCompact, formatDecimal, formatNumber } from './format'
import { Sprite } from './pixel/Sprite'

interface HudProps { game: GameState; heat: number; showHeat: boolean; onSellEnergy: () => void; onOpenMenu: () => void }

export function Hud({ game, heat, showHeat, onSellEnergy, onOpenMenu }: HudProps) {
  const report = game.lastReport
  const stored = sectorEnergyStored(game)
  const capacity = sectorStorageCapacity(game)
  const fill = capacity > 0 ? stored / capacity : 0
  const bankState = report.wastedEnergy > 0 || fill >= 1 ? 'danger' : fill >= 0.75 ? 'warning' : ''
  return <header className="hud">
    <div className="hud-row">
      <div className="res frame" aria-label={`Créditos ${formatCompact(game.credits)}`}><Sprite name="icon-coin" size={18} /><span className="val">{formatCompact(game.credits)}</span><span className="rate">+{formatDecimal(report.earnedCredits)}/s</span></div>
      <div className={`res energy-bank frame ${bankState}`} aria-label={`Energía ${Math.floor(stored)} de ${Math.floor(capacity)}`}><Sprite name="icon-bolt" size={18} /><span className="val">{formatNumber(Math.floor(stored))}/{formatNumber(Math.floor(capacity))}</span><span className="rate">{formatDecimal(report.producedEnergy)} prod · {formatDecimal(report.soldEnergy)}/{formatDecimal(sectorSalesCapacity(game))} venta</span></div>
      <div className="res frame" aria-label={`Research ${formatDecimal(game.researchPoints)} RP`}><Sprite name="icon-flask" size={18} /><span className="val">{formatDecimal(game.researchPoints)} RP</span><span className="rate">+{formatDecimal(report.generatedResearch)}/s</span></div>
      <button className="icon-btn frame" onClick={onOpenMenu} aria-label="Abrir menú"><Sprite name="icon-menu" size={20} /></button>
    </div>
    <div className="hud-row hud-secondary">
      <button className="sell-energy frame" disabled={stored <= 0} onClick={onSellEnergy}><Sprite name="icon-coin" size={14} />Vender todo <b>{formatNumber(Math.floor(stored))} E</b></button>
      {showHeat && <div className={`res res-heat frame ${heat > 200 ? 'danger' : ''}`}><Sprite name="icon-flame" size={16} /><span className="val">{formatCompact(heat)}</span></div>}
      {report.wastedEnergy > 0 && <span className="overflow-chip frame">Exceso −{formatNumber(Math.floor(report.wastedEnergy))} E</span>}
    </div>
  </header>
}
