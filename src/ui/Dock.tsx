import { COMPONENT_ORDER, COMPONENTS } from '../game/catalog'
import { isComponentUnlocked, isComponentVisible } from '../game/engine'
import { TECHNOLOGIES } from '../game/balance'
import type { ComponentKind, GameState, ToolMode } from '../game/types'
import { formatCompact, formatShort } from './format'
import { Sprite } from './pixel/Sprite'

export type DockTab = 'build' | 'inspector' | 'upgrades' | 'lab' | 'contracts' | 'menu'

interface DockProps {
  game: GameState
  activeTab: DockTab | null
  onTab: (tab: DockTab) => void
  onChooseComponent: (kind: ComponentKind) => void
  onChooseTool: (tool: ToolMode) => void
  onUndo: () => void
  undoDepth: number
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

export function Dock({ game, activeTab, onTab, onChooseComponent, onChooseTool, onUndo, undoDepth, labBadge, upgradesBadge, contractReady }: DockProps) {
  const building = game.toolMode === 'build'
  return (
    <footer className="dock">
      {activeTab === 'build' && (
        <section className="tray frame" aria-label="Bandeja de construcción">
          <div className="tray-head">
            <strong>{game.toolMode === 'demolish' ? 'DEMOLER' : 'CONSTRUIR'}</strong>
            <span>{game.toolMode === 'demolish' ? 'Productores 0 % · otras piezas 85 %' : 'Elige una pieza · luego toca o desliza'}</span>
            <button className="tray-undo frame" disabled={undoDepth === 0} onClick={onUndo} aria-label={undoDepth ? `Deshacer, ${undoDepth} disponibles` : 'Nada que deshacer'}>
              <Sprite name="icon-undo" size={16} />{undoDepth > 0 && <small>{undoDepth}</small>}
            </button>
          </div>
          <div className="cards">
            {COMPONENT_ORDER.filter((kind) => isComponentVisible(game, kind) && isComponentUnlocked(game, kind)).map((kind) => {
              const definition = COMPONENTS[kind]
              const unlocked = isComponentUnlocked(game, kind)
              const selected = building && game.selectedKind === kind
              const affordable = game.credits >= definition.cost
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
