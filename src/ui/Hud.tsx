import { useState } from 'react'
import { sectorEnergyStored, sectorSalesCapacity, sectorStorageCapacity } from '../game/engine'
import { hasInfiniteMoney } from '../game/debug'
import type { GameState } from '../game/types'
import { formatCompact, formatDecimal, formatExact, formatNumber } from './format'
import { Sprite } from './pixel/Sprite'

interface HudProps { game: GameState; zoom: number; onZoom: (delta: number) => void; musicOn: boolean; onToggleMusic: () => void; onSellEnergy: () => void; onToggleBoost: () => void; onOpenMenu: () => void }

export function Hud({ game, zoom, onZoom, musicOn, onToggleMusic, onSellEnergy, onToggleBoost, onOpenMenu }: HudProps) {
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
    </div>
    {exactCopy && <button type="button" className="hud-exact frame" onClick={() => setExactResource(null)} aria-label={`${exactCopy}; cerrar detalle`}>{exactCopy}</button>}
    <div className="hud-row hud-secondary">
      <button
        type="button"
        className="sell-energy frame"
        data-tour="hud-sell"
        disabled={stored <= 0}
        onClick={onSellEnergy}
        aria-label={`Vender toda la energía almacenada: ${formatExact(stored)} E`}
      >
        <Sprite name="icon-bolt" size={16} />
        <span className="sell-arrow" aria-hidden="true">→</span>
        <Sprite name="icon-coin" size={16} />
      </button>
      {game.giftTicks > 0 && <button
        type="button"
        className={`boost frame ${game.boostActive ? 'on' : ''}`}
        aria-pressed={game.boostActive}
        aria-label={`${game.boostActive ? 'Detener' : 'Activar'} el bonus; quedan ${formatNumber(game.giftTicks)} ticks de regalo`}
        onClick={onToggleBoost}
      >
        <span className="boost-play" aria-hidden="true">{game.boostActive ? '■' : '▶'}</span>
        <b>{formatNumber(game.giftTicks)}</b>
        <small>ticks</small>
      </button>}
      <button type="button" className={`icon-btn frame hud-push ${musicOn ? 'on' : ''}`} aria-pressed={musicOn} onClick={onToggleMusic} aria-label={musicOn ? 'Silenciar la música' : 'Activar la música'}><Sprite name={musicOn ? 'icon-sound' : 'icon-mute'} size={20} /></button>
      <button className="icon-btn frame" onClick={onOpenMenu} aria-label="Abrir menú"><Sprite name="icon-menu" size={20} /></button>
    </div>
    <div className="hud-row hud-zoom">
      <div className="zoom-controls frame" role="group" aria-label="Zoom del mapa">
        <button type="button" onClick={() => onZoom(-0.1)} disabled={zoom <= 0.6} aria-label="Alejar el mapa">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => onZoom(0.1)} disabled={zoom >= 1.6} aria-label="Acercar el mapa">+</button>
      </div>
    </div>
  </header>
}
