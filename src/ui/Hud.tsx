import { useState } from 'react'
import { sectorEnergyStored, sectorSalesCapacity, sectorStorageCapacity } from '../game/engine'
import { hasInfiniteMoney } from '../game/debug'
import type { GameState } from '../game/types'
import { formatCompact, formatDecimal, formatExact, formatNumber } from './format'
import { Sprite } from './pixel/Sprite'

interface HudProps { game: GameState; heat: number; showHeat: boolean; onSellEnergy: () => void; onOpenMenu: () => void }

export function Hud({ game, heat, showHeat, onSellEnergy, onOpenMenu }: HudProps) {
  const [exactResource, setExactResource] = useState<'credits' | 'energy' | 'research' | null>(null)
  const report = game.lastReport
  const stored = sectorEnergyStored(game)
  const capacity = sectorStorageCapacity(game)
  const fill = capacity > 0 ? stored / capacity : 0
  const bankState = report.wastedEnergy > 0 || fill >= 1 ? 'danger' : fill >= 0.75 ? 'warning' : ''
  const credits = hasInfiniteMoney(game) ? '∞' : formatCompact(game.credits)
  const exactCopy = exactResource === 'credits'
    ? `Dinero: ${hasInfiniteMoney(game) ? '∞' : `₡ ${formatExact(game.credits)}`} · Ingreso: ₡ ${formatExact(report.earnedCredits)}/s`
    : exactResource === 'energy'
      ? `Energía: ${formatExact(stored)} / ${formatExact(capacity)} E · Producción: ${formatExact(report.producedEnergy)}/s · Venta: ${formatExact(report.soldEnergy)} / ${formatExact(sectorSalesCapacity(game))}/s`
      : exactResource === 'research'
        ? `Investigación: ${formatExact(game.researchPoints)} RP · Producción: ${formatExact(report.generatedResearch)} RP/s`
        : null
  const toggleExact = (resource: 'credits' | 'energy' | 'research') => setExactResource((current) => current === resource ? null : resource)
  return <header className="hud">
    <div className="hud-row">
      <button type="button" data-tour="hud-credits" className={`res resource-button frame ${exactResource === 'credits' ? 'on' : ''}`} aria-label={`Créditos ${hasInfiniteMoney(game) ? 'infinitos' : formatExact(game.credits)}; tocar para ver valor exacto`} aria-expanded={exactResource === 'credits'} onClick={() => toggleExact('credits')}><Sprite name="icon-coin" size={18} /><span className="val">{credits}</span><span className="rate">+{formatDecimal(report.earnedCredits)}/s</span></button>
      <button type="button" data-tour="hud-energy" className={`res resource-button energy-bank frame ${bankState} ${exactResource === 'energy' ? 'on' : ''}`} aria-label={`Energía ${formatExact(stored)} de ${formatExact(capacity)}; tocar para ver valor exacto`} aria-expanded={exactResource === 'energy'} onClick={() => toggleExact('energy')}><Sprite name="icon-bolt" size={18} /><span className="val">{formatNumber(Math.floor(stored))}/{formatNumber(Math.floor(capacity))}</span><span className="rate">{formatDecimal(report.producedEnergy)} prod · {formatDecimal(report.soldEnergy)}/{formatDecimal(sectorSalesCapacity(game))} venta</span></button>
      <button type="button" data-tour="hud-research" className={`res resource-button frame ${exactResource === 'research' ? 'on' : ''}`} aria-label={`Research ${formatExact(game.researchPoints)} RP; tocar para ver valor exacto`} aria-expanded={exactResource === 'research'} onClick={() => toggleExact('research')}><Sprite name="icon-flask" size={18} /><span className="val">{formatCompact(game.researchPoints)} RP</span><span className="rate">+{formatDecimal(report.generatedResearch)}/s</span></button>
      <button className="icon-btn frame" onClick={onOpenMenu} aria-label="Abrir menú"><Sprite name="icon-menu" size={20} /></button>
    </div>
    {exactCopy && <button type="button" className="hud-exact frame" onClick={() => setExactResource(null)} aria-label={`${exactCopy}; cerrar detalle`}>{exactCopy}</button>}
    <div className="hud-row hud-secondary">
      <button className="sell-energy frame" data-tour="hud-sell" disabled={stored <= 0} onClick={onSellEnergy}><Sprite name="icon-coin" size={14} />Vender todo <b>{formatNumber(Math.floor(stored))} E</b></button>
      {showHeat && <div className={`res res-heat frame ${heat > 200 ? 'danger' : ''}`}><Sprite name="icon-flame" size={16} /><span className="val">{formatCompact(heat)}</span></div>}
      {report.wastedEnergy > 0 && <span className="overflow-chip frame">Exceso −{formatNumber(Math.floor(report.wastedEnergy))} E</span>}
    </div>
  </header>
}
