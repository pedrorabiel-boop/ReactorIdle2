import { useState } from 'react'
import { COMPONENT_ORDER, LIFETIME_ORDER, TECH_ORDER, TECHNOLOGIES } from '../../game/balance'
import { COMPONENTS } from '../../game/catalog'
import { COMPONENT_NUMERIC_FIELDS, ECONOMY_DEBUG_FIELDS } from '../../game/debug'
import { upgradeTracks } from '../../game/research'
import type { ComponentKind, DebugSettings, GameState, TechKey, UpgradeTrack } from '../../game/types'
import { Sheet } from '../Sheet'

interface Props {
  game: GameState
  onClose: () => void
  onChange: (settings: DebugSettings) => void
  onSetCredits: (credits: number) => void
  onSetResearch: (research: number) => void
  onReset: () => void
}

function NumberField({ label, value, step = 1, onChange }: { label: string; value: number; step?: number; onChange: (value: number) => void }) {
  return <label className="debug-field"><span>{label}</span><input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} /></label>
}

const trackNames: Record<UpgradeTrack, string> = { output: 'Mejora de potencia · costo Nv.2', capacity: 'Mejora de capacidad · costo Nv.2', autonomy: 'Mejora de duración · costo Nv.2' }

export function DebugSheet({ game, onClose, onChange, onSetCredits, onSetResearch, onReset }: Props) {
  const [selectedKind, setSelectedKind] = useState<ComponentKind>('wind')
  const settings = game.debug
  const component = settings.componentValues[selectedKind]
  const changeComponent = (key: keyof typeof component, value: number) => onChange({ ...settings, componentValues: { ...settings.componentValues, [selectedKind]: { ...component, [key]: value } } })
  const changeTechnology = (key: TechKey, value: number) => onChange({ ...settings, technologyCosts: { ...settings.technologyCosts, [key]: value } })
  const changeUpgrade = (track: UpgradeTrack, value: number) => onChange({ ...settings, upgradeBaseCosts: { ...settings.upgradeBaseCosts, [selectedKind]: { ...settings.upgradeBaseCosts[selectedKind], [track]: value } } })

  return <Sheet title="Debug" eyebrow="SANDBOX DE BALANCE" onClose={onClose} className="debug-sheet">
    <section className="debug-section warning-frame"><strong>MODO DEBUG ACTIVO</strong><p>Estos ajustes se guardan con esta partida. Al desactivar Debug, el balance oficial vuelve a aplicarse sin borrar tus valores personalizados.</p></section>

    <section className="debug-section"><h3>Recursos</h3><button className={`btn frame wide ${settings.infiniteMoney ? 'on gold' : ''}`} onClick={() => onChange({ ...settings, infiniteMoney: !settings.infiniteMoney })}>Dinero infinito: {settings.infiniteMoney ? 'ACTIVO' : 'NO'}</button><div className="debug-grid"><NumberField label="Dinero actual" value={game.credits} onChange={onSetCredits} /><NumberField label="RP actuales" value={game.researchPoints} onChange={onSetResearch} /><NumberField label="Dinero inicial al reiniciar" value={settings.initialCredits} onChange={(initialCredits) => onChange({ ...settings, initialCredits })} /></div></section>

    <section className="debug-section"><h3>Edificios</h3><label className="debug-select"><span>Componente</span><select value={selectedKind} onChange={(event) => setSelectedKind(event.target.value as ComponentKind)}>{COMPONENT_ORDER.map((kind) => <option value={kind} key={kind}>{COMPONENTS[kind].name}</option>)}</select></label><div className="debug-grid">{COMPONENT_NUMERIC_FIELDS.filter(({ key }) => component[key] !== undefined).map(({ key, label }) => <NumberField key={key} label={label} value={component[key]!} step={key === 'controllerBonus' || key === 'thermalResistance' ? 0.01 : 0.1} onChange={(value) => changeComponent(key, value)} />)}</div></section>

    <section className="debug-section"><h3>Precios de mejoras · {COMPONENTS[selectedKind].shortName}</h3><p className="hint">Costo base para pasar de nivel 1 a 2. Los niveles posteriores usan el crecimiento global.</p><div className="debug-grid">{upgradeTracks(selectedKind).map((track) => <NumberField key={track} label={trackNames[track]} value={settings.upgradeBaseCosts[selectedKind][track]} onChange={(value) => changeUpgrade(track, value)} />)}</div></section>

    <section className="debug-section"><h3>Economía global</h3><div className="debug-grid">{ECONOMY_DEBUG_FIELDS.map(({ key, label, step }) => <NumberField key={key} label={label} value={settings.economy[key]} step={step} onChange={(value) => onChange({ ...settings, economy: { ...settings.economy, [key]: value } })} />)}</div></section>

    <section className="debug-section"><h3>Investigaciones</h3><div className="debug-grid">{TECH_ORDER.map((key) => <NumberField key={key} label={`${TECHNOLOGIES[key].name} · RP`} value={settings.technologyCosts[key]} onChange={(value) => changeTechnology(key, value)} />)}</div></section>

    <section className="debug-section"><h3>Auto rebuild</h3><div className="debug-grid">{LIFETIME_ORDER.map((kind) => <NumberField key={kind} label={`${COMPONENTS[kind].shortName} · RP`} value={settings.autoRebuildCosts[kind] ?? 0} onChange={(value) => onChange({ ...settings, autoRebuildCosts: { ...settings.autoRebuildCosts, [kind]: value } })} />)}</div></section>

    <button className="btn frame danger wide" onClick={onReset}>Restaurar todos los valores oficiales</button>
  </Sheet>
}
