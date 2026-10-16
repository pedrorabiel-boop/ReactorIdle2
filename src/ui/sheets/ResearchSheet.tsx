import { LIFETIME_ORDER, TECH_ORDER, TECHNOLOGIES } from '../../game/balance'
import { COMPONENTS } from '../../game/catalog'
import { pendingAutoRebuilds, pendingTechs } from '../../game/engine'
import { autoRebuildCost, canUnlockAutoRebuild, canUnlockTech } from '../../game/research'
import type { ComponentKind, GameState, TechKey } from '../../game/types'
import { formatDecimal, formatNumber } from '../format'
import { Sprite } from '../pixel/Sprite'
import { Sheet } from '../Sheet'

interface Props { game: GameState; onClose: () => void; onResearch: (key: TechKey) => void; onAutoRebuild: (kind: ComponentKind) => void }

const techIcon = (key: TechKey) => key === 'solar' ? 'solar' : key === 'thorium' ? 'thorium' : key === 'fusion' ? 'fusion' : 'icon-flask'

export function ResearchSheet({ game, onClose, onResearch, onAutoRebuild }: Props) {
  // El laboratorio solo enseña lo que se puede comprar ahora: ni lo ya
  // investigado, ni los escalones que todavía no tienen su requisito.
  const techs = pendingTechs(game)
  const licences = pendingAutoRebuilds(game)

  const doneTechs = TECH_ORDER.filter((key) => game.unlockedTechs[key]).length
  const doneLicences = LIFETIME_ORDER.filter((kind) => game.autoRebuilds[kind]).length

  return <Sheet title="Laboratorio" eyebrow="SIGUIENTE PASO" onClose={onClose} className="lab">
    <div className="balance frame"><Sprite name="icon-flask" size={22} /><div><strong>{formatDecimal(game.researchPoints)} RP</strong><small>Solo las instalaciones de I+D generan RP.</small></div></div>

    <p className="research-progress">{doneTechs} de {TECH_ORDER.length} tecnologías · {doneLicences} de {LIFETIME_ORDER.length} licencias</p>

    {techs.length > 0 && <>
      <h3 className="research-section-title">Tecnologías</h3>
      <div className="upgrades">{techs.map((key) => {
        const tech = TECHNOLOGIES[key]
        return <article className="upgrade frame" key={key}>
          <span className="upgrade-icon frame"><Sprite name={techIcon(key)} size={28} /></span>
          <div className="upgrade-copy"><strong>{tech.name}</strong><p>{tech.description}</p><small>{formatNumber(tech.cost)} RP</small></div>
          <button className="btn frame gold" disabled={!canUnlockTech(game, key)} onClick={() => onResearch(key)}>{formatNumber(tech.cost)} RP</button>
        </article>
      })}</div>
    </>}

    {licences.length > 0 && <>
      <h3 className="research-section-title">Auto rebuild</h3>
      <p className="research-section-hint">Cada licencia automatiza un tipo. La reconstrucción consume el costo completo del edificio cuando su vida útil llega a cero.</p>
      <div className="upgrades">{licences.map((kind) => {
        const cost = autoRebuildCost(game, kind)
        return <article className="upgrade frame" key={kind}>
          <span className="upgrade-icon frame"><Sprite name={kind} size={28} /></span>
          <div className="upgrade-copy"><strong>Auto rebuild · {COMPONENTS[kind].shortName}</strong><p>Reconstruye las unidades caducadas de este tipo cuando haya créditos.</p><small>{formatNumber(cost)} RP</small></div>
          <button className="btn frame gold" disabled={!canUnlockAutoRebuild(game, kind)} onClick={() => onAutoRebuild(kind)}>{formatNumber(cost)} RP</button>
        </article>
      })}</div>
    </>}

    {techs.length === 0 && licences.length === 0
      && <p className="hint upgrades-empty">No queda nada por investigar aquí. Lo siguiente se abrirá cuando desbloquees nuevas torres.</p>}
  </Sheet>
}
