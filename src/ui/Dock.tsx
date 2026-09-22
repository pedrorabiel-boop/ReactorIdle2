import { COMPONENT_ORDER, COMPONENTS } from '../game/catalog'
import { isComponentUnlocked, isComponentVisible } from '../game/engine'
import { canAfford } from '../game/debug'
import { TECHNOLOGIES } from '../game/balance'
import type { ComponentKind, GameState, ToolMode } from '../game/types'
import { componentCapacity, componentMultiplier, conversionRate, coolingRate, directEnergyRate, fuelCapacity, productionRate, researchPerFacility, salesPerOffice, storagePerBattery, thermalResistance } from '../game/research'
import { formatCompact, formatDecimal, formatShort } from './format'
import { Sprite } from './pixel/Sprite'

export type DockTab = 'build' | 'inspector' | 'upgrades' | 'lab' | 'contracts' | 'menu' | 'debug'

interface DockProps {
  game: GameState
  activeTab: DockTab | null
  buildFocus: boolean
  onTab: (tab: DockTab) => void
  onCloseBuild: () => void
  onChooseComponent: (kind: ComponentKind) => void
  onChooseTool: (tool: ToolMode) => void
  labBadge: number
  upgradesBadge: number
  contractReady: boolean
}

const TABS: Array<{ key: DockTab; label: string; icon: string }> = [
  { key: 'build', label: 'Construir', icon: 'icon-hammer' },
  { key: 'upgrades', label: 'Mejoras', icon: 'icon-magnifier' },
  { key: 'lab', label: 'Lab', icon: 'icon-flask' },
  { key: 'contracts', label: 'Contratos', icon: 'icon-scroll' },
  { key: 'menu', label: 'Menú', icon: 'icon-menu' },
]

interface CardStat { icon: string; value: string; label: string }
const formatStat = (value: number) => Math.abs(value) < 10 ? formatDecimal(value) : formatShort(value)

function cardStats(game: GameState, kind: ComponentKind): CardStat[] {
  const def = COMPONENTS[kind]
  const stats: CardStat[] = []
  if (def.directEnergy) stats.push({ icon: 'icon-bolt', value: `${formatStat(directEnergyRate(game, kind))} E/s`, label: 'Energía generada' })
  if (def.production) stats.push({ icon: 'icon-flame', value: `${formatStat(productionRate(game, kind))}/s`, label: 'Calor generado' })
  if (def.conversionRate) stats.push({ icon: 'icon-bolt', value: `${formatStat(conversionRate(game))} E/s`, label: 'Energía transformada' })
  if (def.coolingRate) stats.push({ icon: 'icon-flame', value: `−${formatStat(coolingRate(game))}/s`, label: 'Calor disipado' })
  if (def.thermalResistance) stats.push({ icon: 'icon-flame', value: `${formatDecimal(thermalResistance(game, kind))} R`, label: 'Resistencia térmica' })
  if (def.storageCapacity) stats.push({ icon: 'icon-bolt', value: `+${formatStat(storagePerBattery(game))} E`, label: 'Almacenamiento' })
  if (def.salesRate) stats.push({ icon: 'icon-handshake', value: `${formatStat(salesPerOffice(game))} E/s`, label: 'Potencia de venta' })
  if (def.researchRate) stats.push({ icon: 'icon-flask', value: `${formatStat(researchPerFacility(game))} RP/s`, label: 'Investigación' })
  if (def.controllerBonus) stats.push({ icon: 'icon-bolt', value: `+${formatStat(def.controllerBonus * componentMultiplier(game, kind) * 100)}%`, label: 'Amplificación de red' })
  if (def.capacity > 0) stats.push({ icon: 'icon-health', value: formatShort(componentCapacity(game, kind)), label: 'Calor máximo' })
  if (def.fuelCycles) stats.push({ icon: 'icon-clock', value: `${formatShort(fuelCapacity(game, kind))} s`, label: 'Vida útil' })
  return stats
}

export function Dock({ game, activeTab, buildFocus, onTab, onCloseBuild, onChooseComponent, onChooseTool, labBadge, upgradesBadge, contractReady }: DockProps) {
  const building = game.toolMode === 'build'
  return (
    <footer className="dock">
      {activeTab === 'build' && (
        <section className="tray frame" aria-label="Bandeja de construcción">
          <div className="tray-head">
            <strong>{game.toolMode === 'demolish' ? 'DEMOLER' : 'CONSTRUIR'}</strong>
            <span>{game.toolMode === 'demolish' ? 'Productores 0 % · otras piezas 85 %' : 'Elige una pieza · luego toca o desliza'}</span>
            <button className="tray-close frame" onClick={onCloseBuild} aria-label="Cerrar construcción">×</button>
          </div>
          <div className="cards">
            {COMPONENT_ORDER.filter((kind) => isComponentVisible(game, kind) && isComponentUnlocked(game, kind)).map((kind) => {
              const definition = COMPONENTS[kind]
              const unlocked = isComponentUnlocked(game, kind)
              const selected = buildFocus && building && game.selectedKind === kind
              const affordable = canAfford(game, definition.cost)
              return (
                <button
                  key={kind}
                  className={`card ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'} ${unlocked && !affordable ? 'poor' : ''}`}
                  aria-pressed={selected}
                  aria-label={unlocked ? `${definition.name}, ${definition.cost} créditos` : `${definition.name} requiere ${definition.tech ? TECHNOLOGIES[definition.tech].name : 'progreso'}`}
                  onClick={() => onChooseComponent(kind)}
                >
                  <Sprite name={kind} size={32} />
                  <span className="card-name">{definition.shortName}</span>
                  {unlocked
                    ? <span className="card-cost"><Sprite name="icon-coin" size={10} />{formatCompact(definition.cost)}</span>
                    : <span className="card-cost locked"><Sprite name="icon-lock" size={10} />{formatShort(definition.tech ? TECHNOLOGIES[definition.tech].cost : 0)} RP</span>}
                  {unlocked && <span className="card-stats">{cardStats(game, kind).map((stat) => <span className="card-stat" key={`${stat.icon}-${stat.label}`} title={stat.label} aria-label={`${stat.label}: ${stat.value}`}><Sprite name={stat.icon} size={9} /><b>{stat.value}</b></span>)}</span>}
                </button>
              )
            })}
            <button className={`card tool ${game.toolMode === 'demolish' ? 'selected danger' : ''}`} aria-pressed={game.toolMode === 'demolish'} onClick={() => onChooseTool(game.toolMode === 'demolish' ? 'build' : 'demolish')}>
              <Sprite name="icon-trash" size={32} />
              <span className="card-name">Demoler</span>
              <span className="card-cost">0–85 %</span>
            </button>
          </div>
        </section>
      )}
      <nav className="tabs" aria-label="Secciones">
        {TABS.map((tab) => (
          <button key={tab.key} className={`tab frame ${activeTab === tab.key ? 'on' : ''}`} aria-pressed={activeTab === tab.key} onClick={() => onTab(tab.key)}>
            <Sprite name={tab.icon} size={20} />
            <span>{tab.label}</span>
            {tab.key === 'lab' && labBadge > 0 && <em className="badge">{labBadge}</em>}
            {tab.key === 'upgrades' && upgradesBadge > 0 && <em className="badge">{upgradesBadge}</em>}
            {tab.key === 'contracts' && contractReady && <em className="badge alert">!</em>}
          </button>
        ))}
      </nav>
    </footer>
  )
}
