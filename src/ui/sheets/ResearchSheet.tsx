import { LIFETIME_ORDER, TECH_ORDER, TECHNOLOGIES } from '../../game/balance'
import { COMPONENTS } from '../../game/catalog'
import { isComponentUnlocked, isComponentVisible } from '../../game/engine'
import { autoRebuildCost, canUnlockAutoRebuild, canUnlockTech } from '../../game/research'
import type { ComponentKind, GameState, TechKey } from '../../game/types'
import { formatDecimal, formatNumber } from '../format'
import { Sprite } from '../pixel/Sprite'
import { Sheet } from '../Sheet'

interface Props { game: GameState; onClose: () => void; onResearch: (key: TechKey) => void; onAutoRebuild: (kind: ComponentKind) => void }
export function ResearchSheet({ game, onClose, onResearch, onAutoRebuild }: Props) {
  return <Sheet title="Laboratorio" eyebrow="ÁRBOL TECNOLÓGICO" onClose={onClose} className="lab">
    <div className="balance frame"><Sprite name="icon-flask" size={22} /><div><strong>{formatDecimal(game.researchPoints)} RP</strong><small>Solo las instalaciones de I+D generan RP.</small></div></div>
    <h3 className="research-section-title">Tecnologías</h3>
    <div className="upgrades">{TECH_ORDER.map((key) => { const tech = TECHNOLOGIES[key]; const unlocked = game.unlockedTechs[key]; const available = !tech.requires || game.unlockedTechs[tech.requires]; return <article className={`upgrade frame ${unlocked ? 'maxed' : ''}`} key={key}><span className="upgrade-icon frame"><Sprite name={key === 'solar' ? 'solar' : key === 'thorium' ? 'thorium' : key === 'fusion' ? 'fusion' : 'icon-flask'} size={28} /></span><div className="upgrade-copy"><strong>{tech.name}</strong><p>{tech.description}</p><small>{tech.requires && !available ? `Requiere ${TECHNOLOGIES[tech.requires].name}` : unlocked ? 'Investigación completada' : `${formatNumber(tech.cost)} RP`}</small></div><button className="btn frame gold" disabled={unlocked || !canUnlockTech(game, key)} onClick={() => onResearch(key)}>{unlocked ? 'LISTO' : `${formatNumber(tech.cost)} RP`}</button></article> })}</div>
    <h3 className="research-section-title">Auto rebuild</h3>
    <p className="research-section-hint">Cada licencia automatiza un tipo. La reconstrucción consume el costo completo del edificio cuando su vida útil llega a cero.</p>
    <div className="upgrades">{LIFETIME_ORDER.filter((kind) => isComponentUnlocked(game, kind) && isComponentVisible(game, kind)).map((kind) => { const unlocked = game.autoRebuilds[kind]; const cost = autoRebuildCost(game, kind); return <article className={`upgrade frame ${unlocked ? 'maxed' : ''}`} key={kind}><span className="upgrade-icon frame"><Sprite name={kind} size={28} /></span><div className="upgrade-copy"><strong>Auto rebuild · {COMPONENTS[kind].shortName}</strong><p>Reconstruye las unidades caducadas de este tipo cuando haya créditos.</p><small>{unlocked ? 'Automatización activa' : `${formatNumber(cost)} RP`}</small></div><button className="btn frame gold" disabled={unlocked || !canUnlockAutoRebuild(game, kind)} onClick={() => onAutoRebuild(kind)}>{unlocked ? 'ACTIVO' : `${formatNumber(cost)} RP`}</button></article> })}</div>
  </Sheet>
}
